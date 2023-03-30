'use strict'

const modules = require('../../../../modules'),
      { profile } = require('../../../../utils')

module.exports = function(script, message, include, callback) {

  callback = profile.fn(callback, 'require()')

  const { ac } = script,
        { sandbox } = modules

  sandbox.requireScript(ac, include)
    .then(script => sandbox.getExecutableSource(ac.org, script))
    .then(result => callback(null, result))
    .catch(err => callback(err))

}
