'use strict'

const saml = require('saml2-js'),
      domain = require('domain') // eslint-disable-line node/no-deprecated-api

function create(sp, idp) {
  return {
    sp: new saml.ServiceProvider(sp),
    idp: idp ? new saml.IdentityProvider(idp) : undefined
  }
}

function tryCatch(fn) {
  return function(script, message, sp_, idp_, options, callback) {
    const d = domain.create()
    d.on('error', callback)
    d.run(function() {
      try {
        const { sp, idp } = create(sp_, idp_)
        sp[fn](idp, options, callback)
      } catch (err) {
        callback(err)
      }
    })
  }
}

module.exports = {

  version: '1.0.0',

  create_login_request_url: (function() {
    const fn = tryCatch('create_login_request_url')
    return function(script, message, sp_, idp_, options, callback) {
      fn(script, message, sp_, idp_, options, (err, url, id) => {
        callback(err, { url, id })
      })
    }
  }()),
  redirect_assert: tryCatch('redirect_assert'),
  post_assert: tryCatch('post_assert'),
  create_logout_request_url: tryCatch('create_logout_request_url'),
  create_logout_response_url: tryCatch('create_logout_response_url'),

  create_metadata: function(script, message, sp_, callback) {
    try {
      const { sp } = create(sp_)
      callback(null, sp.create_metadata())
    } catch (err) {
      callback(err)
    }
  }
}
