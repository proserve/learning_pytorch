'use strict'

/*

 @todo this needs a lot of work.

 - org activity
 - perhaps segregating per org. instance per org will create problems.
 - different timeouts for different operations?
 - this could become a REAL SERIOUS BOTTLENECK is scripts are slow. a good argument for org-ifying. maybe use pools in the cache? or allow increase/decrease number of members in the pool? or make oru own pool?
 - script api versions. v1
 - rename exit() to callback()

 - for logger, use task branch of host

 */

const _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      consts = require('../../consts'),
      http = require('http'),
      modules = require('../../modules'),
      { createHash } = require('crypto'),
      { expressions, metrics, cache, services: { transpiler }, db: { models } } = modules,
      {
        path: pathTo, array: toArray, rString, profile, rInt, optimizePathSelections, pathParts,
        pathToPayload, aton, createId, getClientIp, toJSON, extend, normalizeObjectPath, isPlainObject, isId,
        digIntoResolved, matchesEnvironment, equalIds, isSet, rBool, promised, ensureCallback, version, bson
      } = require('../../utils'),
      API_VERSION = version(),
      Startable = require('cortex-service/lib/startable'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../acl'),
      { AccessLevels, fixAllowLevel, AccessContext } = acl,
      ap = require('../../access-principal'),
      apis = require('./apis'),
      Memo = require('../../classes/memo'),
      SelectionTree = require('../db/definitions/classes/selection-tree'),
      ExpansionQueue = require('../db/definitions/classes/expansion-queue'),
      systemObjects = new Set(['object', 'org', 'script', 'view'])

let Undefined

function triggerFilter(principal, objectName, events) {

  return function(trigger) {

    if (events.includes(trigger.configuration.event)) {

      // system event
      if (objectName === 'system') {
        return trigger.configuration.object === 'system'
      }

      // filter out non-strings and output objects
      if (typeof objectName !== 'string' || objectName.indexOf('o_') === 0) {
        return false
      }

      // filter out system objects
      if (systemObjects.has(objectName) && !principal.org.configuration.scripting.configurationTriggers) {
        return false
      }

      // the trigger can run for any object or matches
      return trigger.configuration.object === '*' || trigger.configuration.object === objectName

    }

    return false

  }

}

class SandboxModule extends Startable {

  constructor(options) {

    super('sandbox', options)

    this._pool = require('./client/host-pool').create()
    this._ScriptTypes = require('./types')
    this._PoolScript = require('./client/pool-script')

    // for script trigger data.
    cache.memory.add('cortex.sandbox.transpiled')

    // augment request with memo. this should be called  body parsing.
    Object.defineProperties(http.IncomingMessage.prototype, {
      memo: {
        get: function() {
          if (!this._memo) {
            this._memo = new Memo()
          }
          return this._memo
        }
      }
    })

    metrics.register('sandbox', () => {
      return this._pool.metrics()
    })

  }

  _waitStart(callback) {

    this._pool.init(callback)
  }

  _waitStop(callback) {

    this._pool.shutdown(callback)
  }

  get ScriptTypes() {
    return this._ScriptTypes
  }

  get version() {
    return this._version || ''
  }

  set version(version) {
    version = String(version)
    if (this._version !== version) {
      if (this._version !== Undefined) {
        logger.warn(`sandbox version changing from ${this._version} to ${version}`)
      }
      this._version = version
    }
  }

  isPoolScript(script) {
    return (script instanceof this._PoolScript)
  }

  countRunningFor(orgId) {
    return this._pool.getRunningFor(orgId)
  }

  canRunScript(orgId) {
    const pct = this._pool.maxOrgSaturationScalar,
          runningForOrg = this.countRunningFor(orgId),
          potential = this._pool.numPotential,
          allowed = (runningForOrg + potential) * pct
    return runningForOrg < allowed
  }

  /**
     *
     * @param ac
     * @param source
     * @param options
     *     skipTranspile: false
     *     parentScript
     *     requires: an array of includes.
     *     optimized: compile and run bytecode (good for testing odd behaviour)
     *     compilerOptions
     *     scriptOptions
     *         stealthy: stay out of logs
     *         closeAllResourcesOnExit
     *     runtimeArguments
     *     scriptId
     *
     * @param runtimeArguments
     * @returns {function(*)}
     */
  sandboxed(ac, source, options, runtimeArguments) {

    return callback => {

      options = options || {}

      const transpiled = (err, transpiled) => {

        if (err) {
          return callback(err)
        }

        const type = rString(pathTo(options, 'compilerOptions.type'), 'route'),
              Script = models.getModelForType('script', type),
              model = new Script({
                _id: options.scriptId || new bson.ObjectID('000000000000000000000000'),
                org: ac.orgId,
                object: 'script',
                active: true,
                label: rString(pathTo(options, 'compilerOptions.label'), 'Script'),
                compiled: transpiled.source,
                type: type,
                requires: toArray(options.requires, options.requires).concat(toArray(transpiled.imports, transpiled.imports))
              }),
              compiled = () => {
                this.executeModel(ac, pathTo(options, 'parentScript'), model, pathTo(options, 'scriptOptions') || {}, runtimeArguments || {}, (err, { results, script, sandboxStats } = {}) => callback(err, results, script, sandboxStats))
              }

        if (!options.optimize) {
          return compiled()
        } else if (!ac.org.configuration.scripting.allowBytecodeExecution) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Please contact support to enable optimized scripts.' }))
        }

        this.compile(
          ac,
          model.type,
          model.type === 'library' ? model.configuration.export : rString(model.label, '').replace(/[\s\t\n\r]/g, '_'),
          this.wrapForExecution(model),
          (err, result) => {
            if (err) {
              return callback(err)
            }
            if (result) {
              model.optimized = true
              model.bytecode = result.bytecode
              model.bytecodeVersion = result.version
            }
            return compiled()
          }
        )

      }

      if (options.skipTranspile) {
        return transpiled(null, { source })
      }

      transpiler.transpile(source, pathTo(options, 'compilerOptions'), (err, compilerResult) => {
        transpiled(err, compilerResult)
      })
    }
  }

  /**
   * @param principal
   * @param object
   * @param events
   * @param callback err, array. filtered array of matching triggers.
   */
  triggersFor(principal, object, events, callback) {

    callback = profile.fn(callback, 'sandbox.triggersFor')

    const objectName = typeof object === 'string' ? object : object.objectName

    events = toArray(events, events)

    principal.org.getRuntime()
      .then(({ triggers }) => callback(null, triggers.filter(triggerFilter(principal, objectName, events))))
      .catch(callback)

  }

  /**
     * @param principal
     * @param object
     * @param events
     * @param callback err, exists. true if at least 1 trigger exists any (but not all) of the passed in event(s)
     */
  triggerExists(principal, object, events, callback) {

    const objectName = typeof object === 'string' ? object : object.objectName

    events = toArray(events, events)

    principal.org.getRuntime()
      .then(({ triggers }) => callback(null, !!triggers.find(triggerFilter(principal, objectName, events))))
      .catch(callback)

  }

  triggerPaths(principal, object, events, callback) {
    this.triggersFor(principal, object, events, (err, triggers) => {
      callback(
        err,
        err ? null : Array.from(toArray(triggers).reduce(
          (paths, trigger) => {
            for (const path of toArray(trigger?.configuration?.paths)) {
              paths.add(path)
            }
            return paths
          },
          new Set(['_id'])
        )
        ))
    })

  }

  /**
   *
   * @param principal
   * @param object
   * @param events
   * @param context (if function, calls with await to retrieve context.)
   * @param subject
   * @returns {Promise<any>}
   */
  async loadTriggers(principal, object, events, { parentScript, context, subject, runtimeArguments } = {}) {

    events = toArray(events, events)

    const runtime = await principal.org.getRuntime(),
          { triggers } = runtime,
          objectName = typeof object === 'string' ? object : object.objectName,
          ac = new AccessContext(principal, subject)

    return Promise.resolve(triggers)
      .then(triggers =>
        triggers.filter(triggerFilter(principal, objectName, events))
      )
      .then(triggers =>
        Promise.all(triggers.map(async trigger => {
          const triggerContext = _.isFunction(context) ? context(ac, trigger) : context
          return await this.fulfillsConditions(ac, trigger, { runtime, parentScript, context: triggerContext || subject, runtimeArguments }) ? trigger : null

        }))
      )
      .then(triggers =>
        triggers.filter(v => v)
      )
      .then(triggers =>
        Promise.all(triggers.map(trigger => this.getRuntimeModel(principal.org, runtime, trigger)))
      )

  }

  async getScriptAc(ac, scriptModel) {

    const scriptContext = scriptModel.runtimeContext || scriptModel,
          resolved = ac.resolved

    let scriptAc
    if (!scriptContext.principal) {
      scriptAc = ac.copy(ac.post || ac.subject)
      scriptAc.option('originalPrincipal', ac.principalId)
      scriptAc.eq = new ExpansionQueue(ac.principal, ac.req, ac.script)
    } else {
      const principal = await ap.create(ac.org, scriptContext.principal)
      scriptAc = ac.copy(ac.post || ac.subject)
      scriptAc.principal = principal
      scriptAc.grant = Math.max(resolved, rInt(scriptAc.grant, AccessLevels.None)) // the script ac gets at least the same access as the original caller.
      scriptAc.option('originalPrincipal', ac.principalId)
      scriptAc.eq = new ExpansionQueue(principal, ac.req, ac.script)
    }

    return scriptAc
  }

  /**
     *
     * @param event
     * @param parentScript
     * @param scriptAc
     * @param options
     *      attachedSubject
     *      changedPaths
     *      isNew
     *      disableTriggers: false,
     *      object
     *      forceInline: undefined (true / false)
     *      fnEach
     * @param runtimeArguments
     * @param callback err, { executions: [ {  ac, script, err, results, inline }, ...] }
     */
  triggerScript(event, parentScript, scriptAc, options, runtimeArguments, callback) {

    if (_.isFunction(options)) {
      callback = options
      runtimeArguments = {}
      options = {}
    } else if (_.isFunction(runtimeArguments)) {
      callback = runtimeArguments
      runtimeArguments = {}
    } else {
      options = options || {}
      runtimeArguments = runtimeArguments || {}
      callback = ensureCallback(callback)
    }

    const triggerResults = {
      executions: []
    }

    Promise.resolve(null)
      .then(async() => {

        if (!scriptAc.org.configuration.scripting.scriptsEnabled) {
          return
        }

        if (options.disableTriggers) {
          return
        }

        let previousExpressionSubject = Undefined

        const scriptOptions = {
                attachedSubject: options.attachedSubject,
                requestBody: options.requestBody,
                api: isPlainObject(options.api) ? options.api : {},
                context: isPlainObject(options.context) ? options.context : null
              },
              getPreviousExpressionSubject = () => {
                if (options.attachedSubject && options.attachedSubject.$raw && !previousExpressionSubject) {
                  const Model = options.attachedSubject.constructor
                  previousExpressionSubject = new Model(Undefined, null, true)
                  previousExpressionSubject.init(options.attachedSubject.$raw)
                }
                return previousExpressionSubject
              },
              loadTriggerExpressionRoot = (ac, runtime) => {

                const rootDocumentStyle = rString(runtime.configuration.rootDocument, 'document')

                if (rootDocumentStyle === 'runtime') {
                  return {
                    ...runtimeArguments,
                    runtime,
                    previous: getPreviousExpressionSubject(),
                    current: options.attachedSubject || Undefined
                  }
                }
                return options.attachedSubject

              },
              scriptModels = await this.loadTriggers(
                scriptAc.principal,
                options.object || scriptAc.object,
                event,
                { parentScript, runtimeArguments, context: loadTriggerExpressionRoot, subject: options.attachedSubject }
              )

        if (scriptModels.length === 0) {
          return
        }

        // shared trigger memo object
        // @todo pass between before and after triggers (the whole access context chain. ac.memo?)
        scriptOptions.api.memo = new Memo().getScriptApi()

        for (const scriptModel of scriptModels) {

          let executor

          const triggerAc = await this.getScriptAc(scriptAc, scriptModel),
                scriptContext = scriptModel.runtimeContext || scriptModel,
                contextDocs = {},
                isBefore = event.indexOf('.before') === event.length - 7,
                inline = rBool(options.forceInline, isBefore ? true : !!pathTo(scriptContext, 'configuration.inline')),
                result = { inline }

          triggerAc.grant = scriptAc.resolved

          // read a from of the document?
          if (options.attachedSubject && options.attachedSubject.$raw) {

            const Model = options.attachedSubject.constructor,
                  original = new Model(Undefined, null, true)

            original.init(options.attachedSubject.$raw)

            let paths = toArray(scriptContext.configuration.paths).length ? scriptContext.configuration.paths : null // these paths are already validated

            if (paths) {
              paths = paths ? Object.keys(optimizePathSelections(_.object(paths, Array(paths.length).fill(1)))) : null
            }

            contextDocs.old = await promised(original, 'aclRead', triggerAc, new SelectionTree({ paths }))
          }

          if (options.changedPaths || (options.attachedSubject && options.isNew)) {

            // select the modified paths and changedPaths intersection.
            let paths = toArray(scriptContext.configuration.paths).length ? scriptContext.configuration.paths : null // these paths are already validated

            if (!options.isNew && !paths) {
              paths = _.intersection(runtimeArguments.modified || options.attachedSubject.readableModifiedPaths(), options.changedPaths || [])
            }
            if (paths) {
              paths = Object.keys(optimizePathSelections(_.object(paths, Array(paths.length).fill(1))))
            }

            // @todo singlepath?!!!!!! @test files streaming results.
            contextDocs.new = await promised(options.attachedSubject, 'aclRead', triggerAc, new SelectionTree({ paths }))

            await promised(triggerAc.eq, 'expand', contextDocs.new)
          }

          // the context behaviour changes when inline. note there are 2 context update apis. one old-style .new and this one, pinned to the context.
          // .new will be phased out at some point.
          if (scriptOptions.attachedSubject) {
            scriptOptions.api.context = {
              read: function(script, message, path, options, callback) {
                path = (path && normalizeObjectPath(String(path).replace(/\//g, '.'))) || ''
                options = script.allowedOptions(options, 'grant', 'paths', 'include', 'expand', 'passive')
                options.readFromLinkedReferences = true

                const principal = script.ac.principal,
                      parts = pathParts(path)
                let subject = script.attachedSubject

                if (subject.$__linked && subject.$__linked[parts[0]]) {
                  subject = subject.$__linked[parts[0]]
                  path = parts[1]
                }
                options.document = subject
                if (!path) {
                  return subject.constructor.aclReadOne(principal, subject, options, callback)
                }
                return subject.constructor.aclReadPath(principal, subject, path, options, callback)
              },
              isNew: function(script, message, path, callback) {

                let parts, subject = script.attachedSubject

                if (!path) {
                  return callback(null, subject.isNew)
                }
                path = normalizeObjectPath(String(path).replace(/\//g, '.'))
                parts = pathParts(path)

                if (subject.$__linked && subject.$__linked[parts[0]]) {
                  subject = subject.$__linked[parts[0]]
                  path = parts[1]
                  if (!path) {
                    return callback(null, subject.isNew)
                  }
                }

                const opAc = copyAc(script),
                      selections = subject.constructor.schema.node.selectPaths(opAc.principal, { paths: [path] })

                opAc.singlePath = path
                subject.aclRead(opAc, selections, function(err, result) {
                  let isNew = false
                  if (!err && _.isObject(result)) {
                    const readableDoc = digIntoResolved(result, path, false, false, true)
                    if (isPlainObject(readableDoc) && isId(readableDoc._id)) {
                      // @todo: read $__linked references
                      const subjectDoc = digIntoResolved(subject, path, true, false, true)
                      if (_.isObject(subjectDoc) && subjectDoc.isNew) isNew = true
                    }
                  }
                  callback(err, isNew)
                })
              }
            }

            if (inline && scriptOptions.attachedSubject) {
              scriptOptions.api.context = extend(scriptOptions.api.context, {
                update: function(script, message, path, body, options, callback) {
                  options = script.allowedOptions(options, 'grant')
                  if (_.isString(path)) {
                    path = normalizeObjectPath(path.replace(/\//g, '.'))
                    body = pathToPayload(path, body)
                  } else {
                    body = _.isObject(path) ? path : {}
                    options = body
                    path = null
                  }
                  const opAc = copyAc(script, pathTo(options, 'grant'), 'put')
                  opAc.singlePath = path
                  script.attachedSubject.aclWrite(opAc, body, function(err) {
                    callback(err)
                  })
                },
                push: function(script, message, path, body, options, callback) {
                  options = script.allowedOptions(options, 'grant')
                  if (_.isString(path)) {
                    path = normalizeObjectPath(path.replace(/\//g, '.'))
                    body = pathToPayload(path, body)
                  } else {
                    body = _.isObject(path) ? path : {}
                    options = body
                    path = null
                  }
                  const opAc = copyAc(script, pathTo(options, 'grant'), 'post')
                  opAc.singlePath = path
                  script.attachedSubject.aclWrite(opAc, body, function(err) {
                    callback(err)
                  })
                },
                delete: function(script, message, path, options, callback) {
                  options = script.allowedOptions(options, 'grant')
                  if (!_.isString(path)) {
                    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'A string property path is required.' }))
                  }
                  path = normalizeObjectPath(path.replace(/\//g, '.'))
                  const opAc = copyAc(script, pathTo(options, 'grant'), 'put')
                  script.attachedSubject.aclRemove(opAc, path, function(err) {
                    callback(err)
                  })
                },
                patch: function(script, message, path, options, callback) {
                  callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot patch context' }))
                },
                setOwner: function(script, message, path, options, callback) {
                  callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot setOwner on context' }))
                }
              })
            }

          }

          Object.assign(result, { ac: triggerAc, script: scriptModel })
          triggerResults.executions.push(result)

          executor = promised(this, '_execute', triggerAc, parentScript, scriptModel, scriptOptions, extend(runtimeArguments, contextDocs))
            .then(results => {
              if (inline && results === false) {
                throw Fault.create('cortex.error.triggerCancelled')
              }
              Object.assign(result, { err: null, results })
            })
            .catch(err => {
              Object.assign(result, { err, results: null })
              return err
            })
            .then(err => {
              if (inline) {
                if (_.isFunction(options.fnEach)) {
                  const { ac, err, inline, results, script: model } = result,
                        { script, results: scriptResult, sandboxStats } = results || {}
                  options.fnEach({ ac, err, inline, result: scriptResult, sandboxStats, model, script, runtimeArguments })
                }
                if (err) {
                  throw err
                }
              }
            })

          if (inline) {
            await executor
          }

        }

      })
      .then(() => callback(null, triggerResults))
      .catch(err => callback(err, triggerResults))

  }

  compile(ac, type, filename, source, callback) {

    const options = {
      compile: true,
      source,
      configuration: {
        filename: rString(filename, '').replace(/[\s\t\n\r]/g, '_'),
        type
      }
    }

    this._pool.schedule(
      ac,
      null,
      options,
      (poolScript, callback) => {
        callback()
      },
      (err, results) => callback(err, results)
    )

  }

  loadIncludes(ac, scriptModel, callback) {

    callback = profile.fn(callback, 'sandbox.loadIncludes')

    ac.org.getRuntime()
      .then(async runtime => {

        const includes = {},
              { libraries } = runtime,
              queue = toArray(scriptModel.runtime ? scriptModel.runtime.requires : scriptModel.requires).slice(),
              { runtimeContext } = scriptModel

        // runtime libraries are loaded via require. include to prevent api <-> sandbox
        if (runtimeContext) {
          const { metadata: { scriptExport } = {} } = runtimeContext
          if (scriptExport) {
            includes[scriptExport] = this.getExecutableSource(ac, scriptModel)
          }
        }

        while (queue.length) {

          const include = queue.pop(),
                library = libraries.find(library => library.configuration.export === include || equalIds(library.metadata.scriptId, include))

          if (library) {
            const { configuration, metadata: { requires } } = library
            if (!isSet(includes[include])) {
              try {
                const script = await this.getRuntimeModel(ac.org, runtime, library)
                includes[configuration.export] = this.getExecutableSource(ac, script)
                queue.push(...requires)
              } catch (err) {
                includes[configuration.export] = {
                  source: '',
                  format: 'source'
                }
              }
            }
          }

        }

        return includes

      })
      .then(includes => callback(null, includes))
      .catch(() => callback(null, {}))

  }

  _execute(ac, parentScript, scriptModel, scriptOptions, runtimeArguments, callback) {

    if (!scriptModel.constructor.objectTypeName === scriptModel.type) {
      callback(Fault.create('cortex.error.unspecified', { reason: 'Script type mistmatch.' }), {})
    }

    this.loadIncludes(ac, scriptModel, (err, includes) => {

      if (err) {
        return callback(err)
      }

      scriptOptions.includes = includes
      scriptOptions.parentScript = parentScript

      scriptModel.createOptions(ac, scriptOptions, runtimeArguments)
        .then(poolScriptOptions => {

          this._pool.schedule(
            ac,
            parentScript,
            poolScriptOptions,
            (poolScript, callback) => { // <-- called once scheduled to run.

              if (poolScript.stealthy) {
                return callback()
              }

              const { Transaction } = models

              Transaction.create({
                org: ac.orgId,
                type: Transaction.Types.ScriptRun,
                timeout: new Date(Date.now() + poolScript.configuration.timeoutMs + config('sandbox.reaperTimeoutMs')).getTime(),
                state: Transaction.EnumStates.Started,
                principal: ac.principalId,
                originalPrincipal: ac.option('originalPrincipal') || ac.principalId,
                scriptId: scriptModel._id,
                scriptType: scriptModel.type,
                reqId: ac.reqId || createId()
              }, function(err, _tx) {
                if (!err) {
                  poolScript.__tx = _tx
                }
                callback(err)
              })

            },
            (err, results, poolScript, sandboxStats) => {

              if (poolScript && poolScript.stealthy) {
                return callback(err, { results, script: poolScript, sandboxStats })
              }
              if (poolScript && poolScript.__tx) {
                poolScript.__tx.remove()
                poolScript.__tx = null
              }

              if (!sandboxStats) {
                const now = new Date()
                sandboxStats = { begin: now, end: now }
              }
              const { Log, Stat } = models,
                    startingPeriod = new Date(sandboxStats.end),
                    endingPeriod = new Date(startingPeriod.getTime()),
                    runtimeContext = scriptModel.runtimeContext,
                    scriptId = (runtimeContext && runtimeContext.metadata.scriptId) || scriptModel._id,
                    scriptType = runtimeContext ? runtimeContext.type : scriptModel.type

              let find,
                  update,

                  log = new Log({
                    req: ac.reqId,
                    org: ac.orgId,
                    adr: (ac.req instanceof http.IncomingMessage) ? aton(getClientIp(ac.req)) : Undefined,
                    beg: sandboxStats.begin,
                    end: sandboxStats.end,
                    src: consts.logs.sources.script,
                    in: rInt(pathTo(sandboxStats, 'bytesIn'), 0),
                    out: rInt(pathTo(sandboxStats, 'bytesOut'), 0),
                    pid: ac.principalId,
                    oid: ac.option('originalPrincipal') || ac.principalId,
                    exp: new Date(Date.now() + (86400 * 1000 * 30)),
                    lvl: err ? consts.logs.levels.error : consts.logs.levels.info,
                    sid: scriptId,
                    stp: scriptType,
                    ops: rInt(pathTo(sandboxStats, 'ops'), 0),
                    ctt: rInt(pathTo(sandboxStats, 'callouts'), 0),
                    cms: rInt(pathTo(sandboxStats, 'calloutsMs'), 0)
                  })

              if (err) {
                err.$__logged = true
                const e = toJSON(err)
                log.sts = e.status
                if (_.isString(e.trace)) {
                  log.trc = Log._getTrace(e.trace)
                }
                log.err = e
              } else {
                log.err = log.err.faults = Undefined
              }
              if (!log.trc || log.trc.length === 0) {
                log.trc = Undefined
              }
              log.dat = {
                runtime: !!scriptModel.runtimeContext,
                resource: pathTo(scriptModel.runtimeContext, 'metadata.resource') || Undefined
              }
              log = log.toObject()
              Log.collection.insertOne(log, function(err) {
                if (err) {
                  logger.error('error adding log record', err.toJSON())
                }
              })

              // update statistics for this period. request period are 1 hour.

              startingPeriod.setMinutes(0, 0, 0)
              endingPeriod.setMinutes(59, 59, 999)

              // scripts can now share runtime types, so the query must be expanded to script type.
              find = { org: ac.orgId, code: consts.stats.sources.scripts, starting: startingPeriod, ending: endingPeriod, scriptId, scriptType }

              update = {
                $setOnInsert: { org: ac.orgId, starting: startingPeriod, ending: endingPeriod, code: consts.stats.sources.scripts, scriptId, scriptType },
                $inc: { ms: sandboxStats.end - sandboxStats.begin, in: log.in, out: log.out, callouts: log.ctt, calloutsMs: log.cms, ops: log.ops, count: 1 }
              }

              if (err) {
                update.$inc.errs = 1
              }

              Stat.collection.updateOne(find, update, { upsert: true }, function(err) {
                if (err) logger.error('failed to update script stat', update)
              })

              callback(err, { results, script: poolScript, sandboxStats })

            }
          )

        })

    }

    )

  }

  executeModel(ac, parentScript, scriptModel, scriptOptions, runtimeArguments, callback) {

    if (_.isFunction(scriptOptions)) {
      callback = scriptOptions
      runtimeArguments = {}
      scriptOptions = {}
    } else if (_.isFunction(runtimeArguments)) {
      callback = runtimeArguments
      runtimeArguments = {}
    } else {
      scriptOptions = scriptOptions || {}
      runtimeArguments = runtimeArguments || {}
    }

    this._execute(ac, parentScript, scriptModel, scriptOptions, runtimeArguments, callback)

  }

  createRemoteApi(ins) {

    return apis.createRemoteApi(ins)
  }

  async requireScript(ac, include) {

    const runtime = await ac.org.getRuntime(),
          { libraries } = runtime,
          library = libraries.find(library => library.configuration.export === include || equalIds(library.metadata.scriptId, include))

    if (!library) {
      throw Fault.create('cortex.notFound.script', { path: include, resource: `script#library.configuration.export(${include})` })
    }

    return this.getRuntimeModel(ac.org, runtime, library)

  }

  async getRuntimeModel(org, runtime, object, { type = null, document = null, requireActive = false, matchEnvironment = false } = {}) {

    const cache = modules.cache.memory.get('cortex.sandbox.transpiled'),
          { metadata } = object,
          { scriptId, scriptExport, scriptHash, runtime: isRuntime } = metadata,
          library = isRuntime && toArray(runtime.libraries).find(library => equalIds(library.metadata.scriptId, scriptId) && library.configuration.export === scriptExport),
          Model = models.getModelForType('Script', (isRuntime ? library.type : type) || object.type)

    let compiled = scriptHash && cache.get(scriptHash),
        localHash = scriptHash,
        find = { _id: scriptId, reap: false }

    if (requireActive) {
      find.active = true
    }

    if (scriptExport && !library) {
      throw Fault.create('cortex.notFound.script', { resource: `script#${Model.objectTypeName}._id(${scriptId})` })
    }

    if (!compiled) {

      let script = document || await Model.findOne(find).select('environment script language compiled compiledHash').lean().exec(),
          scriptHash = script && script.compiledHash,
          source = script && ((script.language === 'javascript/es5' && !script.compiled) ? script.script : script.compiled)

      if (!script || (matchEnvironment && !matchesEnvironment(script.environment)) || !source) {
        throw Fault.create('cortex.notFound.script', { resource: `script#${Model.objectTypeName}._id(${scriptId})` })
      }
      if (!localHash || localHash !== scriptHash) {
        localHash = createHash('sha256').update(source).digest('hex')
      }

      compiled = source
      cache.set(localHash, source)

    }

    return Object.assign(
      new Model({
        ...(isRuntime ? library : object),
        _id: scriptId,
        org: org._id,
        object: 'script',
        compiled
      }),
      // this has to be assigned directly on the instance as an ad-hoc property after initialization
      {
        runtimeContext: isRuntime ? object : null
      }
    )

  }

  wrapForExecution(doc, { runtime } = {}) {

    const isRuntime = runtime && runtime.metadata && runtime.metadata.runtime === true

    function source() {
      return doc.compiled || (`'use strict'; ${doc.script}`)
    }
    if (isRuntime) {

      const { scriptExport } = runtime.metadata
      if (scriptExport) {
        // have the sandbox require the module in-script to stash it in the module loader.
        return `function __sandbox(){return main(function main(require,exports,module){ require(${JSON.stringify(scriptExport)}) \n}, {runtime: ${JSON.stringify(runtime)} })}`
      } else {
        return `function __sandbox(){return main(function main(require,exports,module){${source()}\n}, {runtime: ${JSON.stringify(runtime)} })}`
      }
    } else if (doc.type === 'library') {
      return `function __sandbox(require,exports,module){${source()}\n}`
    }
    return `function __sandbox(){return main(function main(){${source()}\n})}`

  }

  getExecutableSource(ac, doc, { runtime } = {}) {

    // cannot currently store bytecode for runtime
    if (!runtime && doc && doc.optimized && ac.org.configuration.scripting.allowBytecodeExecution) {

      if (doc.bytecode && doc.bytecodeVersion === this.version) {

        const buffer = (Buffer.isBuffer(doc.bytecode) && doc.bytecode) || (Buffer.isBuffer(doc.bytecode.buffer) && doc.bytecode.buffer)
        if (buffer) {
          return {
            format: 'bytecode',
            source: buffer.toString('base64')
          }
        }

      } else {

        logger.info(`auto-updating bytecode for script ${doc._id} in ${ac.org.code}`)

        models.Script._loadForUpdate(ap.synthesizeOrgAdmin(ac.org), { _id: doc._id }, ['bytecode'], null, { skipAcl: true, grant: AccessLevels.System }, (err, ac) => {
          if (!err) {
            ac.subject.bytecode = Undefined
            ac.subject.markModified('bytecode')
            ac.subject.validateWithAc(ac, err => {
              if (!err) {
                ac.lowLevelUpdate(err => {
                  if (err && err.errCode !== 'cortex.conflict.sequencing') {
                    logger.warn(`Error caught trying to update bytecode for script ${doc._id} in ${ac.org.code}`)
                  }
                })
              }
            })

          }
        })
      }

    }

    return {
      format: 'source',
      source: this.wrapForExecution(doc, { runtime })
    }

  }

  async fulfillsConditions(ac, resource, { runtime, context, runtimeArguments, parentScript } = {}) {

    const { org } = ac

    let { if: expression } = resource,
        passed = !isSet(expression)

    try {

      if (isSet(expression)) {

        expression = await expressions.getRuntime(org, expression, { runtime, type: 'expression' })
        expression.registerVariable()

        const { metadata: { scriptId }, type, label } = resource,

              ec = expressions.createContext(
                ac,
                expression,
                {
                  $$ROOT: context,
                  $$SCRIPT: await this.getEnvironmentScript(ac, { _id: scriptId, type, label }, { runtime, parentScript, runtimeArguments })
                }
              )

        passed = await ec.evaluate()

      }

    } catch (err) {

      models.Log.logApiErr(
        'api',
        Fault.from(err, null, true),
        ac,
        {
          operation: 'sandbox.condition.if',
          resource
        }
      )

    }

    return passed

  }

  async getEnvironmentScript(ac, { _id, type, label }, { runtime, parentScript, runtimeArguments }) {

    runtime = runtime || await ac.org.getRuntime() || {}

    const { org } = ac,
          { env: { POD_NAME } = {} } = process,
          version = API_VERSION,
          envs = toArray(runtime.envs).reduce((memo, { name, value }) => Object.assign(memo, { [name]: value }), {})

    return {
      _id,
      depth: (parentScript ? parentScript.scriptExecutionDepth : 0) + 1,
      type,
      label,
      access: ac.resolved,
      principal: ac.principal.toObject(),
      org: {
        _id: org._id,
        code: org.code,
        object: 'org'
      },
      arguments: toJSON(runtimeArguments || {}),
      config: {
        query: {
          defaultMaxTimeMS: config('query.defaultMaxTimeMS'),
          minTimeMS: config('query.minTimeMS'),
          maxTimeMS: config('query.maxTimeMS')
        }
      },
      env: {
        ...envs,
        version,
        tag: version !== config('tag') ? config('tag') : Undefined,
        image: version !== config('image') ? config('image') : Undefined,
        url: 'https://' + config('server.apiHost') + '/' + org.code + '/v2',
        name: config('app.env') || 'development',
        domain: config('app.domain') || 'medable',
        host: config('server.apiHost'),
        server: (config('sandbox.showPodName') && POD_NAME) ? POD_NAME : Undefined
      }
    }

  }

}

module.exports = new SandboxModule()

// helpers ----------------------------------------------------

function copyAc(script, grant, method) {

  const comment = script.ac.comment,
        ac = script.ac.copy(comment ? script.ac.post : script.attachedSubject, {}, true)
  if (comment) {
    ac.comment = comment
  }
  ac.grant = Math.min(fixAllowLevel(grant, true), AccessLevels.Delete)
  ac.method = method
  if (!ac.script) {
    ac.script = script
  }
  // @hack. copy hooks so changes triggered from a script are caught.
  ac.$__hooks = pathTo(script.ac.$__parentAc, 'apiHooks') || script.ac.apiHooks
  ac.$__idx_rebuilds = pathTo(script.ac.$__parentAc, 'indexRebuilds') || script.ac.indexRebuilds
  return ac
}
