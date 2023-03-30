'use strict'

const utils = require('../../../../utils'),
      modules = require('../../../../modules')

module.exports = {

  version: '1.0.0',

  /**
     * @param script
     * @param message
     * @param object
     * @param path
     * @param callback
     */
  read: function(script, message, object, path, callback) {

    modules.schemas.getSchema(script.ac.org, object, { asObject: true }, function(err, schema) {
      if (err || !path) {
        return callback(err, schema)
      }
      path = utils.normalizeObjectPath(String(path).replace(/\//g, '.'))
      callback(null, utils.digIntoResolved(schema, path, false, true))

    })
  }

}
