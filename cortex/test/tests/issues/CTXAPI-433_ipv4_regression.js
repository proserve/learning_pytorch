/**
 * unit test for regression on https://gitlab.medable.com/cortex/api/commit/4ef18431a012c144e2f5c56478914a05638b9a05
 */

'use strict'

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      middleware = require('../../../lib/middleware'),
      acl = require('../../../lib/acl')

describe('CTXAPI-433 - isIPv4 naming regression', function() {

  let enableSftpModule
  before(function(callback) {
    enableSftpModule = server.org.configuration.scripting.enableSftpModule
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.enableSftpModule': true } }, () => {
      server.updateOrg(callback)
    })
  })
  after(function(callback) {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.enableSftpModule': enableSftpModule } }, () => {
      server.updateOrg(callback)
    })
  })

  it('clients limits middleware covers ipv4 test', async() => {

    middleware.client_limits({ includeOrgs: 'medable', whitelist: ['127.0.0.1'], blacklist: ['127.0.0.1'] })

  })

  it('authentication middleware covers ipv4 test', async() => {

    const ac = new acl.AccessContext(server.principals.admin)
    modules.authentication.createPolicy(ac, { ipv4: ['127.0.0.1'] })

  })

  it('sftp scripting module covers ipv4 test', sandboxed(function() {

    const sftp = require('sftp'),
          { tryCatch } = require('util.values')

    tryCatch(
      () => sftp.create({
        host: 'this.is.not.a.host.example.org',
        port: 22,
        username: 'foo',
        password: 'this is a passphrase.'
      }),
      err => {
        if (!err || err.message.indexOf('ENOTFOUND') === -1) {
          throw new Error('expecting ENOTFOUND')
        }
      }
    )

  }))

})
