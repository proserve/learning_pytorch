'use strict'

const { getIdOrNull, uniqueIdArray, array: toArray, profile, inIdArray, walk, equalIds } = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../../acl'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      { MemoryCache } = require('cortex-service/lib/memory-cache')

// ---------------------------------------------------------------------------------------------------------------------

class ExpansionPointer {

  constructor(ac, parentDoc, doc, node, grant, selection, id, singlePath, singleCursor, singleOptions, singleCallback, pacl, instanceRoles, defaultAcl, defaultAclOverride, accessTransforms, document, selectionMap) {
    this.parentAc = ac
    this.grant = grant
    this.id = id
    this.parentDoc = parentDoc
    this.doc = doc
    this.node = node
    this.json = undefined
    this.ac = undefined
    this.resourcePath = ac.getResource()
    this.disposed = false
    this.selection = selection
    this.singlePath = singlePath
    this.singleCursor = singleCursor
    this.singleOptions = singleOptions
    this.singleCallback = singleCallback
    this.pacl = toArray(pacl)
    this.roles = toArray(instanceRoles)
    this.defaultAcl = defaultAcl
    this.defaultAclOverride = defaultAclOverride
    this.accessTransforms = accessTransforms
    this.document = document
    this.selectionMap = selectionMap
  }

  toString() {
    return this.id ? this.id.toString() : undefined
  }

  toJSON() {
    logger.error('ExpansionPointer jsonified: reqId: ' + this.ac && this.ac.reqId)
    return undefined
  }

  async resolve(q, entry, selectionMap) {

    if (this.disposed) {
      throw Fault.create('cortex.error.unspecified', { reason: 'Expansion pointer disposed.' })
    }

    const document = this.document || entry.documentMap.get(this.id.toString())

    // if the document does not exist, replace json with a fault. but only in lists.
    if (!document) {

      if (this.parentAc && this.parentAc.passive) {
        return
      }

      const err = Fault.create('cortex.notFound.expansionContext', { resource: this.resourcePath }),
            propPath = this.selection.propPath,
            fullPath = this.selection.fullPath
      if (propPath === fullPath || (propPath + '.').indexOf(fullPath) === 0) {
        throw err
      }
      this.json = err.toJSON()
      this.json._id = this.id

    } else {

      // let the queue resolve group reads.
      this.selection.setOption('deferGroupReads', true)

      const options = {
              selectionTree: this.selection,
              grant: this.grant,
              pacl: this.pacl,
              roles: this.roles,
              document: document,
              singlePath: this.singlePath,
              singleCursor: this.singleCursor,
              singleOptions: this.singleOptions,
              singleCallback: this.singleCallback,
              req: q.req,
              script: q.script,
              passive: this.parentAc.passive,
              locale: this.parentAc.getLocale(false, false), // set locale only if explicitly set in the current context
              parser: selectionMap.parser,
              defaultAcl: toArray(this.defaultAcl),
              defaultAclOverride: this.defaultAclOverride,
              selections: selectionMap.selections,
              readThroughPath: (this.parentAc.readThroughPath || '') + (`/${this.parentAc.getPath().replace(/\./g, '/')}` || ''),
              resourcePath: this.resourcePath,
              initReadPath: { prefix: this.node.docpath, object: false, _id: false },
              unindexed: this.parentAc.unindexed,
              eq: q
            },
            { principal: transformedPrincipal } = await this.node.transformAccessContext(new acl.AccessContext(q.principal, document), this.parentDoc)

      return new Promise((resolve, reject) => {

        entry.object.aclReadOne(transformedPrincipal, this.id, options, (err, json, ac) => {
          if (!err) {
            if (this.disposed) {
              err = Fault.create('cortex.error.unspecified', { resource: this.resourcePath, reason: 'Expansion pointer disposed.' })
            } else {
              this.json = json
              this.ac = ac
            }
          }
          err ? reject(err) : resolve()
        })

      })

    }
  }

  dispose() {
    this.selectionMap.pointers.delete(this)
    this.parentAc = this.doc = this.node = this.ac = this.json = this.selection = this.id = this.document = undefined
    this.disposed = true
  }

}

// ---------------------------------------------------------------------------------------------------------------------

class ExpansionQueue {

  constructor(principal, req, script) {

    const cfg = config('caches.ExpansionQueue')

    this.objects = new Map()
    this.principal = principal
    this.req = req
    this.script = script
    if (cfg.enabled) {
      this.cache = new MemoryCache(cfg)
      if (this.cache.withEvents) {
        this.cache.on('set', (cache, keys) => logger.silly(`[cache] ExpansionQueue setting ${JSON.stringify(keys)}`))
        this.cache.on('full', (cache, keys) => logger.silly(`[cache] ExpansionQueue cache is too full to add  ${JSON.stringify(keys)}`))
        this.cache.on('add', (cache, keys) => logger.silly(`[cache] ExpansionQueue adding ${JSON.stringify(keys)}`))
        this.cache.on('flush', (cache, keys) => keys ? logger.silly(`[cache] ExpansionQueue flushing ${JSON.stringify(keys)}`) : logger.silly(` [cache]ExpansionQueue flushed`))
        this.cache.on('remove', (cache, keys) => logger.silly(`[cache] ExpansionQueue removed ${JSON.stringify(keys)}`))
      }
    }

  }

  static create(principal, req, script, queue) {

    const q = new ExpansionQueue(principal, req, script)
    if (queue && queue.req === req && queue.script === script && config('caches.ExpansionQueue.shared') && equalIds(queue.principal._id, principal._id)) {
      q.cache = queue.cache
    }
    return q

  }

  add(ac, parentDoc, doc, node, selection, objectId, id, singlePath, singleCursor, singleOptions, singleCallback, grant, pacl, instanceRoles, defaultAcl, defaultAclOverride, accessTransforms, document) {

    const signature = selection && selection.signature

    // find the object group. group by object in order to make sweeping calls across documents. we'll be skipping
    // acl and granting rights on each read based on doc+node.
    let expansionObject = this.objects.get(objectId.toString()),
        pointer,
        selectionMap

    if (!expansionObject) {
      expansionObject = {
        object: null,
        selectionMaps: new Map(),
        documentMap: new Map()
      }

      this.objects.set(objectId.toString(), expansionObject)
    }

    selectionMap = expansionObject.selectionMaps.get(signature)
    if (!selectionMap) {
      selectionMap = {
        selection_prototype: selection,
        pointers: new Set(),
        parser: null,
        selections: null
      }
      expansionObject.selectionMaps.set(signature, selectionMap)
    }

    pointer = new ExpansionPointer(ac, parentDoc, doc, node, acl.fixAllowLevel(grant, true, acl.AccessLevels.None), selection, id, singlePath, singleCursor, singleOptions, singleCallback, pacl, instanceRoles, defaultAcl, defaultAclOverride, accessTransforms, document, selectionMap)

    selectionMap.pointers.add(pointer)

    return pointer

  }

  /**
     * resolves the current expansion queue and replaces entries.
     */
  expand(json, callback) {

    if (this.objects.size) {
      callback = profile.fn(callback, 'ExpansionQueue.expand()')
    } else {
      return callback()
    }

    async.series(
      [

        // load objects
        async() => {
          for (const [objectId, entry] of this.objects) {
            if (!entry.object) {
              const start = profile.start()
              entry.object = await this.principal.org.createObject(objectId)
              profile.end(start, 'ExpansionQueue.expand()#createObject')
            }
          }
        },

        // load documents
        callback => {

          async.eachSeries(
            Array.from(this.objects.values()),
            (entry, callback) => {

              async.eachSeries(
                Array.from(entry.selectionMaps.entries()),
                ([signature, map], callback) => {

                  callback = profile.fn(callback, 'ExpansionQueue.expand()#mapping')

                  const start = profile.start(),
                        ids = this.cache ? [] : uniqueIdArray(Array.from(map.pointers).map(pointer => pointer.document ? null : pointer.id)),
                        selection = map.selection_prototype,
                        options = {
                          selectionTree: selection, // clone it?
                          skipAcl: true,
                          grant: acl.AccessLevels.Script,
                          req: this.req,
                          script: this.script,
                          limit: false,
                          allowNoLimit: true
                        }

                  if (this.cache) {
                    for (const pointer of map.pointers.values()) {
                      if (!pointer.document) {
                        const id = getIdOrNull(pointer.id)
                        if (id) {
                          const cached = this.cache.get(`document.${signature}.${id.toString()}`)
                          if (cached) {
                            profile.end(process.hrtime(), 'ExpansionQueue.expand()#cache.hit')
                            entry.documentMap.set(id.toString(), cached.document)
                            if (!map.parser) {
                              map.parser = cached.parser
                              map.selections = cached.selections
                            }
                          } else if (!inIdArray(ids, id)) {
                            profile.end(process.hrtime(), 'ExpansionQueue.expand()#cache.miss')
                            ids.push(id)
                          }
                        }
                      }
                    }
                  }

                  if (ids.length === 0) {
                    return callback()
                  }

                  options.internalWhere = { _id: { $in: ids } }

                  if (selection.projection) {
                    options.pipeline = [{
                      $project: selection.projection
                    }]
                  }

                  entry.object.aclLoad(this.principal, options, (err, documents, parser, selections) => {
                    profile.end(start, 'ExpansionQueue.expand()#aclLoad')
                    if (!err) {
                      map.parser = parser
                      map.selections = selections
                      for (const document of documents.data) {
                        if (document._id) {
                          if (this.cache) {
                            this.cache.set(`document.${signature}.${document._id.toString()}`, {
                              parser,
                              selections,
                              document
                            })
                          }
                          entry.documentMap.set(document._id.toString(), document)
                        }
                      }
                    }
                    callback(err)
                  })

                },
                callback
              )

            },
            callback
          )

        },

        // resolve pointers
        callback => {

          callback = profile.fn(callback, 'ExpansionQueue.expand()#resolve')

          async.eachSeries(
            Array.from(this.objects.values()),
            (entry, callback) => {
              const jsons = []
              async.eachSeries(
                Array.from(entry.selectionMaps.values()),
                (map, callback) => {
                  async.eachSeries(
                    Array.from(map.pointers),
                    async(pointer) => {
                      await pointer.resolve(this, entry, map)
                      jsons.push(pointer.json)
                    },
                    callback
                  )
                },
                err => {
                  if (err) {
                    return callback(err)
                  }
                  entry.object.schema.node.readGrouped(this.principal, jsons, this.req, this.script, callback)
                }
              )
            },
            callback
          )

        },

        // replace in host json
        callback => {

          callback = profile.fn(callback, 'ExpansionQueue.expand()#replace')

          walk(json, true, true, pointer => {
            if (pointer instanceof ExpansionPointer) {
              const json = pointer.json
              pointer.dispose()
              return json
            }
            return pointer
          })
          callback()
        }

      ],
      err => {
        callback(err)
      }
    )

  }

}

module.exports = ExpansionQueue
