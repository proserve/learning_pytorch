'use strict'

const _ = require('underscore'),
      async = require('async'),
      modules = require('..'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      Memo = require('../../classes/memo'),
      { resolveOptionsCallback, promised, isPlainObject, rString,
        path: pathTo, joinPaths, equalIds, rBool, rInt,
        pathPrefix, pathSuffix, isId, extend, array: toArray,
        createId, isCustomName, sleep, getIdOrNull
      } = require('../../utils'),
      { ResourceStream } = require('./resource-stream'),
      ScriptTransform = require('../sandbox/script-transform'),
      WritableOutputCursor = require('../../classes/writable-output-cursor'),
      exportModels = {
        org: 'env',
        script: 'script',
        expression: 'expression',
        view: 'view',
        object: 'object',
        template: 'template',
        idp: 'idp',
        i18n: 'i18n'
      },
      objectUniquekeys = {
        config: 'name',
        app: 'name',
        role: 'code',
        serviceAccount: 'name',
        policy: 'name',
        notification: 'name',
        storageLocation: 'name',
        smsNumber: 'name',
        script: 'name',
        expression: 'name',
        view: 'name',
        template: 'name',
        idp: 'name',
        object: 'name',
        i18n: 'name'
      },
      resourceModels = {
        env: 'org',
        script: 'script',
        expression: 'expression',
        idp: 'idp',
        view: 'view',
        object: 'object',
        i18n: 'i18n',
        template: 'template'
      },
      envResourcePaths = {
        app: 'apps',
        role: 'roles',
        serviceAccount: 'serviceAccounts',
        policy: 'policies',
        notification: 'configuration.notifications',
        storageLocation: 'configuration.storage.locations',
        smsNumber: 'configuration.sms.numbers'
      },
      importGroups = {
        config: ['config'],
        template: ['template'],
        environment: ['smsNumber', 'role', 'storageLocation', 'serviceAccount', 'app', 'policy', 'notification'],
        idps: ['idp'],
        objects: ['object'],
        i18ns: ['i18ns'],
        scripts: ['script'],
        expressions: ['expression'],
        views: ['view'],
        unknown: ['unknown'],
        instances: ['instance'],
        env: ['env']
      },
      importInstanceGroup = 'instances',
      importGroupLookup = Object.keys(importGroups).reduce((memo, key) => {
        importGroups[key].forEach((v) => {
          memo[v] = key
        })
        return memo
      }, {}),
      importControlCodes = {
        restartGroup: {},
        restartAll: {},
        stopGroup: {},
        stopAll: {}
      },
      { RuntimeOperation } = modules.runtime.operations,
      hearbeatIntervalMs = 20000 // Our HAProxy default idle time is 30s

Object.freeze(exportModels)
Object.freeze(objectUniquekeys)
Object.freeze(resourceModels)
Object.freeze(envResourcePaths)

let Undefined

class DeveloperModule {

  /**
   *
   * @param ac
   * @param options
   *  manifest {Object}
   *  silent {Boolean=false} if true, silently ignores errors like missing unique keys.
   *  package {Object} { beforeExport, afterExport }
   * @param callback
   */
  exportEnvironment(ac, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const resourceStream = new ResourceStream(ac, options),
          { package: packageJson } = options,
          { scripts, pipes } = packageJson || {},
          { export: exportPipe } = pipes || {},
          exportMemo = new Memo(),
          tasks = []

    if (scripts && scripts.beforeExport) {
      tasks.push(async() => {
        await promised(
          null,
          modules.sandbox.sandboxed(
            ac,
            scripts.beforeExport,
            {
              compilerOptions: {
                label: `beforeExport`,
                type: 'deployment',
                language: 'javascript',
                specification: 'es6'
              },
              scriptOptions: {
                context: { package: packageJson, manifest: resourceStream.document },
                api: {
                  context: {
                    setManifest: async(script, message, document) => {
                      resourceStream.manifest = document
                    },
                    memo: exportMemo.getScriptApi()
                  }
                }
              }
            }
          )
        )
      })
    }

    // check for top-level inclusions of any kind to trivially skip unneeded processing
    for (let modelName of Object.keys(this.consts.exportModels)) {
      if (modelName === 'org' || resourceStream.manifest.has(modelName)) {
        tasks.push(exportModel(modelName))
      }
    }

    // add config
    if (resourceStream.manifest.has('config')) {
      tasks.push(exportConfig)
    }

    // add custom definitions that exist in the manifest
    tasks.push(async() => {
      for (let { name } of resourceStream.manifest) {
        if (isCustomName(name) && resourceStream.manifest.has(name)) {
          const fn = exportModel(name)
          await fn()
        }
      }
    })

    // return the cursor immediately start streaming into it.
    let err,
        outputCursor = new WritableOutputCursor()

    outputCursor.on('error', e => {
      err = e
    })
    outputCursor.fromStream(resourceStream, { dataEvent: 'resource' })

    // Create the heartbeat interval
    // eslint-disable-next-line one-var
    const heartbeat = setInterval(() => {
      try {
        if (outputCursor.isClosed()) {
          return
        }
        resourceStream.emit('resource', { object: 'heartbeat' })
      } catch (err) {
        logger.warn(`Error while sending export heartbeat: ${err.message}`)
      }
    }, hearbeatIntervalMs)

    outputCursor.on('close', () => {
      heartbeat && clearInterval(heartbeat)
    })

    Promise.resolve(null)

      // transform output?
      .then(async() => {
        if (exportPipe) {
          if (Array.isArray(exportPipe) || isPlainObject(exportPipe)) {
            const ec = modules.expressions.createPipeline(
              ac,
              toArray(exportPipe, true)
            )
            outputCursor = await ec.evaluate({ input: outputCursor })
          } else if (_.isString(exportPipe)) {
            const transform = new ScriptTransform(ac)
            await transform.init({ autoPrefix: false, script: exportPipe, memo: exportMemo })
            outputCursor = await transform.run(
              null,
              outputCursor
            )
          }
          // @todo script transform errors are not propagated or caught. they are directly output to the input stream.
        }
      })
      .catch(e => {
        err = e
      })
      .then(() => {
        // return the cursor and detect pipe init errors.
        callback(null, outputCursor)
        if (err) {
          throw err
        }
      })
      .then(async() => {
        while (!outputCursor.isClosed() && tasks.length) {
          const task = tasks.shift()
          await task()
        }
      })
      .then(async() => {
        await resourceStream.flushFacetQueue()
        await resourceStream.processMediaTriggers()
      })
      .catch(e => {
        err = e
      })
      .then(async() => {
        err = Fault.from(err)
        if (pathTo(packageJson, 'scripts.afterExport')) {
          try {
            const { dependencies, document, exports } = resourceStream
            await promised(
              null,
              modules.sandbox.sandboxed(
                ac,
                pathTo(packageJson, 'scripts.afterExport'),
                {
                  compilerOptions: {
                    label: `afterExport`,
                    type: 'deployment',
                    language: 'javascript',
                    specification: 'es6'
                  },
                  scriptOptions: {
                    context: { err: err && err.toJSON(), package: packageJson, manifest: document, dependencies, exports },
                    api: {
                      context: {
                        memo: exportMemo.getScriptApi()
                      }
                    }
                  }
                }
              )
            )
          } catch (e) {
            if (err) {
              err.add(e)
            } else {
              err = e
            }
          }
        }
        heartbeat && clearInterval(heartbeat)
        resourceStream.end(err)
      }
      )

    /**
     * only allow exporting namespaced config
     */
    async function exportConfig() {

      const keys = await promised(modules.config, 'keys', ac.org, { extended: true })

      for (const { key, isPublic } of keys) {

        if (outputCursor.isClosed()) {
          return
        }

        if (isCustomName(key)) {
          const resourcePath = `config.${key}`
          if (resourceStream.addPath(resourcePath)) {
            const def = {
              name: key,
              object: 'config',
              resource: resourcePath,
              value: await promised(modules.config, 'get', ac.org, key),
              isPublic
            }
            if (def.value !== Undefined) {
              await resourceStream.exportResource(def, resourcePath)
            }
          }
        }
      }

    }

    function exportModel(modelName) {

      // until template model refactor, use custom implementation.
      if (modelName === 'template') {
        return exportTemplateModel()
      }

      return async() => {

        const model = await promised(ac.org, 'createObject', modelName),
              options = {
                // some readers may return special values
                acOptions: { isExport: true },
                // make sure the loaded document has everything it needs.
                include: (() => {
                  const optional = []
                  model.schema.node.walk(node => {
                    if (node.hasExportAccess(ac)) {
                      optional.push(node.fullpath)
                    }
                  })
                  return optional
                })()
              }

        if (model.objectName === 'account' || !model.uniqueKey) {
          throw Fault.create('cortex.invalidArgument.unspecified', {
            reason: `This object is not exportable: ${model.objectName}`,
            path: modelName
          })
        }

        let err,
            cursor = await promised(model, 'aclCursor', ac.principal, options)

        cursor.on('error', e => {
          err = e
        })

        while (!outputCursor.isClosed() && !cursor.isClosed() && await promised(cursor, 'hasNext')) {
          if (err) {
            break
          }

          await model.schema.node.export(
            ac,
            await promised(cursor, 'next'),
            resourceStream
          )
        }

        if (err) {
          throw err
        }

      }
    }

    function exportTemplateModel() {

      return async() => {

        const model = modules.db.models.template,
              cursor = await promised(model, 'aclCursor', ac.principal, options)

        while (!outputCursor.isClosed() && await promised(cursor, 'hasNext')) {
          await model.schema.node.export(
            ac,
            await promised(cursor, 'next'),
            resourceStream
          )
        }

      }

    }

  }

  /**
   * @param ac
   * @param ingestCursor
   * @param options
   *  backup {Boolean=false} do backup/rollback
   *  triggers {Boolean=false}: true to run instance triggers.
   * @param callback -> err, output cursor
   *
   * @todo worker lock
   *
   */
  importEnvironment(ac, ingestCursor, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    function makeCompare(keyOrder) {
      return (a, b) => {
        let objectA = ((name) => isCustomName(name) ? 'instance' : name)(pathPrefix(a)),
            objectB = ((name) => isCustomName(name) ? 'instance' : name)(pathPrefix(b))
        return keyOrder.indexOf(objectA) - keyOrder.indexOf(objectB)
      }
    }

    let streamPosition = -1,
        unsetDeploymentFlag = false,
        backupId = null,
        stallTimer = null,
        stallTimeout = rInt(config('developer.import.stallTimeoutMs'), 30000),
        stalled = false,
        importEnded = false,
        packageJson = null,
        heartbeat = null,
        facetsWithStreams = {}

    const disableTriggers = !(rBool(options.triggers, false)),
          productionFlag = rBool(options.production, false),
          isProduction = config('app.env') === 'production',
          importMemo = new Memo(),
          resourceStream = new ResourceStream(ac, {
            maxResources: 10000,
            cacheKey: `${ac.org.code}.import`,
            manifestType: 'imports',
            groupCompare: makeCompare(Object.keys(importGroups)),
            disableTriggers
          }),
          resourceCache = resourceStream.cache,
          outputCursor = new WritableOutputCursor(),
          doBackupAndRollback = rBool(options.backup, false),
          contextApi = {
            listResources: async function() {
              return resourceCache.listResources()
            },
            listFacets: async function() {
              return resourceCache.listFacets()
            },
            getResource: async function(script, message, name) {
              const resource = await resourceCache.getResource(name, { throwNotFound: false })
              return resource && resource.toObject()
            },
            findResource: async function(script, message, path, search = {}) {
              const resource = await resourceCache.findResource(path, search)
              return resource && resource.toObject()
            },
            getResources: async function(script, message, path) {
              const resources = await resourceCache.getResources(path, { throwNotFound: false })
              return resources.map(v => v.toObject())
            },
            getFacet: async function(script, message, resourceId) {
              const facet = await resourceCache.getFacet(resourceId, { throwNotFound: false })
              return facet && facet.toObject()
            },
            getFacets: async function(script, message, resourceIds) {
              const facets = await resourceCache.getFacets(resourceIds)
              return facets.map(v => v.toObject())
            },
            getUploadStatus: async function() {
              return resourceCache.getUploadStatus()
            },
            log: async function(script, message, data) {
              resourceStream.log('script', { message: data })
            },
            memo: importMemo.getScriptApi()
          },
          importOperation = new RuntimeOperation(
            ac.org,
            'import',
            {
              parent: ac.req && ac.req.operation,

              // stops the resource stream and allow this routine to rollback.
              cancel(err, callback) {

                err = err || Fault.create('cortex.error.aborted')

                ingestCursor.destroy(err, () => {})

                heartbeat && clearInterval(heartbeat)
                resourceStream.end(err)
                  .then(() => {

                    const gracePeriodMs = config('modules.runtime.preStop.gracePeriodMs'),
                          waitStart = Date.now(),
                          waitInterval = 100

                    logger.info(`Import ${this.context} abort signalled. Waiting ${gracePeriodMs}ms before forcing abort.`)

                    async.whilst(
                      () => !importEnded && (Date.now() - waitStart) < gracePeriodMs,
                      async() => {
                        await sleep(waitInterval)
                      },
                      err => {
                        if (importEnded) {
                          logger.info(`Import ${this.context} aborted successfully.`)
                        } else {
                          logger.warn(`Import ${this.context} abort grace period expired. The environment may be left in an inconsistent state.`)
                        }
                        callback(err)
                      }
                    )

                  })
                  .catch(err =>
                    callback(err)
                  )

              }

            }
          )

    ingestCursor.on('error', err => {
      void err
    })

    outputCursor.on('error', err => {
      void err
    })

    importOperation.start(() => {})

    resourceStream.on('end', (err) => {
      heartbeat && clearInterval(heartbeat)
      if (!err) {
        resourceStream.log('status', { stage: 'complete' })
      }
    })

    outputCursor.fromStream(resourceStream, { dataEvent: 'resource' })
    outputCursor.flushOnWrite = true

    // init resource groups with compare sort.
    for (const groupName of Object.keys(importGroups)) {
      resourceStream.addResourceGroup(groupName, makeCompare(importGroups[groupName]))
    }

    resourceStream.log('status', { stage: 'ingest' })

    function startStallTimer() {
      stallTimer = setTimeout(() => {
        stalled = true
      }, stallTimeout).unref()
    }

    function clearStallTimer() {
      clearTimeout(stallTimer)
      stalled = false
    }

    // "return" outputCursor
    callback(null, outputCursor)

    Promise.resolve()

      // store everything in the cache.
      .then(async() => {

        if (isProduction !== productionFlag) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'To help prevent unintentional imports, the production flag must be set in production and only in production environments.' })
        }

        startStallTimer()

        // Create the heartbeat interval
        heartbeat = setInterval(() => {
          try {
            resourceStream.log('heartbeat', { })
          } catch (err) {
            logger.warn(`Error while sending import heartbeat: ${err.message}`)
          }
        }, hearbeatIntervalMs)

        while (await promised(ingestCursor, 'hasNext')) {

          const doc = await promised(ingestCursor, 'next')

          streamPosition += 1

          if (stalled) {
            throw Fault.create('cortex.timeout.unspecified', { reason: `Timed out waiting for upload document.` })
          } else if (!isPlainObject(doc)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: `the resource at position ${streamPosition} is not an object` })
          }

          clearStallTimer()

          // ignore all manifest-like documents that might be commonly included by mistake.
          if (!(/^manifest-/.test(rString(doc.object, '')))) {

            // delete commonly used comment properties
            delete doc['//']

            // create upload objects for each facet we receive and cache them as upload objects, tying them back to resource facets.
            if (doc.object === 'facet') {

              if (doc.streamId) {
                // facet has a streamable asset
                // initiate the upload stream for these just before the stream is written to later in the object == stream block 
                facetsWithStreams[doc.streamId] = doc
              } else {
                // handles caching files.
                await resourceCache.initiateUploadStream(ac, doc)
              }

              const { resourceId } = doc
              resourceStream.log('ingest.facet', { resourceId })

            } else if (doc.object === 'package') {

              if (!packageJson) {
                packageJson = doc
                resourceStream.log('ingest.package')

                const ingestPipe = packageJson.pipes && packageJson.pipes.ingest

                if (Array.isArray(ingestPipe) || isPlainObject(ingestPipe)) {

                  const ec = modules.expressions.createPipeline(
                    ac,
                    toArray(ingestPipe, true)
                  )
                  ingestCursor = await ec.evaluate({ input: ingestCursor })

                } else if (_.isString(ingestPipe)) {

                  const transform = new ScriptTransform(ac)
                  await transform.init({ autoPrefix: false, script: ingestPipe, memo: importMemo, contextApi })
                  ingestCursor = await transform.run(
                    null,
                    ingestCursor
                  )
                }
              }

            } else if (doc.object === 'manifest') {

              resourceStream.manifest = doc
              resourceStream.log('ingest.manifest')

            } else if (doc.object === 'stream') {

              let facetDoc = facetsWithStreams[doc.streamId]

              // initiating the uploadStream right before writing to it 
              // this is to prevent the 60s timeout issue from OSS 
              if(facetDoc) {
                await resourceCache.initiateUploadStream(ac, facetDoc)
                delete facetsWithStreams[doc.streamId]
              }

              await resourceCache.ingestUploadStream(doc)

              const { index, streamId } = doc
              resourceStream.log('ingest.stream', { index, streamId })

            } else {

              // convert the doc to a locally consumable resource.
              try {
                doc.resource = await this.guessResourcePath(ac, doc)
              } catch (e) {
                const err = Fault.from(e)
                err.index = streamPosition
                throw err
              }

              const objectName = pathPrefix(doc.resource),
                    groupName = importGroupLookup[objectName] || importInstanceGroup,
                    identifierPaths = ['resource', 'type', 'name']

              // @hack. @todo. make generic.
              if (objectName === 'script') {
                identifierPaths.push('configuration.export')
              }

              let resourceName = doc.resource

              resourceStream.log('ingest.resource', { resourceName })

              await resourceStream.addResource(resourceName, groupName, true, doc, null, identifierPaths)

            }

          }

          startStallTimer()

        }

        clearStallTimer()
        if (resourceStream.err) {
          throw resourceStream.err
        }

      })

      // catch errors, clean up and quit.
      .catch(async err => {

        clearStallTimer()
        heartbeat && clearInterval(heartbeat)
        await promised(ingestCursor, 'destroy', err)
        throw err

      })

      // wait for all uploads to finish.
      .then(async() => {

        const waitFor = 30 * 1000,
              statusWaitFor = 1000,
              interval = 250

        let waitStart = Date.now(),
            statusWaitUntil = Date.now() + statusWaitFor,
            lastStatus = null

        while ((Date.now() - waitStart) < waitFor) {

          if (resourceStream.err) {
            throw resourceStream.err
          }

          const status = await resourceCache.getUploadStatus()
          if (status.errors) {
            await resourceCache.cancelUploads()
          }
          if (status.total === status.complete) {
            if (status.errors) {
              throw Fault.create('cortex.error.unspecified', { reason: 'One or more upload errors occurred during import.',
                faults: status.facets
                  .filter(v => v.uploadErr)
                  .map(v => v.uploadErr)
              })
            }
            resourceStream.log('uploads.completed', _.omit(status, 'facets'))
            break
          }
          if (lastStatus && (JSON.stringify(_.omit(lastStatus, 'facets')) !== JSON.stringify(_.omit(status, 'facets')))) {
            waitStart = Date.now()
            statusWaitUntil = Date.now() + statusWaitFor
            resourceStream.log('uploads.status', _.omit(status, 'facets'))
          } else if (Date.now() >= statusWaitUntil) {
            statusWaitUntil = Date.now() + statusWaitFor
            resourceStream.log('uploads.status', _.omit(status, 'facets'))
          }
          lastStatus = status

          await sleep(interval)

        }
      })

      // process package.json
      .then(async() => {

        if (packageJson) {
          const beforeImportScript = pathTo(packageJson, 'scripts.beforeImport') || pathTo(packageJson, 'scripts.preinstall')
          if (beforeImportScript) {
            await promised(
              null,
              modules.sandbox.sandboxed(
                ac,
                beforeImportScript,
                {
                  compilerOptions: {
                    label: `beforeImport`,
                    type: 'deployment',
                    language: 'javascript',
                    specification: 'es6'
                  },
                  scriptOptions: {
                    context: { package: packageJson, manifest: resourceStream.document },
                    api: { context: contextApi }
                  }
                }
              )
            )
          }
        }

        await promised(
          modules.sandbox,
          'triggerScript',
          'developer.import.before',
          null,
          ac,
          {
            forceInline: true,
            object: 'system',
            context: { package: packageJson, manifest: resourceStream.document },
            api: { context: contextApi }
          },
          {}
        )

      })

      // wait until available and do deployment-style lock and backup.
      .then(async() => {

        const { Org } = modules.db.models

        if (!doBackupAndRollback) {
          return
        }

        resourceStream.log('status', { stage: 'backup' })

        let activity,
            active = true,
            waitFor = 5 * 1000,
            waitStart,
            doc = await promised(modules.db, 'sequencedUpdate', Org, { _id: ac.orgId, 'deployment.inProgress': { $ne: true } }, { $set: { 'deployment.inProgress': true } })

        if (!doc) {
          throw Fault.create('cortex.accessDenied.deploymentInProgress')
        }
        unsetDeploymentFlag = true

        // for now, only close requests that are happening in dev environments. manual request cancelling
        // is still available if something is really stuck.
        if (!isProduction) {
          activity = await promised(modules.services.api, 'clusterGetActivity', ac.orgId, { verbose: true })
          activity.requests.forEach(req => {
            if (!equalIds(req._id, ac.reqId)) {
              modules.services.api.clusterCloseRequest(req._id, { force: false, org: ac.orgId }, () => {})
            }
          })
        }

        waitStart = Date.now()
        while (active && (Date.now() - waitStart) < waitFor) {

          if (resourceStream.err) {
            throw resourceStream.err
          }

          activity = await promised(modules.services.api, 'clusterGetActivity', ac.orgId, { verbose: true })
          active = activity.workers.length > 0 ||
            activity.requests.filter(req => !equalIds(req._id, ac.reqId)).length > 0 ||
            (activity.scripts.length > 0 && ac.script)

          await sleep(250)

        }

        if (active) {
          throw Fault.create('cortex.timeout.envActivity', { path: 'import' })
        }

        backupId = await this.backupEnvironment(ac)

        ac.option('$importDeferredIndexUpdates', [])
        ac.hook('import').after(vars => {
          vars.ac.option('$importDeferredIndexUpdates').forEach(fn => {
            fn()
          })
        })

      })

      // perform import.
      .then(async() => {

        resourceStream.log('status', { stage: 'import' })

        let importControl = importControlCodes.restartAll,
            environmentKeys = []

        function checkCursorClosed(result) {
          if (outputCursor.isClosed()) {
            importControl = importControlCodes.stopAll
            return false
          } else if (importControlCodes[result]) {
            importControl = result
            return false
          }
          return true
        }

        async function modelImporter(ac, resourcePath) {
          return checkCursorClosed(
            await importModel(resourcePath)
          )
        }

        const importers = {

          config: {
            import: async(groupAc, resourcePath) => {
              return checkCursorClosed(
                await importConfig(resourcePath)
              )
            }
          },

          // gather all the keys and save as a sequenced function. it's important to save as many environment
          // elements together as possible to avoid multiple org sequences. some may invariably occur during
          // updates later on and there we'll have to save immediately to avoid orphaned identifiers. for example,
          // viewA imports roleA dep but errors out after initial write. if we save the env after, that role id
          // would become invalid.
          environment: {

            triesLeft: 10,

            begin: async() => {
              return resourceStream.beginEnvironmentUpdate()
            },

            // store up the keys in case of a restart.
            import: async(envAc, resourcePath) => {

              environmentKeys.push(resourcePath)

              const resourceType = pathPrefix(resourcePath),
                    propertyPath = envResourcePaths[resourceType],
                    node = envAc.object.schema.node.findNode(propertyPath),
                    resource = await resourceCache.getResource(resourcePath)

              let doc = await node.import(envAc, resource.doc, resourceStream)
              if (isId(pathTo(doc, '_id'))) {
                await resource.setImportIdentifier(doc._id)
              }
            },

            end: async() => {

              let err, completed
              try {
                completed = await resourceStream.endEnvironmentUpdate()
              } catch (e) {
                err = e
              }
              if (!err && !completed) {
                err = Fault.create('cortex.error.unspecified', { reason: 'Inconsistent environment state' })
              }

              importers.environment.triesLeft -= (err && err.errCode === 'cortex.conflict.sequencing') ? 1 : importers.environment.triesLeft
              if (importers.environment.triesLeft) {

                importControl = importControlCodes.restartGroup

                for (let resourcePath of environmentKeys) {

                  // reset identifier that may have assigned
                  const resource = await resourceCache.getResource(resourcePath)
                  await resource.setImportIdentifier(null)
                  resourceStream.deferResource(resourcePath)

                }
                environmentKeys.splice(0)

              } else if (err) {
                throw err
              }

              return checkCursorClosed(importControl)

            }
          },

          // all the objects should now be resolved, so 'unknown' instances can be re-guessed
          // and added to the instance group, which comes next.
          unknown: {

            import: async(groupAc, unknownPath) => {

              const resource = await resourceCache.getResource(unknownPath),
                    { doc } = resource

              delete doc.resource

              let resourcePath = await this.guessResourcePath(groupAc, doc)
              if (resourcePath.indexOf('unknown.') === 0) {
                throw Fault.create('cortex.invalidArgument.unspecified', {
                  reason: `A late-bound unknown resource failed to resolve to an existing object.`,
                  path: doc.object
                })
              }
              await resourceCache.renameResource(unknownPath, resourcePath)

              resourceStream.log('import.resolve', { unknownPath, resourcePath })
              resourceStream.addResource(resourcePath, 'instances', true)

            }
          },
          env: {
            import: async(ac, resourcePath) => {
              await importModel(resourcePath)
              return !outputCursor.isClosed()
            }
          }
        }

        ac.passive = true
        ac.option('isImport', true)
        ac.option('deferSyncEnvironment', true)

        while (importControl === importControlCodes.restartAll) {
          for (const groupName of Object.keys(importGroups)) {
            importControl = importControlCodes.restartGroup
            while (importControl === importControlCodes.restartGroup) {
              importControl = null
              const importer = importers[groupName] || { import: modelImporter }
              let groupAc = ac
              if (importer.begin) {
                groupAc = await importer.begin(groupAc) || ac
              }
              if (!importControl && importer.import) {
                await resourceStream.importResourceGroup(groupAc, groupName, importer.import)
              }
              if (!importControl && importer.end) {
                await importer.end(groupAc)
              }
            }
            if (importControl === importControlCodes.stopAll) {
              break
            }
          }
          if (importControl === importControlCodes.stopAll) {
            break
          }
        }

        // the output cursor would be closed if the connection aborts, which might bypass the resource stream error.
        if (resourceStream.err) {
          throw resourceStream.err
        }

        ac.option('deferSyncEnvironment', false)
        await ac.org.syncEnvironment(ac, { save: true, throwError: true, synchronizeJobs: true })

      })

      .then(async() => {
        // take out of deployment mode to allow deferred media changes to occur.
        try {
          const { Org } = modules.db.models
          if (unsetDeploymentFlag) {
            await promised(modules.db, 'sequencedUpdate', Org, { _id: ac.orgId, 'deployment.inProgress': true }, { $set: { 'deployment.inProgress': false } })
          }
        } catch (e) {
        }

        resourceStream.log('status', { stage: 'media.processing' })
        await resourceStream.flushFacetQueue()
        await resourceStream.processMediaTriggers()

        // build here
        const resources = await resourceStream.cache.listResources()
        if (Array.isArray(resources) && resources.filter(item => item.indexOf('i18n') > -1).length) {
          resourceStream.log('status', { stage: 'i18n-bundles.processing' })
          await ac.principal.org.i18n?.buildBundles(ac)
        }

      })

      // do not throw from here!
      .then(async() => {

        resourceStream.log('status', { stage: 'post' })

        try {
          await promised(ac.apiHooks, 'fire', this, 'import.after', null, { ac })
        } catch (e) {
        }

        if (packageJson) {
          const afterImportScript = pathTo(packageJson, 'scripts.afterImport') || pathTo(packageJson, 'scripts.postinstall')
          if (afterImportScript) {
            try {
              await promised(
                null,
                modules.sandbox.sandboxed(
                  ac,
                  afterImportScript,
                  {
                    compilerOptions: {
                      label: 'afterImport',
                      type: 'deployment',
                      language: 'javascript',
                      specification: 'es6'
                    },
                    scriptOptions: {
                      context: { package: packageJson, manifest: resourceStream.document },
                      api: { context: contextApi }
                    }
                  }
                )
              )
            } catch (e) {
            }
          }
        }

        try {
          await promised(
            modules.sandbox,
            'triggerScript',
            'developer.import.after',
            null,
            ac,
            {
              forceInline: true,
              object: 'system',
              context: { package: packageJson, manifest: resourceStream.document },
              api: { context: contextApi }
            },
            {}
          )
        } catch (e) {
        }

        heartbeat && clearInterval(heartbeat)
        await resourceStream.end()

      })

      // finish up
      .catch(async(err) => {

        if (backupId) {
          resourceStream.log('status', { stage: 'rollback' })
        }

        heartbeat && clearInterval(heartbeat)
        await resourceStream.end(err)

        if (backupId) {
          try {
            await this.rollbackEnvironment(ac, backupId)
          } catch (e) {
          }
        }

        try {
          const { Org } = modules.db.models
          if (unsetDeploymentFlag) {
            await promised(modules.db, 'sequencedUpdate', Org, { _id: ac.orgId, 'deployment.inProgress': true }, { $set: { 'deployment.inProgress': false } })
          }
        } catch (e) {
          void e
        }

        importEnded = true

      })

    // return the cursor now.
    callback(null, outputCursor)

    // ------------------------------------------------------------------

    async function importConfig(resourcePath) {

      const uniqueKey = pathSuffix(resourcePath)

      if (isCustomName(uniqueKey) && resourceStream.addPath(resourcePath)) {

        const resource = await resourceCache.getResource(resourcePath),
              { doc: { value, isPublic = null, merge = false } = {} } = resource,
              def = {
                name: uniqueKey,
                object: 'config',
                resource: resourcePath,
                value,
                isPublic
              }

        if (merge) {

          let existing = await promised(modules.config, 'get', ac.org, uniqueKey)
          if (isPlainObject(existing) || existing === Undefined) {
            def.value = extend(true, existing || {}, value)
          }

        }

        await promised(modules.config, 'set', ac.org, uniqueKey, value, { isPublic })

        return def
      }

      return Undefined

    }

    // ------------------------------------------------------------------

    async function importModel(resourcePath) {

      if (await resourceStream.hasIdentifier(resourcePath)) {
        return
      }

      const objectName = pathPrefix(resourcePath),
            modelName = resourceModels[objectName],
            model = modelName === 'template'
              ? modules.db.models.template
              : await promised(ac.org, 'createObject', modelName || objectName),
            resource = await resourceCache.getResource(resourcePath),
            doc = await model.schema.node.import(ac, resource.doc, resourceStream)

      if (isId(pathTo(doc, '_id'))) {
        const lookup = {}
        if (model.uniqueKey) {
          lookup[model.uniqueKey] = doc[model.uniqueKey]
        }
        await resource.setImportIdentifier(doc._id, lookup)
      }

      return doc

    }

  }

  /**
   * if the path cannot be guessed, it's added as `unknown.${createId()}`
   *
   * @param ac
   * @param doc
   * @returns {Promise<*>}
   */
  async guessResourcePath(ac, doc) {

    let objectName = doc.object,
        uniqueKey,
        resource = null

    if (objectName === 'env') {
      return 'env'
    }

    // @todo move to definition uniqueKey once they are integrated for instances

    if (!objectName) {
      throw Fault.create('cortex.invalidArgument.unspecified', {
        reason: `The resource is missing the object property.`,
        path: '',
        resource: doc.resource
      })
    }

    uniqueKey = this.consts.objectUniquekeys[objectName]

    if (!uniqueKey) {
      if (isCustomName(objectName)) {
        let err
        try {
          const model = await promised(ac.org, 'createObject', objectName)
          objectName = model.objectName
          uniqueKey = model.uniqueKey
        } catch (e) {
          err = e
        }
        if (err && err.errCode === 'cortex.invalidArgument.object') {
          resource = `unknown.${createId()}`
          err = null
        } else if (!err && !uniqueKey) {
          err = Fault.create('cortex.invalidArgument.unspecified', {
            reason: `The resource source object has no unique key: ${objectName}`,
            path: objectName,
            resource: doc.resource || objectName
          })
        }
        if (err) {
          throw err
        }
      }
    }

    if (!resource) {
      if (!uniqueKey) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: `Failed to identify the unique key for ${objectName}.`,
          path: objectName,
          resource: doc.resource || objectName
        })
      }

      resource = pathTo(doc, uniqueKey)
      if (resource) {
        if (['template'].includes(objectName)) { // weird type -> name indexed
          resource = joinPaths(pathTo(doc, 'type'), resource)
        }
        resource = joinPaths(objectName, resource)
      }

      if (!resource) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: `Failed to identify the resource. Is the ${uniqueKey} property set?`,
          path: uniqueKey,
          resource: doc.resource || objectName
        })
      } else if (doc.resource && resource !== doc.resource) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: `The resource doesn't match its import/unique key ${uniqueKey} property.`,
          path: uniqueKey,
          resource
        })
      }
    }

    return resource

  }

  get consts() {
    return {
      exportModels,
      objectUniquekeys,
      resourceModels,
      envResourcePaths,
      importControlCodes
    }
  }

  async backupEnvironment(ac) {

    const { Blob, Deployment, Org } = modules.db.models,
          backupBlob = await promised(Blob, 'create', {
            org: ac.orgId,
            label: 'Environment Backup',
            expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)), // 30 days.
            data: await promised(Deployment, 'createBackup', ac)
          })
    await removeBlob(pathTo(ac.org, 'deployment.backup')) // remove current backup.
    await promised(modules.db, 'sequencedUpdate', Org, { _id: ac.orgId }, { $set: { 'deployment.backup': backupBlob._id } })
    return backupBlob._id

  }

  async rollbackEnvironment(ac, backupId = null) {

    const { Blob, Deployment } = modules.db.models,
          blobId = backupId || pathTo(ac.org, 'deployment.backup'),
          backupBlob = pathTo(await promised(Blob, 'findById', blobId), 'data')

    if (backupBlob) {
      await promised(Deployment, 'rollback', ac, backupBlob.toString())
      return true
    }

    return false

  }

}

async function removeBlob(object) {
  const blobId = getIdOrNull(object, true)
  if (blobId) {
    await promised(modules.db.models.Blob.deleteMany({ _id: blobId }), 'exec')
  }
}

module.exports = new DeveloperModule()
