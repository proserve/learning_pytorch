'use strict'

/* global before */

const sandboxed = require('../../../lib/sandboxed'),
      { asyncHandler } = require('cortex-service/lib/utils/output'),
      { isId } = require('cortex-service/lib/utils/ids'),
      { parse } = require('cortex-service/lib/utils/json'),
      http = require('http'),
      request = require('request'),
      express = require('express'),
      should = require('should')

describe('1479 - transforms should allow setting of headers prior to flushing headers when possible.', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.objects.insertOne({
      label: 'c_ctxapi1479public',
      name: 'c_ctxapi1479public',
      defaultAcl: ['account.anonymous.read', 'owner.delete'],
      createAcl: 'account.public'
    }).execute()

    org.objects.c_ctxapi1479public.insertMany([{}, {}, {}]).execute()

  }))

  it('transforms allow late-setting content type headers.', async function() {

    let expressServer

    try {

      const app = express(),
            server = (() => {
              expressServer = http.createServer(app)
              expressServer.listen()
              return expressServer
            })(),
            port = server.address().port,
            url = `http://127.0.0.1:${port}/`

      // return a cursor that sets the response header late.
      app.get('/', asyncHandler(async(req) => sandboxed(
        function() {
          return org.objects.c_ctxapi1479public.find().transform(`
              beforeAll() {
                require('response').setHeader('content-type', 'application/x-ndmjson')
              }
              each( { _id }) {                       
                return _id
              }
            `)
        },
        {
          req
        }
      )()))

      await new Promise((resolve, reject) => {
        request(
          url,
          function(err, response, body) {
            try {
              if (!err) {
                should.equal(
                  response.headers['content-type'],
                  'application/x-ndmjson; charset=utf-8'
                )
                should.equal(
                  true,
                  body
                    .split('\n')
                    .filter(v => v.trim())
                    .map(v => parse(v, 'mjson'))
                    .every(v => isId(v))
                )
              }
            } catch (e) {
              err = e
            }
            err ? reject(err) : resolve()

          })
      })

    } finally {

      if (expressServer) {
        try {
          await new Promise(resolve => {
            expressServer.close(() => {
              resolve()
            })
          })
        } catch (e) {
        }
      }

    }

  })

})
