'use strict'

const Worker = require('../worker'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      { promised } = utils,
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal')

class CascadeDeleterWorker extends Worker {

  get maxConcurrent() {
    return Math.max(20, modules.services.api.endpoints.length * 5)
  }

  parsePayload(message, payload, callback) {

    const tasks = []

    if (!utils.isPlainObject(payload)) {
      payload = {}
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cascade delete worker missing payload.' }))
    }

    payload.subject = utils.getIdOrNull(payload.subject)
    if (!payload.subject) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cascade delete missing subject.' }))
    }

    if (payload.oo !== true && !_.isArray(payload.properties)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cascade delete missing properties array.' }))
    }

    // load the org
    if (!modules.db.models.Org.isAclReady(payload.org)) {
      tasks.push(callback => {
        modules.db.models.Org.loadOrg(utils.getIdOrNull(payload.org, true), function(err, org) {
          payload.org = org
          callback(err)
        })
      })
    }

    // try to load the principal. fall back to anonymous
    tasks.push(callback => {
      ap.create(payload.org, utils.getIdOrNull(payload.principal), { type: acl.AccessTargets.Account }, (err, principal) => {
        void err
        payload.principal = principal || ap.synthesizeAnonymous(payload.org)
        callback(null)
      })
    })

    async.series(tasks, err => {
      callback(err, payload)
    })

  }

  logError(err, message, payload) {

    if (err) {
      logger.error('cascade-deleter', { err: err.toJSON(), subject: utils.getIdOrNull(payload.subject) })
      if (modules.db.models.Org.isAclReady(payload.org)) {
        const logged = Fault.from(err, null, true)
        logged.trace = logged.trace || 'Error\n\tnative cascade-deleter:0'
        modules.db.models.Log.logApiErr(
          'api',
          logged,
          new acl.AccessContext(
            ap.synthesizeAnonymous(payload.org),
            null,
            { req: message.req })
        )
      }
    }

  }

  /**
 * @param message
 * @param payload
 *     org
 *     principal
 *     subject
 *     properties {propertyId: 1, objectId: 1, propertyName: 1, slotName: 1, uniqueSlot: 1}}
 * @param options
 * @param callback
 * @private
 */
  _process(message, payload, options, callback) {

    this.parsePayload(message, payload, (err, payload) => {

      if (err) {
        this.logError(err, message, payload)
        return callback()
      }

      if (payload.oo) {
        this._processOos(message, payload, options)
          .then(result => callback(null, result))
          .catch(err => {
            if (err.errCode !== 'cortex.error.aborted') {
              this.logError(err, message, payload)
            }
            callback(err)
          })
        return
      }

      // group by object id so we can match multiple properties in a single query.
      const grouped = payload.properties.reduce((properties, property) => {

        if (!properties[property.objectId]) {
          properties[property.objectId] = []
        }
        properties[property.objectId].push(property)
        return properties
      }, {})

      async.eachSeries(Object.keys(grouped), (objectIdString, callback) => {

        if (message.cancelled) {
          return callback(Fault.create('cortex.error.aborted'))
        }

        payload.org.createObject(utils.getIdOrNull(objectIdString), (err, object) => {

          if (err) {
            this.logError(err, message, payload)
            return callback()
          }

          if (message.cancelled) {
            return callback(Fault.create('cortex.error.aborted'))
          }

          const where = { $or: grouped[objectIdString].map((entry) => {
            const where = {}
            where[entry.propertyName] = payload.subject
            return where
          }) }

          let hasMore = true,
              limit = 1000,
              zeroPasses = 1 // allow another pass just to make sure

          async.whilst(
            function() {
              return hasMore
            },
            callback => {

              if (message.cancelled) {
                return callback(Fault.create('cortex.error.aborted'))
              } else if (!object.isDeletable && !object.canCascadeDelete) {
                hasMore = false
                return callback()
              }
              object.aclDeleteMany(
                payload.principal,
                where,
                {
                  forceAllowDelete: true,
                  skipAcl: true,
                  ignoreObjectMode: true,
                  grant: acl.AccessLevels.Delete,
                  limit: limit // forces a load before the delete and lets this process batch.
                },
                (err, deletedCount) => {
                  if (err) {
                    let fault = Fault.create('cortex.error.unspecified', { reason: 'cascade deleter failed to list usages for subject ' + payload.subject })
                    fault.add(err)
                    fault.trace = err.trace
                    this.logError(fault, message, payload)
                    hasMore = false
                    return callback()
                  }
                  if (deletedCount < limit) {
                    if (zeroPasses-- === 0) {
                      hasMore = false
                    }
                  } else {
                    zeroPasses = 1
                  }
                  callback()
                }
              )

            },
            err => {

              // allow this item to remain on the queue to be reprocessed.
              if (err && err.errCode === 'cortex.error.aborted') {
                return callback(err)
              }
              if (err) {
                this.logError(err, message, payload)
              }
              callback()
            }
          )

        })

      }, err => {

        if (err && err.errCode === 'cortex.error.aborted') {
          return callback(err)
        }

        if (err) {
          this.logError(err, message, payload)
        }

        callback()

      })

    })

  }

  /**
 * @param message
 * @param payload
 *  req: ac.reqId,
 *  org: ac.orgId,
 *  principal: ac.principalId,
 *  subject: ac.subjectId,
 *  object: ac.objectName

 * @returns {Promise<void>}
 * @private
 */

  async _processOos(message, payload) {

    const OutputObject = modules.db.models.oo,
          match = {
            'context._id': payload.subject,
            'context.object': payload.object,
            cascadeDelete: true
          }

    let hasMore = true,
        limit = 100,
        zeroPasses = 1 // allow another pass just to make sure

    while (hasMore) {

      if (message.cancelled) {
        throw Fault.create('cortex.error.aborted')
      }

      try {

        const deletedCount = await promised(
          OutputObject,
          'aclDeleteMany',
          payload.principal,
          match,
          {
            forceAllowDelete: true,
            skipAcl: true,
            ignoreObjectMode: true,
            grant: acl.AccessLevels.Delete,
            parserExecOptions: {
              engine: 'latest' // take advantage of compound index.
            },
            limit // forces a load before the delete and lets this process batch.
          }
        )

        if (deletedCount < limit) {
          if (zeroPasses-- === 0) {
            hasMore = false
          }
        } else {
          zeroPasses = 1
        }

      } catch (err) {

        let fault = Fault.create('cortex.error.unspecified', { reason: 'cascade deleter failed to list usages for subject ' + payload.subject })
        fault.add(err)
        fault.trace = err.trace
        this.logError(fault, message, payload)
        hasMore = false
      }

    }

  }

}

module.exports = CascadeDeleterWorker
