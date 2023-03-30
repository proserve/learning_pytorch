'use strict'

const middleware = require('../../middleware'),
      modules = require('../../modules'),
      { asyncHandler } = require('../../utils'),
      { Driver } = modules.driver

module.exports = function(express, router) {

  const systemRouter = middleware.system_router(express),
        bulkOperationFeatureChecker = middleware.feature('alphaFeatures.restApi.bulkOperation', { action: 'throw', active: true, admin: false, description: 'Enable POST /:objects/db/bulk HTTP interface.' })

  router.post('/:objects/db/:operation',
    function(req, res, next) {
      if (req.params.operation === 'bulk') {
        bulkOperationFeatureChecker(req, res, next)
      } else {
        next()
      }
    },
    middleware.object_validator.default,
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.policy,
    systemRouter,
    asyncHandler(async(req) => {

      const { principal, object, body: userOptions = {}, params } = req,
            { operation: operationName } = params,
            driver = new Driver(principal, object, { req }),
            { result } = await driver.executeOperation(operationName, userOptions, {}, { parent: req.operation })

      return result

    })
  )

}
