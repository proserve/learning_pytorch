'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      http = require('http'),
      express = require('express'),
      config = require('cortex-service/lib/config')

describe('CTXAPI-502 - Allow some restricted http headers', function() {

  let allowedRestrictedHttpHeaders,
      skipHttpHostValidation,
      httpServer,
      connections = new Set()

  before(function(callback) {

    skipHttpHostValidation = config('sandbox.debug').skipHttpHostValidation
    config('sandbox.debug').skipHttpHostValidation = true
    config.flush()

    allowedRestrictedHttpHeaders = server.org.configuration.scripting.allowedRestrictedHttpHeaders
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.allowedRestrictedHttpHeaders': ['cookie'] } }, () => {
      server.updateOrg(callback)
    })
  })

  after(function(callback) {

    config('sandbox.debug').skipHttpHostValidation = skipHttpHostValidation
    config.flush()

    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, { $set: { 'configuration.scripting.allowedRestrictedHttpHeaders': allowedRestrictedHttpHeaders } }, () => {
      server.updateOrg(callback)
    })

  })

  before(function(callback) {

    const app = express(),
          host = config('sandbox.mocha.http_tls_test_server.host'),
          port = config('sandbox.mocha.http_tls_test_server.port')

    httpServer = http.createServer({}, app)

    app.get('/', function(req, res) {
      res.status(200).json(req.headers)
    })

    httpServer.on('connection', (socket) => {

      connections.add(socket)

      socket.once('close', () => {
        connections.delete(socket)
      })

    })

    httpServer.listen(port, host, callback)

  })

  after(function(callback) {

    httpServer.close(() => {

      connections.forEach(socket => {
        try {
          socket.destroy()
        } catch (err) {
          void err
        }
      })

      callback()
    })

  })

  it('should echo allowed headers only', sandboxed(function() {

    /* global consts */

    const http = require('http'),
          should = require('should'),
          url = 'http://' + consts.mocha.http_tls_test_server.host + ':' + consts.mocha.http_tls_test_server.port,
          options = {
            timeout: 1000,
            headers: {
              cookie: 'LOCALE.471fb09f-f39f-4401-a284-3b0c348fecb2=en-US;', // allowed restricted
              'accept-charset': 'utf-8', // restricted
              'x-custom-test': 'allowed'
            }
          },
          response = JSON.parse(http.get(url, options).body)

    should.equal(response['x-custom-test'], options.headers['x-custom-test'])
    should.equal(response['cookie'], options.headers['cookie'])
    should.not.exist(response['accept-charset'])

  }))

})
