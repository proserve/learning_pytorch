'use strict'

/* global before, after, org, script */

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      server = require('../../lib/server')

describe('Issues - CTXAPI-1228 - import process should disable policies', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-1228 Policies Library',
        name: 'c_ctxapi_1228_policies_lib',
        description: 'Library for policies',
        type: 'library',
        script: `
            const { policy } = require('decorators'),
                  cache = require('cache')
            class CTXAPI1228 {
            
              @policy({
                methods: ['post'],
                paths: '/developer/environment/import',
                action: 'Script'
              })
              policyCTXAPI1228() {
                cache.set('__policy', true)
              }
            }
            module.exports = CTXAPI1228
        `,
        configuration: {
          export: 'c_ctxapi_1228_policies_lib'
        }
      }).execute()
    }, {
      principal: server.principals.admin
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      return org.objects.scripts.deleteOne({ name: 'c_ctxapi_1228_policies_lib' }).skipAcl().grant(8).execute()
    }))
  })

  it('import should disable policies', async() => {

    await server.sessions.admin
      .post(server.makeEndpoint('/developer/environment/import?backup=false'))
      .set({
        ...server.getSessionHeaders(),
        'Content-Type': 'application/json'
      })
      .send({ object: 'list',
        data: [
          {
            'object': 'manifest',
            'config': {
              'includes': ['*']
            }
          },
          {
            'name': 'c_test_config',
            'object': 'config',
            'value': {
              'version': '5.0.0'
            }
          }
        ] })

    const result = await promised(null, sandboxed(function() {
      return require('cache').get('__policy')
    }))

    should.equal(result, undefined)
  })

})
