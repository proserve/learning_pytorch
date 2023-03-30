'use strict'

const { testPasswordStrength } = require('../../../../utils')

module.exports = {

  version: '1.0.0',

  zxcvbn: function(script, message, value, callback) {

    callback(null, testPasswordStrength(value))

  }

}
