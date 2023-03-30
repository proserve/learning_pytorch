'use strict'

const { rString } = require('../../lib/utils')

function objectValidator({ objectsParam = 'objects' } = {}) {

  return function(req, res, next) {

    const { object, org, params } = req,
          { [objectsParam]: objectName } = params

    if (object) {
      return next()
    }

    if (!rString(objectName)) {
      return next('route')
    }

    org.createObject(objectName, (err, object) => {
      if (!err) {
        req.object = object
      }
      next(err)
    })

  }

}

module.exports = objectValidator
module.exports.default = objectValidator()
