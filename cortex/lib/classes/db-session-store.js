'use strict'

const utils = require('../utils'),
      modules = require('../modules'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      expressSession = require('express-session')

module.exports = class DbSessionStore extends expressSession.Store {

  get _model() {
    return this.__model || (this.__model = modules.db.models.Session)
  }

  get(sid, callback) {
    callback = utils.ensureCallback(callback)
    this._model.findOne({ _id: sid }, function(err, result) {
      err = Fault.from(err)
      if (err || !result) {
        callback(err)
      } else {

        const session = result.session || {},
              passport = session.passport || (session.passport = {})

        // load the passport user and location fingerprint
        if (result.fingerprint) {
          const location = session.location || (session.location = {})
          location.fingerprint = result.fingerprint
        }
        if (result.accountId) {
          utils.path(passport, 'user.accountId', result.accountId)
        }
        if (result.orgId) {
          utils.path(passport, 'user.orgId', result.orgId)
        }

        callback(null, session)
      }
    })
  }

  set(sid, session, callback) {

    const update = {
      _id: sid,
      session: session,
      accessed: new Date()
    }

    // store the fingerprint, account id, and org at the top-level
    update.fingerprint = session.location ? session.location.fingerprint : null
    if (session.location) {
      delete session.location.fingerprint
    }
    update.accountId = utils.getIdOrNull(utils.path(session.passport, 'user.accountId'))
    update.orgId = utils.getIdOrNull(utils.path(session.passport, 'user.orgId'))
    if (session.passport) {
      delete session.passport.user
    }

    this._model.updateOne({ _id: sid }, update, { upsert: true }, function(err, ...rest) {
      if (err) {
        logger.debug('updating session', { error: err.stack || err })
      }
      utils.ensureCallback(callback)(Fault.from(err), ...rest)
    })
  }

  destroy(sid, callback) {
    this._model.deleteMany({ _id: sid }, function(err, result) {
      utils.ensureCallback(callback)(Fault.from(err), result)
    })
  }

  length(callback) {
    this._model.countDocuments(function(err, count) {
      utils.ensureCallback(callback)(Fault.from(err), count)
    })
  }

  clear(callback) {
    this._model.drop(function(err) {
      utils.ensureCallback(callback)(Fault.from(err))
    })
  }

}
