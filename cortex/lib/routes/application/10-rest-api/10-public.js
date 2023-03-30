'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      models = modules.db.models,
      utils = require('../../../utils'),
      acl = require('../../../acl'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      ap = require('../../../access-principal'),
      { formatLocaleToCortex } = require('../../../modules/i18n/i18n-utils')

module.exports = function(express, router) {

  const localizeProps = (localizedProp, locale = 'en_US') => {
          const label = localizedProp && localizedProp['label'] && (localizedProp['label'].find(l => l.locale === locale) || localizedProp['label'].find(l => l.locale === 'en_US')),
                description = localizedProp && localizedProp['description'] && (localizedProp['description'].find(l => l.locale === locale) || localizedProp['description'].find(l => l.locale === 'en_US'))
          return { label, description }
        },
        walkProperties = (object, locales, locale, properties) => {
          object.properties.forEach(p => {
            const currentProp = properties.find(prop => prop.name === p.name)
            if (currentProp) {
              const localizedProp = locales && locales.find(l => utils.equalIds(l._id, currentProp._id)),
                    { label, description } = (localizedProp && localizeProps(localizedProp, locale)) || {}
              p.label = label ? label.value : p.label
              p.description = description ? description.value : p.description
            }
          })
        },
        localizeSchema = (schema, locale = 'en_US', doc) => {
          const parsedSchema = JSON.parse(schema)
          if (parsedSchema.locales && doc.localized) {
            const { label, description } = localizeProps(parsedSchema.locales, locale)
            parsedSchema.label = label ? label.value : parsedSchema.label
            parsedSchema.description = description ? description.value : parsedSchema.description
            if (doc.properties) {
              walkProperties(parsedSchema, parsedSchema.locales['properties'], locale, doc.properties)
            }
          }
          delete parsedSchema.locales
          return parsedSchema
        },
        localiseFromBundle = async(schema, locale = 'en_US', doc, org) => {
          let namespace = 'cortex'
          const parsedSchema = JSON.parse(schema),
                ac = new acl.AccessContext(ap.synthesizeAnonymous(org)),
                label = await org.i18n.translate(ac, `object.${doc.name}.label`, { locale: locale, namespace }),
                description = await org.i18n.translate(ac, `object.${doc.name}.description`, { locale: locale, namespace })

          parsedSchema.label = label || parsedSchema.label
          parsedSchema.description = description || parsedSchema.description

          if (doc.properties) {
            for (const property of parsedSchema.properties) {
              const currentProp = doc.properties.find(prop => prop.name === property.name)
              if (currentProp) {
                const label = await org.i18n.translate(ac, `object.${doc.name}.properties.${currentProp.name}.label`, { locale: locale, namespace }),
                      description = await org.i18n.translate(ac, `object.${doc.name}.properties.${currentProp.name}.description`, { locale: locale, namespace })
                property.label = label || currentProp.label
                property.description = description || currentProp.description
              }
            }
          }

          return parsedSchema
        },

        checkMaintenanceMode = (req, res, next) => {
          if (req.org && req.org.maintenance) {
            return middleware.authorize.anonymous_and_faulty(req, res, next)
          }
          next()
        }

  /**
   * Retrieve Public Organization Info
   */
  router.get('/',
    middleware.client_detection.default,
    function(req, res, next) {

      req.org.aclRead(new acl.AccessContext(ap.synthesizeAnonymous(req.org), req.org), { include: 'configuration.public' }, function(err, result) {
        utils.outputResults(res, null, !err ? result : {
          _id: req.orgId,
          name: req.org.name,
          code: req.orgCode
        })
      })
    }
  )

  /**
   * API Status
   */
  router.get('/status',
    middleware.client_detection.default,
    function(req, res) {
      utils.outputResults(res, null, {
        maintenance: req.org.maintenance,
        maintenanceMessage: req.org.maintenance ? req.org.maintenanceMessage : undefined,
        status: 'healthy'
      })
    }
  )

  /**
   * Retrieve public keys
   */
  router.get('/auth/certs/:format?',
    middleware.client_detection.default,
    middleware.policy,
    function(req, res) {
      const rsaPemToJwk = require('rsa-pem-to-jwk'),
            format = req.params.format || 'jwk'

      utils.outputResults(
        res,
        null,
        {
          keys: req.org.apps.reduce((publicKeys, app) => {
            return app.clients.reduce((publicKeys, client) => {
              if (client.rsa && client.rsa.private && client.expose) {

                if (format === 'pem') {
                  publicKeys.push({
                    kid: client.key,
                    alg: 'RS512',
                    key: client.rsa.public
                  })
                } else if (format === 'jwk') {
                  const jwk = rsaPemToJwk(client.rsa.private, { use: 'sig' }, 'public')
                  jwk.kid = client.key
                  jwk.alg = 'RS512'
                  publicKeys.push(jwk)
                } else {
                  throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid key format. Expected [pem, jwk]' })
                }
              }
              return publicKeys
            }, publicKeys)
          }, [])
        }
      )

    }
  )

  /**
   * Bundle Content
   * @deprecated
   */
  router.get('/bundles/:locale/:version?',
    middleware.client_detection.default,
    checkMaintenanceMode,
    middleware.policy,
    function(req, res) {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET')
      res.header('Access-Control-Allow-Headers', 'X-Requested-With')
      utils.outputResults(res, null, { result: {
        org: req.orgId,
        version: utils.rInt(req.params.version, 0),
        locale: req.params.locale
      } })
    }
  )

  async function localize(doc, schema, locale = 'en_US', org) {
    if (!doc.localized) JSON.parse(schema)
    return doc.useBundles ? localiseFromBundle(schema, locale, doc, org) : localizeSchema(schema, locale, doc)
  }

  /**
   * List all Schemas (not including output object definitions)
   */
  router.get('/schemas',
    middleware.client_detection.default,
    checkMaintenanceMode,
    middleware.policy,
    function(req, res) {

      let wrote = false

      const names = new Set(),
            cursor = models.object.collection.find({ reap: false, org: req.orgId, object: 'object' }).project({ name: 1, schemaCache: 1, properties: 1, localized: 1, useBundles: 1 }),
            write = data => {
              if (!wrote) {
                wrote = true
                res.writeHead(200, {
                  'Content-Type': 'application/json; charset=utf-8'
                })
                res.write('{ "data": [')
              } else {
                res.write(',')
              }
              res.write(data)
            }

      async.during(

        callback => cursor.hasNext((err, hasNext) => callback(err, hasNext)),

        callback => cursor.next((err, doc) => {
          if (err || !doc || (doc.schemaCache && !modules.schemas.isSchemaCacheOutdated(req.org, doc))) {
            return gotSchema(err, doc && doc.schemaCache, doc)
          }
          modules.schemas.getSchema(req.org, doc.name, (err, schema, doc) => {
            gotSchema(err, schema, doc)
          })
          function gotSchema(err, schema, doc) {
            if (!err && schema) {
              names.add(doc.name)
              localize(doc, schema, req.locale, req.org).then((result) => {
                write(JSON.stringify(result))
                callback()
              }).catch(e => {
                logger.error('error caught localizing object schema', utils.toJSON(err, { stack: true }))
                callback(e)
              })
            } else {
              if (err) logger.error('error caught creating object schema', utils.toJSON(err, { stack: true }))
              setTimeout(callback)
            }
          }
        }),

        err => {

          if (err && !wrote) {
            return utils.outputResults(res, err, null)
          }

          async.eachSeries(

            modules.schemas.getNativeObjectsNames(req.org),

            (name, callback) => {

              if (names.has(name)) {
                return callback()
              }
              modules.schemas.getSchema(req.org, name, (err, schema, doc) => {
                if (err) {
                  logger.error('error caught creating object schema', utils.toJSON(err, { stack: true }))
                  return setImmediate(callback)
                } else if (schema) {
                  names.add(name)
                  localize(doc, schema, req.locale, req.org).then((result) => {
                    write(JSON.stringify(result))
                    callback()
                  }).catch(e => callback(e))
                }

              })
            },

            err => {
              if (err && !wrote) {
                return utils.outputResults(res, err, null)
              }
              res.end('], "object": "list", "hasMore": false}')
            }
          )
        })

    }
  )

  /**
   * Retrieve Schema
   */
  router.get('/schemas/:object',
    middleware.client_detection.default,
    checkMaintenanceMode,
    middleware.policy,
    function(req, res, next) {
      modules.schemas.getSchema(req.org, utils.option(req.params, 'object'), function(err, schema, doc) {
        if (err) {
          return next(err)
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(schema, 'utf-8')
        })
        localize(doc, schema, req.locale, req.org).then((result) => {
          res.end(JSON.stringify(result))
        }).catch(e => res.end(e))
      })
    }
  )

  /**
   * Schema Property
   */
  router.get('/schemas/:object/*',
    middleware.client_detection.default,
    checkMaintenanceMode,
    middleware.policy,
    function(req, res) {
      modules.schemas.getSchema(req.org, utils.option(req.params, 'object'), { asObject: true }, function(err, schema) {
        const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
        utils.outputResults(res, err, err ? undefined : utils.digIntoResolved(schema, path, false, true))
      })
    }
  )

  /**
   *  Org Logo
   */
  router.get('/orgs/:current/logo/:facet',
    function(req, res, next) {
      next = _.once(next)
      if (utils.equalIds(req.orgId, req.params.current)) {
        try {
          return utils.outputResults(res, null, modules.storage.accessPointer(req.org, req.org.constructor.schema.node.findNode('logo'), req.org.logo, req.params.facet, new acl.AccessContext(ap.synthesizeAnonymous(req.org), req.org)))
        } catch (e) {
          return next(Fault.from(e))
        }
      }
      next()
    }
  )

  /**
   * Org Favicon
   */
  router.get('/orgs/:current/favicon/:facet',
    function(req, res, next) {
      next = _.once(next)
      if (utils.equalIds(req.orgId, req.params.current)) {
        try {
          return utils.outputResults(res, null, modules.storage.accessPointer(req.org, req.org.constructor.schema.node.findNode('favicon'), req.org.favicon, req.params.facet, new acl.AccessContext(ap.synthesizeAnonymous(req.org), req.org)))
        } catch (e) {
          return next(Fault.from(e))
        }
      }
      next()
    }
  )

  router.get('/translations/:locale',
    checkMaintenanceMode,
    middleware.policy,
    function(req, res, next) {
      const { locale } = req.params,
            options = _.pick(req.query, 'namespaces', 'format', 'onlyKeys', 'pseudo', 'mode', 'limited', 'expand'),
            { namespaces, pseudo, mode, limited, expand, ...rest } = options,
            params = { ...rest, pseudo: { enabled: pseudo, mode, limited, expand } }

      modules.i18n.findBundle(new acl.AccessContext(ap.synthesizeAnonymous(req.org)), formatLocaleToCortex(locale), namespaces, params).then((result) => {
        let mime = 'application/json'
        switch (rest.format) {
          case 'android':
            mime = 'application/xml'
            break
          case 'ios':
            mime = 'application/xliff+xml'
            break
        }

        if (mime === 'application/json') {
          result = JSON.stringify(result)
        }
        res.setHeader('Content-Type', mime)
        return res.end(result)
      }).catch(e => utils.outputResults(res, e))
    })
}
