'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config')

module.exports = function(express, router) {

  /**
     * Run View
     */
  router.get('/views/:code',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      if (utils.isIdFormat(req.params.code)) {
        return next()
      }

      const options = _.pick(_.isObject(req.query) ? req.query : {}, 'paths', 'limit', 'skip', 'where', 'map', 'group', 'sort', 'pipeline'),
            viewCode = utils.rString(req.params.code, '')

      options.req = req
      options.script = null
      options.returnCursor = (config('runtime.streamLists') || (req.header('accept') || '').indexOf('application/x-ndjson') === 0)

      if (viewCode.indexOf('c_') === 0 || ~viewCode.indexOf('__')) {
        modules.db.models.view.viewRun(req.principal, viewCode, options, function(err, docs) {
          utils.outputResults(res, err, docs)
        })
        return
      }

      modules.views.runView(req.principal, viewCode, options, function(err, results) {
        utils.outputResults(res, err, results)
      })

    }
  )

  /**
     * Run View (deprecated)'
     */
  router.get('/views/:id/run',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      const options = _.pick(_.isObject(req.query) ? req.query : {}, 'paths', 'limit', 'skip', 'where', 'map', 'group', 'sort', 'pipeline'),
            viewId = utils.getIdOrNull(req.params.id)

      options.req = req
      options.script = null
      options.returnCursor = (config('runtime.streamLists') || (req.header('accept') || '').indexOf('application/x-ndjson') === 0)

      if (viewId) {
        modules.db.models.view.viewRun(req.principal, viewId, options, function(err, docs) {
          utils.outputResults(res, err, docs)
        })
        return
      }

      modules.views.runView(req.principal, req.params.id, options, function(err, results) {
        utils.outputResults(res, err, results)
      })

    }
  )

}
