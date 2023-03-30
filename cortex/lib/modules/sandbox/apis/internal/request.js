'use strict'

const modules = require('../../../../modules'),
      IncomingMessage = require('http').IncomingMessage

module.exports = {

  getLocale(script, message, callback) {

    const req = script.ac.req
    let locale
    if (req instanceof IncomingMessage) {
      locale = req.locale
    } else {
      locale = script.ac.getLocale()
    }
    callback(null, locale)

  },

  setLocale(script, message, locale, callback) {

    const req = script.ac.req
    if (req instanceof IncomingMessage) {
      locale = modules.locale.getCaseMatch(locale)
      if (locale) {
        req.locale = locale
        req.fixedLocale = locale
        return callback(null, req.locale)
      }
    }
    module.exports.getLocale(script, message, callback)

  }

}
