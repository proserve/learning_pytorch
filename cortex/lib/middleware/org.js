'use strict'

const Fault = require('cortex-service/lib/fault'),
      http = require('http'),
      utils = require('../utils'),
      modules = require('../modules'),
      { RequestOperation } = modules.runtime.operations

Object.defineProperties(http.IncomingMessage.prototype, {
  orgId: {
    get: function() {
      return this.org ? this.org._id : null
    }
  },
  orgCode: {
    get: function() {
      return this.org ? this.org.code : null
    }
  },
  principal: {
    get: function() {
      return this._principal
    },
    set: function(principal) {
      this._principal = principal
      this.emit('principal', principal)
    }
  },
  org: {
    get: function() {
      return this._org
    },
    set: function(org) {
      const changing = !this._org || !org || !utils.equalIds(this._org._id, org._id)
      this._org = org
      this.emit('org', org)
      if (changing) {
        if (!this.operation) {
          this.operation = new RequestOperation(this)
          this.operation.start(() => {

          })
        }
      }

    }
  }
})

module.exports = function(explicitOrgCode) {

  const Org = modules.db.models.org

  return function(req, res, next) {

    if (req.org !== undefined) {
      next()
      return
    }

    const code = explicitOrgCode || req.url.replace(/^\/([^/]*).*$/, '$1')
    if (!explicitOrgCode && (!code || code === req.url)) {
      return next(Fault.create('cortex.invalidArgument.missingEnvCode'))
    }

    if (!explicitOrgCode) {
      req.url = req.url.replace(/^\/([^/]*)/, '') || '/'
    }

    // disallow use of ObjectId as org code
    if (utils.isIdFormat(code)) {
      return next(Fault.create('cortex.invalidArgument.missingEnvCode'))
    }

    Org.loadOrg(code, (err, document) => {

      if (!err && document) {
        if (document.state !== 'enabled') {
          err = Fault.create('cortex.invalidArgument.envDisabled')
        } else if (document.deployment.inProgress) {
          err = Fault.create('cortex.accessDenied.maintenance')
        } else {
          req.org = document
        }
      } else {
        err = Fault.create('cortex.notFound.env')
      }
      next(err)
    })

  }

}
