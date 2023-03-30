'use strict'

const utils = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      expressSession = require('express-session'),
      DbSessionStore = require('../classes/db-session-store'),
      config = require('cortex-service/lib/config'),
      passport = require('passport'),
      sessionOptions = utils.extend(true, {}, config('sessions'), {
        store: new DbSessionStore()
      }),
      cookieParser = require('cookie-parser')(config('sessions.secret')),
      passportInitializer = passport.initialize({ userProperty: 'principal' }),
      sessionReader = expressSession(sessionOptions),
      originalCookiePath = sessionOptions.cookie.path,
      originalGenerate = sessionOptions.store.generate

// @hack. dangerous knowledge of innards.
sessionOptions.store.generate = function(req) {
  originalGenerate.call(this, req)
  req.session.cookie.path = '/' + req.orgCode
}

// @hack we need to do this here to path per org. every time. danger!!! if the innards of expressSession() ever become async, this will bork.
// this works because the middleware holds a reference to the cookie object.
function doReadSession(req, res, callback) {
  sessionOptions.cookie.path = '/' + req.orgCode
  sessionReader(req, res, function(err) {
    sessionOptions.cookie.path = originalCookiePath
    if (callback) {
      let cb = callback
      callback = null
      cb(err)
    } else {
      logger.warn(`[session] session initializer was called twice for request ${req._id}`)
    }
  })
}

module.exports = function(opts) {

  const options = {
    regenerate: false,
    regenerateExpired: false
  }

  utils.extend(options, opts)

  return function(req, res, next) {

    function initPassport() {
      if (req._passport) {
        next()
      } else {
        passportInitializer(req, res, function(err) {
          next(err)
        })
      }
    }

    if (req.session && !(options.regenerate || options.regenerateExpired)) {
      next()
    } else {
      cookieParser(req, res, function(err) {
        if (err) next(Fault.create('cortex.error.couldNotReadCookies'))
        else {
          doReadSession(req, res, function(err) {
            const isExpired = req.session?.expires < new Date().getTime(),
                  regenerate = options.regenerate || (options.regenerateExpired && isExpired)
            if (err) next(err)
            else if (!req.session) {
              next(Fault.create('cortex.error.sessionInitFailure'))
            } else if (regenerate) {
              req._passport = null
              req.session.regenerate(function(err) {
                if (err) next(err)
                else initPassport()
              })
            } else {
              initPassport()
            }
          })
        }
      })
    }
  }

}
