'use strict'

const { services: { transpiler } } = require('../../../../modules')

module.exports = {

  as: function(script, message, principal, options, callback) {

    script.pushPrincipal(principal, options, (err, principal) => {
      callback(err, principal && principal.toObject())
    })

  },

  unas: function(script, message, callback) {

    script.popPrincipal()
    callback()

  },

  getLocale: function(script, message, callback) {

    callback(null, script.locale)

  },

  setLocale: function(script, message, locale, callback) {

    script.locale = locale
    callback(null, script.locale)

  },

  transpile: function(script, message, source, callback) {

    transpiler.transpile(
      source,
      {
        filename: '',
        language: 'javascript',
        specification: 'es6',
        sourceType: 'script'
      },
      (err, result) => {

        callback(err, result && `function() { ${result.source} }`)

      })

  }

}
