'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      modules = require('../../../../modules'),
      commands = new Map(),
      IterableCursor = require('../../../../classes/iterable-cursor')

module.exports = {
  version: '1.0.0'
}

function addCommand(name, description, handler) {

  commands.set(name, description)

  const fn = function(script, message, payloadArguments, callback) {

    if (!script.ac.principal.isSysAdmin() || !config('sandbox.debug.enableServicesModule')) {
      return callback(Fault.create('cortex.accessDenied.unspecified'))
    }
    payloadArguments.length = handler.length - 2
    handler(script, ...payloadArguments, callback)

  }
  fn.$is_var_args = true
  module.exports[name] = fn
}

addCommand(
  'list',
  'Returns a list of configured services',
  function(script, callback) {
    callback(null, modules.services.list())
  }
)

addCommand(
  'iface',
  `Return a service interface
     @param name`,
  function(script, name, callback) {

    const service = modules.services.get(name)
    if (!service) {
      return callback(Fault.create('cortex.notFound.unspecified', { reason: 'service not found' }))
    }

    service.getInterface(callback)

  }
)

addCommand(
  'endpoints',
  `Return service endpoints
     @param name`,
  function(script, name, callback) {

    const service = modules.services.get(name)
    if (!service) {
      return callback(Fault.create('cortex.notFound.unspecified', { reason: 'service not found' }))
    }

    callback(null, service.endpoints)

  }
)

addCommand(
  'call',
  `Call an endpoint
     @param name
     @param method
     @param path
     @param options
     @param stream - stream result.
     @param cursor - cursor result.     
      headers, body, qs, endpoint
     `,
  function(script, name, method, path, options, callback) {

    const service = modules.services.get(name)
    let { headers, body, qs, endpoint, stream, cursor } = options || {}

    if (!service) {
      return callback(Fault.create('cortex.notFound.unspecified', { reason: 'service not found' }))
    }

    if (body !== undefined && !_.isString(body) && !Buffer.isBuffer(body)) {
      body = JSON.stringify(body)
      headers = headers || {}
      headers['Content-Type'] = 'application/json'
    }

    service.call(method, path, { headers, body, qs, endpoint, stream: stream || cursor }, (err, result) => {

      if (err || !cursor) {
        callback(err, result)
      } else {
        IterableCursor.fromHttp(result)
          .catch(e => {
            if (err) {
              err.add(e)
            } else {
              err = e
            }
          })
          .then(cursor => {
            callback(err, cursor || result)
          })
      }

    })

  }
)

addCommand(
  'apiList',
  `List api commands
     @param command
     @param body
     @param options
      headers, endpoint
     `,
  function(script, command, body, options, callback) {

    modules.services.api.listCommands(callback)

  }
)

addCommand(
  'apiRun',
  `Run api service command
     @param command
     @param body
     @param options
      headers, endpoint
     `,
  function(script, command, body, options, callback) {

    let { headers, endpoint } = options || {}

    modules.services.api.command(command, { headers, body, endpoint }, callback)

  }
)
