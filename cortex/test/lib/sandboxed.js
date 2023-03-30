'use strict'

const server = require('./server'),
      acl = require('../../lib/acl'),
      utils = require('../../lib/utils'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      modules = require('../../lib/modules')

let Undefined

module.exports = function(code, principal = 'admin', type = 'route', language = 'javascript', specification = 'es6', runtimeArguments = null) {

  return (callback = Undefined) => {

    const promise = new Promise((resolve, reject) => {

      let options, req

      if (_.isString(principal)) {
        principal = server.principals[principal]
      } else if (utils.isPlainObject(principal)) {
        options = principal
        principal = options.principal
        runtimeArguments = options.runtimeArguments || runtimeArguments
        type = options.type || type
        language = options.language || language
        specification = options.specification || specification
        req = options.req
      }

      if (!principal) {
        principal = server.principals.admin
      }

      modules.sandbox.sandboxed(
        new acl.AccessContext(principal, null, { req }),
        code,
        {
          compilerOptions: {
            language: language,
            specification: specification,
            type: type
          }
        },
        runtimeArguments
      )((err, result) => {
        err = Fault.from(err)
        if (err) {
          console.error(JSON.stringify(err.toJSON(), null, 4))
        }
        err ? reject(err) : resolve(result)
      })

    })

    promise
      .then(r => callback && callback(null, r))
      .catch(e => callback && callback(e))

    return promise

  }

}
