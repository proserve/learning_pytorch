'use strict'
const Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      consts = require('../../../../../lib/consts'),
      { roughSizeOfObject, isSet, couldBeId } = require('../../../../utils')

module.exports = {

  version: '1.0.0',

  record: function(script, message, objectName, instanceId, action, options, callback) {
    const isValidId = couldBeId(instanceId)
    if (!isValidId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `The value ${instanceId} is not a valid id` }))
    }
    if (!consts.audits.categories.user.subs[action]) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `There is no action available with the name: ${action}` }))
    }
    if (isSet(options.metadata)) {
      try {
        roughSizeOfObject(options.metadata, 1024)
      } catch (e) {
        return callback(e)
      }
    }
    script.ac.org.createObject(objectName, (err) => {
      if (err) {
        return callback(err)
      }
      modules.audit.recordEvent(script.ac, 'user', action, {
        context: {
          object: objectName,
          _id: instanceId
        },
        ...options
      }, callback)
    })
  }

}
