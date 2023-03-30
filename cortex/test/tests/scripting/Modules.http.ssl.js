'use strict'

const express = require('express'),
      wrapper = require('../../lib/wrapped_sandbox')

let httpsServer = null

module.exports = {

  main: function() {

    /* global consts */

    let response

    const http = require('http'),
          should = require('should'),
          ciphers = http.getCiphers(),
          url = 'https://' + consts.mocha.http_tls_test_server.host + ':' + consts.mocha.http_tls_test_server.port,
          options = {
            key: consts.mocha.http_tls_test_server.key,
            cert: consts.mocha.http_tls_test_server.cert,
            ca: consts.mocha.http_tls_test_server.ca,
            passphrase: 'password',
            ciphers: ciphers,
            rejectUnauthorized: true,
            timeout: 10000
          },
          body = { foo: 'bar' }

    response = http.get(url, options)
    should.equal(response.body, 'get', 'get response body')

    response = http.head(url, options)
    should.equal(response.body, '', 'head response body')

    response = http.delete(url, options)
    should.equal(response.body, 'delete', 'delete response body')

    options.body = JSON.stringify(body)
    options.headers = {
      'Content-Type': 'application/json'
    }

    response = http.post(url, options)
    should.deepEqual(JSON.parse(response.body), body, 'post response body')

    response = http.put(url, options)
    should.deepEqual(JSON.parse(response.body), body, 'put response body')

    response = http.patch(url, options)
    should.deepEqual(JSON.parse(response.body), body, 'patch response body')

    return true

  },

  before: function(ac, model, callback) {

    // start the server.
    const config = require('cortex-service/lib/config'),
          https = require('https'),
          host = config('sandbox.mocha.http_tls_test_server.host'),
          port = config('sandbox.mocha.http_tls_test_server.port'),
          app = express(),
          bodyParser = require('body-parser'),
          options = {
            key: config('sandbox.mocha.http_tls_test_server.key'),
            cert: config('sandbox.mocha.http_tls_test_server.cert')
          }

    app.use(bodyParser.json())

    app.get('/', function(req, res) {
      res.status(200).send('get')
    })

    app.head('/', function(req, res) {
      res.status(200).send('head')
    })

    app.delete('/', function(req, res) {
      res.status(200).send('delete')
    })

    app.post('/', function(req, res) {
      res.status(200).json(req.body)
    })

    app.put('/', function(req, res) {
      res.status(200).json(req.body)
    })

    app.patch('/', function(req, res) {
      res.status(200).json(req.body)
    })

    httpsServer = https.createServer(options, app)
    httpsServer.listen(port, host, function(err) {

      // ensure the sandbox we are using skips host validation so we can call localhost.
      config('sandbox.debug')._skipHttpHostValidation = config('sandbox.debug').skipHttpHostValidation
      config('sandbox.debug').skipHttpHostValidation = true
      config.flush()

      callback(err)
    })
  },

  after: function(err, result, ac, model, callback) {

    // undo what we have wrought.
    const config = require('cortex-service/lib/config')
    config('sandbox.debug').skipHttpHostValidation = config('sandbox.debug')._skipHttpHostValidation
    config.flush()

    // cleanup server.
    function done(err) {
      if (callback) {
        callback(err, result)
      }
      callback = null
    }
    if (httpsServer) {
      try {
        httpsServer.close(e => {
          done(err)
        })
      } catch (e) {
        done(err)
      }
      return
    }
    done(err)

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
