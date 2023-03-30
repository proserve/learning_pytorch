'use strict'

const middleware = require('../../middleware'),
      modules = require('../../modules'),
      { Driver } = modules.driver,
      { asyncHandler } = require('../../utils'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../utils'),
      {
        isCustomName, isUuidString, path: pathTo, stringToBoolean,
        rBool, outputResults, inIdArray, normalizeObjectPath
      } = utils,
      consts = require('../../consts'),
      acl = require('../../acl')

/**
 * these routes must run last due to the variable nature of custom objects
 */
module.exports = function(express, router) {

  const systemRouter = middleware.system_router(express, { allowSystemObjects: true })

  /**
     * Create Connections
     *
     *  targets: a list of connection targets
     */
  router.post('/:objects/:id/connections',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      if (!req.object.allowConnections) {
        return next(Fault.create('cortex.accessDenied.connectionsDisabled', { path: req.object.objectLabel }))
      }

      if (req.principal.state !== consts.accountStates.verified) {
        return next(Fault.create('cortex.accessDenied.connectionRequiresVerification'))
      }

      async.waterfall([

        // validate context access
        function(callback) {
          req.object.getAccessContext(req.principal, pathTo(req, 'params.id'), { req: req }, function(err, ac) {
            if (!err && !ac.hasAccess(acl.AccessLevels.Share)) {
              err = Fault.create('cortex.accessDenied.shareAccess')
            }
            callback(err, ac)
          })
        },

        // validate targets.
        function(ac, callback) {
          modules.connections.normalizeTargets(ac, pathTo(req, 'body.targets') || [], {}, function(err, targets) {
            if (!err && targets.length === 0) {
              err = Fault.create('cortex.invalidArgument.noConnectionTargets')
            }
            callback(err, ac, targets)
          })
        },

        // create/upgrade individual connections
        function(ac, targets, callback) {

          async.mapLimit(targets, 10, function(target, callback) {
            modules.connections.createConnection(ac, target, { appClientId: req.clientId }, function(err, connection) {
              if (err) {
                const fault = (Fault.from(err) || Fault.create('cortex.error.unspecified', { reason: 'failed to create connection' })).toJSON()
                fault.target = target
                callback(null, fault)
              } else if (connection) {
                connection.aclRead(new acl.AccessContext(req.principal, null, { override: acl.AccessLevels.Read }), function(err, doc) {
                  if (err) {
                    const fault = (Fault.from(err) || Fault.create('cortex.error.unspecified', { reason: 'failed to read connection' })).toJSON()
                    fault.target = target
                    fault.connection = connection._id
                    callback(null, fault)
                  } else {
                    callback(null, doc)
                  }
                })
              } else {
                // here, there was no connection made or found. probably already exists and was silently upgraded.
                callback(null, null)
              }

            })
          }, callback)

        }

      ], function(err, targets) {

        outputResults(res, err, targets)

      })
    }
  )

  /**
     * Create Post
     *
     *  body: a post body
     *  targets: post access targets list
     */
  router.post('/:objects/:id/posts/:postType',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.Post.postCreate(req.principal, req.object, req.params.id, req.params.postType, req.body, { req: req }, function(err, pac) {
        if (err) {
          next(err)
        } else {
          const options = { req: req }
          modules.db.models.Post.postReadOne(pac.principal, pac.postId, options, function(err, document) {
            outputResults(res, err, document)
          })
        }
      })

    }
  )

  /**
     * Get Context
     */
  router.get('/:objects/:id',
    middleware.object_validator.default,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: userOptions } = req,
            driver = new Driver(principal, object, { req }),
            isCustom = object.uniqueKey && (isCustomName(req.params.id, ['c_', 'o_']) || isUuidString(req.params.id)),
            where = {
              [isCustom ? object.uniqueKey : '_id']: req.params.id
            },
            operation = driver.createOperation('readOne', { parent: req.operation }),
            computedOptions = operation.getOptions({ ...userOptions, where, path: null }),
            privilegedOptions = {}

      // if allowed cross org, grant at least public access. also, accept privileged input from principal.privileged,
      if (computedOptions.crossOrg) {
        privilegedOptions.grant = Math.max(acl.AccessLevels.Public, acl.fixAllowLevel(computedOptions.grant))
      }

      return operation.execute(computedOptions, privilegedOptions)

    })
  )

  /**
   * Stream Exports
   */
  function ensureLocalExportStreams(req, res, next) {
    if (!req.org.configuration.localExportStreams) {
      return next('route')
    }
    next()
  }

  router.get('/exports/:id/dataFile/content',
    ensureLocalExportStreams,
    middleware.client_detection({ defaultToWebApp: true }),
    middleware.authorize.anonymous,
    middleware.policy,
    asyncHandler(async(req) => {

      const { principal } = req,
            driver = new Driver(principal, modules.db.models.export, { req })

      return driver.readOne(
        {
          where: { _id: req.params.id },
          path: 'dataFile.content'
        },
        {},
        {
          returnPointers: true
        }
      )
    })
  )

  router.get('/exports/:id/files/:number',
    ensureLocalExportStreams,
    middleware.client_detection({ defaultToWebApp: true }),
    middleware.authorize.anonymous,
    middleware.policy,
    asyncHandler(async(req) => {

      const { principal } = req,
            driver = new Driver(principal, modules.db.models.export, { req })

      return driver.readOne(
        {
          where: { _id: req.params.id },
          path: 'files.' + req.params.number
        },
        {},
        {
          returnPointers: true
        }
      )

    })
  )

  /**
     * Get Context Property
     */
  router.get('/:objects/:id/*',
    middleware.object_validator.default,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: userOptions } = req,
            driver = new Driver(principal, object, { req }),
            isCustom = object.uniqueKey && (isCustomName(req.params.id, ['c_', 'o_']) || isUuidString(req.params.id)),
            where = {
              [isCustom ? object.uniqueKey : '_id']: req.params.id
            },
            operation = driver.createOperation('readOne', { parent: req.operation }),
            computedOptions = operation.getOptions({
              ...userOptions,
              where,
              path: req.params[0]
            }),
            privilegedOptions = {},
            internalOptions = {
              returnPointers: true
            }

      // if allowed cross org, grant at least public access. also, accept privileged input from principal.privileged,
      if (computedOptions.crossOrg) {
        privilegedOptions.grant = Math.max(acl.AccessLevels.Public, acl.fixAllowLevel(computedOptions.grant))
      }

      return operation.execute(computedOptions, privilegedOptions, internalOptions)

    })

  )

  /**
   * List Contexts
   */
  router.get('/:objects',
    middleware.object_validator.default,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const canBeTotalled = [
              consts.NativeIds.org, consts.NativeIds.view, consts.NativeIds.object,
              consts.NativeIds.script, consts.NativeIds.deployment, consts.NativeIds.export
            ],
            total = inIdArray(canBeTotalled, req.object.objectId) && rBool(stringToBoolean(req.query.total), false),
            { principal, object, query: inputOptions } = req,
            driver = new Driver(principal, object, { req })

      return driver.cursor(inputOptions, {}, { asList: total, total })

    })
  )

  /**
     * Create Context
     */
  router.post('/:objects',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: insertOptions, body: document } = req,
            driver = new Driver(principal, object, { req })

      return driver.insertOne({ ...insertOptions, document })

    })
  )

  /**
     * Patch Context
     */
  router.patch('/:objects/:id',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, body: ops, params } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req })

      return driver.patchOne({ ...patchOptions, match, ops })

    })
  )

  /**
     * Update Context
     */
  router.put('/:objects/:id',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, body: value, params } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req }),
            ops = [{ op: 'set', value }]

      return driver.patchOne({ ...patchOptions, match, ops, path: null })

    })
  )

  /**
     * Append Context Array
     */
  router.post('/:objects/:id',
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, body: value, params } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req }),
            ops = [{ op: 'push', value }]

      return driver.patchOne({ ...patchOptions, match, ops, path: null })

    })
  )

  /**
     * Update Context Property
     */
  router.put('/:objects/:id/*',
    middleware.object_validator.default,
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, params, body: value } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req }),
            path = normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            ops = [{ op: 'set', value }]

      return driver.patchOne({ ...patchOptions, path, match, ops })

    })
  )

  /**
   * Patch Context Property
   */
  router.patch('/:objects/:id/*',
    middleware.object_validator.default,
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, body: ops, params } = req,
            { id: match } = params,
            path = normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            driver = new Driver(principal, object, { req })

      return driver.patchOne({ ...patchOptions, path, match, ops })

    })
  )

  /**
     * Append Context Property
     */
  router.post('/:objects/:id/*',
    middleware.object_validator.default,
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    middleware.body_parser.runtime.form_data,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: patchOptions, params, body: value } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req }),
            path = normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            ops = [{ op: 'push', value }]

      return driver.patchOne({ ...patchOptions, path, match, ops })

    })
  )

  /**
     * Remove Context Property
     */
  router.delete('/:objects/:id/*',
    middleware.object_validator.default,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: deleteOptions, params } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req }),
            path = normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            ops = [{ op: 'remove', path }],
            { modified } = await driver.patchOne({ ...deleteOptions, match, ops }, {}, { withRead: false })

      return !!(modified && modified.length > 0)

    })
  )

  /**
     * Delete Context
     */
  router.delete('/:objects/:id',
    middleware.object_validator.default,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, query: deleteOptions, params } = req,
            { id: match } = params,
            driver = new Driver(principal, object, { req })

      return driver.deleteOne({ ...deleteOptions, match })

    })
  )

}
