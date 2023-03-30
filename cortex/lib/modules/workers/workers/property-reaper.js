'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal')

/* @todo future

 - maintenance routine to check for dangling instances (where there are no matching objects)
 - maintenance routine to check on media that has no matching instance, post, or comment
 */

function PropertyReaperWorker() {
  Worker['call'](this)
}

util.inherits(PropertyReaperWorker, Worker)

/**
 * @param message
 * @param payload a string that revives to the following (see org.sendNotification)
 *      org                         // the org or org id.
 *      object                      // the object reaping target.
 * @param options
 * @param callback
 * @private
 */
PropertyReaperWorker.prototype._process = function(message, payload, options, callback) {

  const ObjectModel = modules.db.models.Object,
        start = new Date(),
        limit = 1

  let hasMore = true,
      updates = 0,
      request

  function cancel() {
    if (request) {
      request.cancel()
    }
  }
  message.once('cancel', cancel)

  async.doWhilst(

    callback => {

      if (message.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      ObjectModel.find({ reap: false, 'dataset.targetCollection': { $exists: false }, deletedProperties: { $exists: true, $ne: [] } }).select('_id org name lookup collection deletedProperties properties feedDefinition objectTypes dataset').lean().limit(limit).exec((err, objects) => {

        if (message.cancelled) {
          return callback(Fault.create('cortex.error.aborted'))
        }

        hasMore = !err && objects.length > 0
        if (err || objects.length === 0) {
          return callback(err)
        }
        updates += objects.length

        async.eachSeries(objects, (object, callback) => {

          if (message.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }

          // remove and query for only topmost properties and prepare parts by splitting;
          const props = object.deletedProperties.slice(),
                keys = props.map(p => p.fq).sort((a, b) => a.length - b.length)

          keys.forEach(path => {
            keys.filter(p => p.indexOf(path + '.') === 0).forEach(p => {
              let len = props.length
              while (len--) {
                if (props[len].fq === p) {
                  props.splice(len, 1)
                }
              }
            })
          })
          props.forEach(prop => {
            prop.parts = prop.fq.split('.').map((part) => {
              const propIsSet = !!~part.indexOf('#'),
                    isPropArray = !!~part.indexOf('[]'),
                    segParts = part.split('#')
              return {
                name: segParts[0].replace('[]', ''),
                discriminator: propIsSet ? segParts[1] : null,
                isArray: isPropArray,
                propIsSet: propIsSet
              }
            })
          })

          modules.db.connection.db.collection(utils.path(object, 'dataset.collection') || 'contexts', (err, collection) => {

            if (err) {
              return callback(err)
            }

            async.series([

              // mark context file facets
              callback => {
                request = this._markDeletedFacetProperties(object, collection, err => {
                  request = null
                  callback(err)
                })
              },

              // remove property data from individual instances.
              callback => {
                request = this._updateInstances(object, collection, props, err => {
                  request = null
                  callback(err)
                })
              },
              callback => {
                request = this._updateTypedInstances(object, collection, props, err => {
                  request = null
                  callback(err)
                })
              },
              callback => {
                request = this._updatePosts(object, props, err => {
                  request = null
                  callback(err)
                })
              },
              callback => {
                request = this._updateComments(object, props, err => {
                  request = null
                  callback(err)
                })
              },

              // remove property history
              callback => {
                request = this._reapPropertyHistory(object, props, err => {
                  request = null
                  callback(err)
                })
              },

              // remove processed properties from the object.
              callback => {
                modules.db.sequencedFunction(
                  function(callback) {

                    if (message.cancelled) {
                      return callback(Fault.create('cortex.error.aborted'))
                    }

                    ObjectModel.findOne({ _id: object._id, reap: false }).select('sequence locales').lean().exec((err, o) => {
                      if (err || !o) return callback(err)
                      // check for object definition locales
                      let locales = o.locales || {}
                      const removePropFromLocale = (ids, locales) => {
                        const items = Array.isArray(locales) ? locales : Object.keys(locales).map(k => locales[k])
                        for (let i = 0; i < items.length; i++) {
                          const prop = items[i]
                          if (Array.isArray(prop)) {
                            if (prop.length) {
                              removePropFromLocale(ids, prop)
                            }
                          } else if (utils.isPlainObject(prop)) {
                            if (ids.indexOf(prop._id.toString()) > -1) {
                              locales.splice(i, 1)
                              break
                            } else {
                              removePropFromLocale(ids, prop)
                            }
                          }
                        }
                      }
                      removePropFromLocale(object.deletedProperties.map(p => p._id.toString()), locales)

                      ObjectModel.collection['updateOne'](
                        { _id: o._id, reap: false, sequence: o.sequence },
                        { $set: { locales }, $inc: { sequence: 1 }, $pull: { deletedProperties: { _id: { $in: object.deletedProperties.map(p => p._id) } } } },
                        (err, result) => {
                          if (!err && result['matchedCount'] === 0) {
                            err = Fault.create('cortex.conflict.sequencing', { reason: '[property-reaper] pulling deleted properties' })
                          }
                          callback(err)
                        }
                      )
                    })
                  },
                  10,
                  callback
                )
              }

            ], callback)

          })

        }, callback)

      })
    },

    () => {
      return hasMore
    },

    err => {

      message.removeListener('cancel', cancel)

      if (err) {
        const logged = Fault.from(err, null, true)
        logged.trace = logged.trace || 'Error\n\tnative property-reaper:0'
        logger.error('property-reaper', { err: logged.toJSON(), doc: message.doc })
        modules.db.models.Org.loadOrg('medable', function(err, org) {
          if (!err) {
            modules.db.models.Log.logApiErr(
              'api',
              logged,
              new acl.AccessContext(
                ap.synthesizeAnonymous(org),
                null,
                { req: message.req })
            )
          }
        })
      } else {
        logger['info']('Ran property reaper on ' + updates + ' objects in ' + (Date.now() - start) + 'ms')
      }

      callback(err)

    }

  )

}

PropertyReaperWorker.prototype._markDeletedFacetProperties = function(object, collection, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        // because others manipulate the facets index, update one by one and sequenced
        // @todo multi-sequence updates @important
        updater = (collection, find, ids, callback) => {
          if (ids.length === 0) {
            return callback()
          }
          let hasMore = true
          async.whilst(
            () => hasMore,
            callback => {

              if (request.cancelled) {
                return callback(Fault.create('cortex.error.aborted'))
              }

              modules.db.sequencedFunction(
                function(callback) {
                  collection.find(find).limit(1).project({ _id: 1, org: 1, object: 1, facets: 1, sequence: 1 }).toArray((err, docs) => {
                    const doc = docs && docs[0]
                    hasMore = !err && !!doc
                    if (!hasMore) {
                      return callback(err)
                    }
                    doc.facets.forEach(facet => {
                      if (utils.inIdArray(ids, facet._pi)) {
                        facet._kl = true
                      }
                    })
                    collection.updateOne(
                      { _id: doc._id, reap: false, sequence: doc.sequence },
                      { $inc: { sequence: 1 }, $set: { facets: doc.facets } },
                      (err, result) => {
                        if (!err && result['matchedCount'] === 0) {
                          err = Fault.create('cortex.conflict.sequencing', { reason: '[property-reaper] marking deleted property facets' })
                        }
                        callback(err)
                      }
                    )
                  })
                },
                10,
                callback
              )
            },
            callback
          )

        }

  async.series([
    // mark every context with the property as _kl'd.
    callback => {
      const ids = object.deletedProperties.filter(p => p.file && p.fq.indexOf('context') === 0).map(p => p._id)
      updater(
        collection,
        { org: object.org, object: object.name, reap: false, facets: { $elemMatch: { _kl: false, _pi: { $in: ids } } } },
        ids,
        callback
      )
    },

    // mark every post/comment with the property as _kl'd.
    callback => {
      const ids = object.deletedProperties.filter(p => p.file && (p.fq.indexOf('post') === 0 || p.fq.indexOf('comment') === 0)).map(p => p._id)
      updater(
        modules.db.models.Post.collection,
        { org: object.org, $or: [{ 'context.object': object.name }, { 'pcontext.object': object.name }], reap: false, facets: { $elemMatch: { _kl: false, _pi: { $in: ids } } } },
        ids,
        callback
      )
    }
  ], callback)

  return request

}

PropertyReaperWorker.prototype._reapPropertyHistory = function(object, allProps, callback) {

  const propIds = allProps.map(p => p._id),
        collection = modules.db.models.history.collection,
        max = 1000,
        find = {
          org: object.org,
          object: object.name,
          type: null,
          'ops.pid': { $in: propIds },
          reap: false
        },
        request = {
          cancel: () => {
            this.cancelled = true
          }
        }

  if (propIds.length === 0) {
    setImmediate(callback)
    return request
  }

  let hasMore = true
  async.doWhilst(
    callback => {
      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }
      collection.find(find).project({ _id: 1 }).limit(max).toArray((err, docs) => {
        hasMore = !err && docs.length > 0
        if (!hasMore) {
          return callback(err)
        }
        collection.updateMany({ _id: { $in: docs.map(v => v._id) } }, { $set: { reap: true } }, callback)
      })
    },
    () => {
      return hasMore
    },
    callback
  )
  return request

}

PropertyReaperWorker.prototype._updateInstances = function(object, collection, allProps, callback) {

  const props = allProps.filter(p => p.parts[0].name === 'context' && p.parts[0].discriminator == null)
  return updateDocs(
    collection,
    props,
    {
      org: object.org,
      object: object.name,
      reap: false,
      $or: createPropertySelector(props)
    },
    callback
  )

}

PropertyReaperWorker.prototype._updateTypedInstances = function(object, collection, allProps, callback) {

  const props = allProps.filter(p => p.parts[0].name === 'context' && p.parts[0].discriminator != null)
  return updateDocs(
    collection,
    props,
    {
      org: object.org,
      object: object.name,
      reap: false,
      $or: createPropertySelector(props, (prop) => {
        return object.objectTypes.filter(p => p.name === prop.parts[0].discriminator)[0]
      })
    },
    callback
  )

}

PropertyReaperWorker.prototype._updatePosts = function(object, allProps, callback) {

  const props = allProps.filter(p => p.parts[0].name === 'post')
  return updateDocs(
    modules.db.models.Post.collection,
    props,
    {
      org: object.org,
      'context.object': object.name,
      reap: false,
      $or: createPropertySelector(props, (prop) => {
        return object.feedDefinition.filter(p => p.postType === prop.parts[0].discriminator)[0]
      })
    },
    callback
  )
}

PropertyReaperWorker.prototype._updateComments = function(object, allProps, callback) {

  const props = allProps.filter(p => p.parts[0].name === 'comment')
  return updateDocs(
    modules.db.models.Comment.collection,
    props,
    {
      org: object.org,
      'pcontext.object': object.name,
      reap: false,
      $or: createPropertySelector(props, (prop) => {
        return object.feedDefinition.filter(p => p.postType === prop.parts[0].discriminator)[0]
      })
    },
    callback
  )

}

// helpers ---------------------------------------------------------------------------------------------------------

function updateDocs(collection, props, find, callback) {

  const request = {
          cancel: () => {
            this.cancelled = true
          }
        },
        max = 1000,
        concurrent = 20,
        select = props.reduce((select, p) => {
          select[p.ip.split('.')[0]] = 1
          if (p.localized) {
            select['locales.' + p.ip.split('.')[0]] = 1
          }
          return select
        }, { _id: 1, sequence: 1 }) // always load all of the top level fields in case we're editing an array deep down.

  let hasMore = true

  if (props.length === 0) {
    setImmediate(callback)
    return request
  }

  async.doWhilst(

    callback => {

      if (request.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      collection.find(find).project({ _id: 1 }).limit(max).toArray((err, docs) => {

        hasMore = !err && docs.length > 0
        if (!hasMore) {
          return callback(err)
        }

        async.eachLimit(
          docs,
          concurrent,
          (doc, callback) => {
            if (request.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }
            sequencedUpdate(collection, props, select, doc._id, callback)
          },
          callback
        )
      })
    },
    () => {
      return hasMore
    },
    callback
  )

  return request

}

function createPropertySelector(props, fnTypeDiscriminator) {
  return props.reduce((props, prop) => {

    function create(parts) {

      const type = fnTypeDiscriminator ? fnTypeDiscriminator(prop) : null,
            obj = fnTypeDiscriminator ? { type: type ? type.name : null } : {}

      let curr = obj, key = [], strKey

      for (let i = 1; i < parts.length; i++) {

        const part = parts[i]

        key.push(part.name)

        if (part.discriminator) {

          strKey = key.join('.')
          key = []
          curr[strKey] = {
            $elemMatch: {
              name: part.discriminator // assume discriminatorKey is 'name'
            }
          }
          curr = curr[strKey].$elemMatch
        }

      }
      if (key.length) {
        strKey = key.join('.')
        curr[strKey] = { $exists: true }
      }
      return obj

    }

    props.push(create(prop.parts))
    if (prop.localized) {
      props.push(create([
        prop.parts[0],
        {
          name: 'locales',
          discriminator: null,
          isArray: false,
          propIsSet: false
        },
        ...prop.parts.slice(1)
      ]))
    }

    return props

  }, [])
}

function createUpdate(parts, depth, top, curr, fullpath, $unset) {

  const part = parts[depth]

  let prop = curr[part.name],
      updates = 0

  if (parts.length - 1 === depth) {

    if (!part.propIsSet) {

      if (curr === top) {
        $unset[part.name] = 1
      }
      delete curr[part.name]
      updates++

    } else if (part.isArray) {

      if (_.isArray(prop)) {
        let len = prop.length
        while (len--) {
          if (utils.isPlainObject(prop[len]) && prop[len].name === part.discriminator) {
            prop.splice(len, 1)
            updates++
          }
        }
      }

    } else {

      if (utils.isPlainObject(prop) && prop.name === part.discriminator) {
        if (curr === top) {
          $unset[part.name] = 1
        }
        delete curr[part.name]
        updates++
      }
    }

  } else {

    if (part.isArray) {

      if (_.isArray(prop)) { // only process if the value is an actual array.
        prop.forEach(function(el, i) {
          if (utils.isPlainObject(el)) {
            if (!part.propIsSet || el.name === part.discriminator) {
              updates += createUpdate(parts, depth + 1, top, prop[i], createPath(fullpath, part.name, i), $unset)
            }
          }
        })
      }
    } else {
      if (utils.isPlainObject(prop)) {
        if (!part.propIsSet || prop.name === part.discriminator) {
          updates += createUpdate(parts, depth + 1, top, prop, createPath(fullpath, part.name), $unset)
        }
      }
    }

  }

  return updates

}

function sequencedUpdate(collection, props, select, _id, callback) {

  modules.db.sequencedFunction(
    function(callback) {
      collection.find({ _id: _id, reap: false }).limit(1).project(select).toArray((err, docs) => {
        const doc = docs && docs[0],
              sequence = doc && doc.sequence,
              $unset = {},
              update = { $inc: { sequence: 1 } }

        if (err || !doc) {
          return callback(err)
        }

        let updates = 0

        // drill down and update the doc.
        props.forEach(prop => {
          updates += createUpdate(prop.parts, 1, doc, doc, '', $unset)
          if (prop.localized) {
            updates += createUpdate([
              { name: 'locales', discriminator: null, isArray: false, propIsSet: false },
              ..._.rest(prop.parts)
            ], 0, doc, doc, '', $unset)
          }

        })

        if (updates === 0) {
          // @todo. mitigate. this is bad. it could mean running forever.
          // @todo implement number of tries?
          return callback(Fault.create('cortex.conflict.sequencing', { reason: '[property-reaper] pulling deleted properties. running forever?!' }))
        }

        delete doc.sequence
        delete doc._id

        if (Object.keys(doc).length) {
          update.$set = doc
        }
        if (Object.keys($unset).length) {
          update.$unset = $unset
        }

        // logger.silly('property-reaper-update', JSON.stringify(update, null, 4));

        collection.updateOne(
          { _id: _id, reap: false, sequence: sequence },
          update,
          (err, result) => {
            if (!err && result['matchedCount'] === 0) {
              err = Fault.create('cortex.conflict.sequencing', { reason: '[property-reaper] sequenced update' })
            }
            callback(err)
          }
        )
      })
    },
    20,
    callback
  )

}

function createPath() {
  let out = ''
  for (let i = 0; i < arguments.length; i++) {
    out += (out ? '.' : '') + arguments[i]
  }
  return out
}

module.exports = PropertyReaperWorker
