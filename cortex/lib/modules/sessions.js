const _ = require('underscore'),
      modules = require('./index'),
      acl = require('../acl'),
      { resolveOptionsCallback, rBool } = require('../utils')

class SessionsModule {

  constructor() {
    return SessionsModule
  }

  /**
     * logout a session
     *
     * @param req
     * @param callback -> null, returns true of logged out, false if not already authenticated
     */
  static logout(req, callback) {

    const loggedIn = Boolean(req && req.principal && req.principal.isAuthenticated())

    if (loggedIn) {

      const ac = new acl.AccessContext(req.principal, null, { req }),
            context = {
              object: 'account',
              _id: req.principal._id
            }
      modules.audit.recordEvent(ac, 'authentication', 'logout', { context }, () => {

        SessionsModule.destroy(req, { audit: false }, () => {
          callback(null, loggedIn)
        })

      })

    } else {

      SessionsModule.destroy(req, { audit: false }, () => {
        callback(null, loggedIn)
      })

    }

  }

  /**
   * logs out and destroys a session.
   *
   * @param req
   * @param options
   *  err = null
   *  audit = true
   * @param callback err (the same one passed in)
   */
  static destroy(req, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const err = options.err,
          audit = rBool(options.audit, true)

    if (audit && req && req.principal && req.principal.isAuthenticated()) {
      const ac = new acl.AccessContext(req.principal, null, { req })
      modules.audit.recordEvent(ac, 'authentication', 'ended', { err }, () => {
        _destroy()
      })
    } else {
      _destroy()
    }

    function _destroy() {

      try {
        if (req && _.isFunction(req.isAuthenticated)) {
          if (req.isAuthenticated()) {
            req.logout()
          }
        }
      } catch (e) {}

      if (req && req.session) {
        try {
          if (req && req.session) {
            req.session.destroy(() => {
              callback(err)
            })
          }
        } catch (e) {
          void e
          callback(err)
        }
      } else {
        callback(err)
      }

    }

  }

  static logoutAccounts(accountId, orgId, except, callback) {
    modules.db.models.Session.logoutAccounts(accountId, orgId, except, callback)
  }

}

module.exports = SessionsModule
