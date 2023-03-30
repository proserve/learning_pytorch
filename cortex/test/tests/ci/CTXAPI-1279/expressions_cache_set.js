'use strict'

const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      { promised } = require('../../../../lib/utils'),
      should = require('should'),
      sinon = require('sinon'),
      { cache: { memory } } = require('../../../../lib/modules')

describe('Issues - CTXAPI-1279 - Expressions not caching after compilation', function() {
  before(async() => {
    const expressionLib = loadScript('CTXAPI-1279_ExpressionLib.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-1279 Expression Library',
        name: 'c_ctxapi_1279_expression_lib',
        description: 'Library expression decorators',
        type: 'library',
        script: script.arguments.expressionLib,
        configuration: {
          export: 'c_ctxapi_1279_expression_lib'
        }
      }).execute()
    }, {
      principal: server.principals.admin,
      runtimeArguments: {
        expressionLib
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1279_expression_lib' }).execute()

  }))

  it('should cache expressions once compiled', async() => {
    const expressionsCache = memory.get('cortex.expressions.runtime'),
          cacheSetSpy = sinon.spy(expressionsCache, 'set'),
          cacheGetSpy = sinon.spy(expressionsCache, 'get'),

          result = await promised(null, sandboxed(function() {
            return require('expressions').pipeline.run([{
              $project: {
                $expression: {
                  in: 'aexp__pick_values'
                }
              }
            }],
            [
              {
                id: 1,
                name: 'gaston',
                email: 'gaston@medable.com'
              },
              {
                id: 2,
                name: 'james',
                mobile: '+19999999999',
                email: 'james@medable.com'
              },
              {
                id: 3,
                name: 'joaquin',
                email: 'joaquin@medable.com'
              }
            ]
            ).toArray()
          }))
    should.exist(result)

    // we should read from the cache for each entry
    should.equal(cacheGetSpy.callCount, 3)
    // but only set the cache once
    should.equal(cacheSetSpy.callCount, 1)

    expressionsCache.get.restore()
    expressionsCache.set.restore()

  })

})
