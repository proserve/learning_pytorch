'use strict'

const clone = require('clone'),
      utils = require('../utils'),
      corsOptions = {
        ac_allow_headers: 'Accept, Accept-Encoding, Accept-Language, Authorization, X-HTTP-Method-Override, Content-Encoding, Content-Type, X-Requested-With, Medable-Csrf-Token, Medable-Client-Key, Medable-Client-Signature, Medable-Client-Timestamp, Medable-Client-Nonce, Medable-Client-Account, Origin',
        ac_expose_headers: 'Medable-Server-Time, Content-Length, Content-Encoding, Content-Type, Medable-Csrf-Token',
        ac_max_age: 60,
        ac_allow_credentials: true,
        origin: null,
        options_methods: 'GET, PUT, POST, HEAD, OPTIONS, DELETE, PATCH',
        request_methods: null
      }

module.exports = {

  preFlight: function(req, res, next) {

    const isOptions = req.method === 'OPTIONS',
          origin = req.header('Origin')

    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Methods', isOptions ? corsOptions.options_methods : req.method)
      res.header('Access-Control-Allow-Credentials', corsOptions.ac_allow_credentials)
      res.header('Access-Control-Expose-Headers', corsOptions.ac_expose_headers)
      res.header('Access-Control-Max-Age', corsOptions.ac_max_age)
      res.header('Access-Control-Allow-Headers', corsOptions.ac_allow_headers)
    }
    if (isOptions) {
      return res.status(204).end('')
    }
    next()

  },

  runtime: function(options = null) {
    options = options === null ? corsOptions : utils.extend(module.exports.options, options)
    return function(req, res, next) {
      const isOptions = req.method === 'OPTIONS'
      if (!isOptions) {
        const origin = req.header('Origin')
        if (origin) {
          res.header('Access-Control-Allow-Origin', options.origin || origin)
          res.header('Access-Control-Allow-Methods', options.request_methods || req.method)
          res.header('Access-Control-Allow-Credentials', options.ac_allow_credentials)
          res.header('Access-Control-Expose-Headers', options.ac_expose_headers)
          res.header('Access-Control-Max-Age', options.ac_max_age)
          res.header('Access-Control-Allow-Headers', options.ac_allow_headers)
        }
      }
      next()
    }
  }

}

Object.defineProperty(module.exports, 'options', {
  get: function() {
    return clone(corsOptions)
  }
})
