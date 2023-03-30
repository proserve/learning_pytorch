'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../acl'),
      _ = require('underscore'),
      consts = require('../../../consts'),
      ap = require('../../../access-principal')

/**
 * These routes are called by the Hub. The client detection done here utilizes the keys configured in config.hub.[key/secret]
 *
 * @param express
 * @param router
 */
module.exports = function(express, router) {

  function validateSystemRouteClient(includeOrgs = null) {

    const limits = {
            allowSessions: false,
            allowSigned: true,
            allowUnsigned: false,
            includeOrgs
          },
          clientDetection = middleware.client_detection(),
          clientLimits = middleware.client_limits(limits)

    return function(req, res, next) {
      clientDetection(req, res, function(err) {
        if (err) {
          return next(err)
        }
        clientLimits(req, res, function(err) {
          if (err || req.orgClient.key !== config('hub.apiKey')) {
            return next(err || Fault.create('cortex.accessDenied.unspecified'))
          }
          next()
        })
      })
    }
  }

  validateSystemRouteClient.default = validateSystemRouteClient()
  validateSystemRouteClient.medable = validateSystemRouteClient(['medable'])

  function discoveryModeOnly(req, res, next) {
    if (!config('hub.discoveryEnabled')) {
      return next(Fault.create('cortex.accessDenied.unspecified', { reason: 'hub (3)' }))
    }
    next()
  }

  const readableProjectProperties = [
    'name',
    'code',
    'hub',
    'logo',
    'favicon',
    'creator'
  ]

  /**
     * reset to before hub installation.
     */
  router.get('/hub/system/discover/reset',
    middleware.body_parser.strict,
    discoveryModeOnly,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {

      modules.db.models.org.collection.updateMany({ reap: false, object: 'org' }, { $unset: { hub: 1 } }, err => {

        utils.outputResults(res, err, true)

      })
    }
  )

  /**
     * discover projects in initial stage of hub bootstrap.
     */
  router.get('/hub/system/discover/projects',
    middleware.body_parser.strict,
    discoveryModeOnly,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {

      const options = _.extend(
        _.pick(req.query, 'skip', 'limit'),
        {
          total: true,
          req,
          crossOrg: true,
          skipAcl: true,
          grant: acl.AccessLevels.System,
          paths: readableProjectProperties.slice()
        }
      )

      modules.db.models.org.aclList(ap.synthesizeOrgAdmin(req.org), options, (err, list) => {
        if (err || list.data.length === 0) {
          return utils.outputResults(res, err, list)
        }
        const find = { $or: list.data.reduce((conditions, orgDoc) => {
          const creatorId = utils.path(orgDoc, 'creator._id')
          if (creatorId) {
            conditions.push({ org: orgDoc._id, object: 'account', reap: false, _id: creatorId })
          }
          return conditions
        }, []) }
        if (find.$or.length === 0) {
          return utils.outputResults(res, null, list)
        }
        modules.db.models.account.find(find).select('_id object name email mobile state locked').lean().exec((err, accountDocs) => {
          if (!err) {
            list.data.forEach(function(org) {
              org.creator = utils.findIdInArray(accountDocs, '_id', utils.path(org, 'creator._id')) || org.creator
            })
          }
          utils.outputResults(res, err, list)
        })
      })

    }
  )

  /**
     * read a property from the local project.
     */
  router.get('/hub/system/discover/projects/:project/*',
    middleware.body_parser.strict,
    discoveryModeOnly,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {
      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.')).trim()
      if (!readableProjectProperties.includes(path) && !readableProjectProperties.includes(path.split('.')[0])) {
        return next(Fault.create('cortex.accessDenied.propertyRead', { path }))
      }
      modules.db.models.org.loadOrg(req.params.project, (err, document) => {
        if (!err && !document) {
          err = Fault.create('cortex.notFound.env')
        }
        if (err) {
          return next(err)
        }
        const options = { req, crossOrg: true, skipAcl: true, grant: acl.AccessLevels.Public }
        modules.db.models.org.aclReadPath(ap.synthesizeOrgAdmin(document), document._id, path, options, function(err, result, ac) {
          utils.outputResults(res, err, result)
        })
      })
    }
  )

  /**
     * initialize hub object
     */
  router.post('/hub/system/discover/initialize/:project',
    middleware.body_parser.strict,
    discoveryModeOnly,
    validateSystemRouteClient.medable,
    middleware.authorize.anonymous,
    function(req, res, next) {

      modules.authentication.genRsaKeypair(2048, (err, { pub, priv } = {}) => {
        if (err) {
          return next(err)
        }
        const hub = {
          enabled: true,
          envKey: modules.authentication.genAlphaNumString(consts.API_KEY_LENGTH),
          envSecret: modules.authentication.genAlphaNumString(consts.API_SECRET_LENGTH),
          clientKey: modules.authentication.genAlphaNumString(consts.API_KEY_LENGTH),
          clientRsa: {
            timestamp: Math.floor(Date.now() / 1000),
            public: pub,
            private: priv
          }
        }
        modules.db.sequencedFunction(
          function(callback) {
            modules.db.models.org.loadOrg(req.params.project, (err, org) => {
              if (!err && !org) {
                err = Fault.create('cortex.notFound.unspecified', { reason: 'Project not found.' })
              }
              if (err) {
                return callback(err)
              } else if (_.isBoolean(org.hub.enabled)) {
                return callback(null, false)
              }
              org.hub = hub
              const ac = new acl.AccessContext(ap.synthesizeAnonymous(org), org)
              ac.lowLevelUpdate({ subject: org }, err => {
                callback(err, {
                  envKey: hub.envKey,
                  envSecret: hub.envSecret,
                  clientKey: hub.clientKey

                })
              })
            })
          },
          10,
          (err, result) => {
            utils.outputResults(res, err, result)
          }
        )
      })
    }
  )

}
