'use strict'

const modules = require('../modules'),
      utils = require('../utils'),
      { encodeME } = utils,
      consts = require('../consts'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      mongooseUtils = require('mongoose/lib/utils'),
      Audit = modules.db.models.Audit,
      _ = require('underscore'),
      crypto = require('crypto'),
      IncomingMessage = require('http').IncomingMessage,
      onFinished = require('on-finished'),
      API_REGEX = /^\/([^/?]*)/,
      requestCache = modules.cache.memory.add('cortex.audit.requests')

let Undefined

class AuditModule {

  constructor() {
    throw new TypeError('Not Creatable')
  }

  /**
   *
   * @param ac access context or principal
   * @param categoryName
   * @param subcategoryName
   * @param options
   *  err // an error
   *  context // force a context object or _id instead of using ac.subject.
   *  metadata // additional metadata
   * @param callback
   * @returns {*}
   */
  static recordEvent(ac, categoryName, subcategoryName, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const [category, subCategory] = this.findCategory(categoryName, subcategoryName),
          auditPrincipal = ac.option('auditPrincipal') || ac.principal

    let reqId = utils.getIdOrNull(ac.reqId)

    if (!category || !subCategory) {
      return callback()
    } else if (!reqId) {
      reqId = utils.createId()
    }

    async.parallel({

      // insert the event ----------------------------------------

      eventId: callback => {

        modules.db.sequencedFunction(
          callback => {

            const doc = new Audit({
              org: ac.orgId,
              object: Audit.objectName,
              type: null,
              reap: false,
              req: reqId,
              principal: auditPrincipal._id,
              ipv4: utils.rInt(utils.aton(utils.getClientIp(ac.req)), 0),
              cat: categoryName,
              sub: subcategoryName,
              ac,
              err: options.err,
              metadata: options.metadata,
              context: {
                object: utils.path(options.context, 'object') || ac.objectName || null,
                _id: utils.path(options.context, '_id') || ac.subjectId || null
              }
            })

            ac.copy(doc, { object: null }).save(err => {
              if (err) {
                if (err.errCode !== 'cortex.conflict.sequencing') {
                // unexpected error. log and retry.
                  logger.error('[audit] error inserting audit record.', utils.toJSON(err, { stack: true }))
                  err = Fault.create('cortex.conflict.sequencing')
                }
              }
              callback(err, doc._id)
            })
          },

          10,

          (err, eventId) => {

            // this is bad. @todo store the audit event somewhere else? how do we do that in a compliant way?
            if (err) {
              logger.error('[audit] failed to store audit event!', utils.toJSON(err, { stack: true }))
            }

            callback(err, eventId)

          }
        )

      },

      // record request metadata for each event. ----------------------------------------

      requestId: callback => {

        // use sequencing in the event anything ever gets edited in audits by the system,
        // at the cost of an extra dip. to avoid a dip, use a local cache to store request information.

        const incoming = ac.req instanceof IncomingMessage

        modules.db.sequencedFunction(

          callback => {

            const cacheKey = reqId.toString(),
                  cached = requestCache.get(reqId)
            if (cached) {
              return callback()
            }

            Audit.findOne({ _id: reqId }).select(Audit.requiredAclPaths.join(' ')).exec((err, doc) => {

              if (err) {

                // unexpected error. try again.
                logger.error('[audit] error lookup up audit request metadata.', utils.toJSON(err, { stack: true }))
                callback(Fault.create('cortex.conflict.sequencing'))

              } else if (doc) {

                callback()

              } else {

                const req = ac.req,
                      metadata = {
                        incoming
                      },
                      doc = new Audit({
                        _id: reqId,
                        principal: ((incoming && req.principal) || ac.principal)._id,
                        ipv4: utils.rInt(utils.aton(utils.getClientIp(ac.req)), 0),
                        org: ac.orgId,
                        object: Audit.objectName,
                        type: null,
                        reap: false,
                        req: reqId,
                        cat: 'metadata',
                        sub: 'request',
                        ac,
                        metadata,
                        context: {
                          object: 'account',
                          _id: ((incoming && req.principal) || ac.principal)._id
                        }
                      })

                if (incoming) {

                  metadata.url = req.path

                  if (req.bearerToken) {
                    metadata.token = crypto.createHash('md5').update(req.bearerToken).digest('hex')
                  }
                  if (req.session) {
                    metadata.session = crypto.createHash('md5').update(req.session.id).digest('hex')
                    if (req.session.location) {
                      metadata.device = req.session.location._id
                    }
                  }

                  if (utils.isPlainObject(req.query)) {
                    const query = _.without(req.query, '_')
                    if (Object.keys(query).length > 0) {
                      metadata.query = query
                    }
                  }
                  {
                    // if the route starts with :objects, we want to replace it with the object from the url.
                    let route = utils.rString(utils.path(ac.req, 'scriptRoute') || utils.path(ac.req, 'route.path') || '/', '/')
                    const prefix = '/:objects'
                    if (route.indexOf(prefix) === 0) {
                      const object = utils.array(req.url.match(API_REGEX))[1] || ''
                      route = '/' + object + route.substr(prefix.length)
                    }
                    metadata.route = route
                  }

                  {
                    const key = req.orgClient && req.orgClient.key
                    if (key && key !== config('webApp.apiKey')) {
                      metadata.apiKey = key
                    }
                  }

                  metadata.method = req.method

                }

                // copy the parent access context to obey things like dryRun and chaining.
                ac.copy(doc, { object: null }).save(err => {
                  const inserted = !err
                  if (err) {
                    if (err.errCode !== 'cortex.conflict.sequencing') {
                      if ((err.errCode === 'cortex.conflict.duplicateKey' && err.path === 'audit._id') ||
                          (err.errCode === 'cortex.invalidArgument.validation' && utils.path(err, 'faults.0.errCode') === 'cortex.conflict.duplicateKey')
                      ) {
                        err = null
                      } else {
                        // this is an unexpected error. log and retry.
                        logger.error('[audit] error inserting request metadata.', utils.toJSON(err, { stack: true }))
                        err = Fault.create('cortex.conflict.sequencing')
                      }
                    }
                  }
                  requestCache.set(cacheKey, err ? Undefined : reqId)
                  callback(err, inserted)
                })

              }

            })

          },

          10,

          (err, inserted) => {

            if (err) {
              logger.error(`[audit] failed to store audit request metadata for ${reqId}`, utils.toJSON(err, { stack: true }))
            }

            // when inserted, start listening for the request end and record status when done
            if (!err && inserted && incoming && ac.req.res) {
              onFinished(ac.req.res, (err, res) => {
                void err
                modules.db.sequencedUpdate(Audit, { _id: reqId }, { $set: { 'metadata.status': res.statusCode, 'metadata.ended': new Date() } })
              })
            }

            callback(err, reqId)
          }
        )

      }

    }, (err, results) => {

      callback(err, results && results.eventId)

    })

  }

  static updateEvent(_id, doc, callback) {

    [doc, callback] = utils.resolveOptionsCallback(doc, callback)

    if (doc.err) {

      const err = encodeME(utils.toJSON(Fault.from(doc.err)))
      if (err && err.stack) {
        delete err.stack // NEVER include the stack in an audit record.
      }
      doc.err = err
    } else {
      delete doc.err
    }

    if (doc.metadata) {
      doc.metadata = encodeME(doc.metadata)
    } else {
      delete doc.metadata
    }

    if (!(_id && Object.keys(doc).length > 0)) {
      return callback()
    }

    doc = mongooseUtils.clone(doc)

    modules.db.sequencedUpdate(
      Audit,
      { _id },
      {
        $set: doc
      },
      {
        select: '_id'
      },
      err => {
        callback(err)
      }
    )

  }

  /**
   *
   * @param cat
   * @param sub
   * @returns {boolean}
   */
  static findCategory(cat, sub = null) {

    const category = consts.audits.categories[cat]

    return [
      category,
      category && category.subs[sub]
    ]

  }

}

module.exports = AuditModule
