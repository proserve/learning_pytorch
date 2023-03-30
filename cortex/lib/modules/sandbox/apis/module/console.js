'use strict'

const { serializeObject, roughSizeOfObject } = require('../../../../utils'),
      config = require('cortex-service/lib/config'),
      { db: { models: { Console } } } = require('../../../../modules'),
      savable = ['log', 'warn', 'error', 'info']

module.exports = ['log', 'warn', 'error', 'info', 'table', 'assert', 'count', 'time', 'timeEnd', 'group', 'groupEnd', 'groupCollapsed'].reduce(
  (mod, funcName) => {

    const fn = mod[funcName] = function(script, message, payload, callback) {

      if (savable.includes(funcName)) {
        if (!(config('app.env') === 'production' && config('app.domain') === 'market')) {

          try {
            roughSizeOfObject(payload, 8192)
          } catch (err) {
            return callback()
          }

          Console.create({
            org: script.ac.orgId,
            date: new Date(),
            level: funcName,
            message: serializeObject(payload)
          }, err => {
            void err
          })
        }
      } else {
        // @todo warn deprecated
      }

      callback()

    }

    fn.$is_var_args = true
    return mod
  },
  {
    version: '1.0.0'
  }
)
