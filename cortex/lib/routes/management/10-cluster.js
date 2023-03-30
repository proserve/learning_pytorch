'use strict'

const modules = require('../../modules'),
      middleware = require('../../middleware'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      utils = require('../../utils')

module.exports = function(express, router, service) {

  modules.services.api.initClusterCommands(service)

  router.post('/command/:command',
    middleware.body_parser.strict,
    (req, res) => {
      modules.services.api.handleCommand(
        req.params.command,
        utils.deserializeObject(utils.path(req, 'body.serialized')),
        (err, result) => {
          if (isReadableStream(result)) {
            result.pipe(res)
          } else {
            utils.outputResults(res, err, { serialized: utils.serializeObject(result) })
          }

        })
    }
  )

  router.get('/commands',
    (req, res) => {
      modules.services.api.listCommands((err, result) => {
        utils.outputResults(res, err, result)
      })
    }
  )

}
