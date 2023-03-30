const should = require('should'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      loadScript = require('../../../lib/script.loader')

describe('Features - CTXAPI-661 - Conditional events', function() {

  before(async function() {

    const lib = loadScript('CTXAPI-661_event_handler.js')

    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.scripts.insertOne({
        label: 'c_ctxapi_661_expressions_trigger_lib',
        name: 'c_ctxapi_661_expressions_trigger_lib',
        description: 'c_ctxapi_661_expressions_trigger_lib',
        script: script.arguments.lib,
        type: 'library',
        configuration: {
          export: 'c_ctxapi_661_expressions_trigger_lib'
        }
      }).execute()
    }, {
      runtimeArguments: { lib }
    }))

  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_661_expressions_trigger_lib' }).execute()
  }))

  it('should trigger a conditional event if expression matches', async function() {

    let result

    result = await promised(null, sandboxed(function() {
      /* global org, script, ObjectID */
      const key = `c_ctxapi_661_event_${new ObjectID()}`,
            cache = require('cache')
      org.objects.event.insertOne(
        {
          type: 'script',
          key,
          event: 'c_ctxapi_661_event',
          principal: script.principal.email,
          retention: 1,
          if: {
            $eq: ['$$CONTEXT.principal.email', 'james+admin@medable.com']
          },
          param: {
            theMessage: 'The sun is red'
          }
        }
      ).grant('update').bypassCreateAcl().execute()

      require('debug').sleep(2000)

      return {
        success: cache.get(key),
        error: cache.get('ctxapi_661_error')
      }
    }))

    should.exist(result)
    should.exist(result.success)
    result.success.should.deepEqual({
      theMessage: 'The sun is red'
    })
    should.not.exist(result.error)

  })

  it('should not trigger a conditional event if expression does not match', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const fun = `
                    /* global org, script */
                    return org.objects.event.insertOne(
                      {
                        type: 'script',
                        key: 'not_matching_event',
                        event: 'c_ctxapi_661_event',
                        principal: script.principal.email,
                        retention: 1,
                        if: {
                          $eq: ['$$CONTEXT.principal.email', 'james+admin@medable.com']
                        },
                        param: {
                          theMessage: 'I do NOT expect this to run'
                        }
                      }
                    ).grant('update').bypassCreateAcl().execute()
                  `,
            cache = require('cache'),
            debug = require('debug'),
            expressions = require('expressions')

      expressions.run({
        $as: {
          input: {
            principal: 'james+provider@medable.com',
            grant: { $acl: 'role.administrator.script' },
            skipAcl: true,
            bypassCreateAcl: true,
            roles: [],
            scope: '*'
          },
          in: {
            $function: {
              body: fun,
              args: []
            }
          }
        }
      })

      debug.sleep(1000)

      return {
        success: cache.get('not_matching_event'),
        error: cache.get('ctxapi_661_error')
      }
    }))

    should.exist(result)
    should.not.exist(result.success)
    should.not.exist(result.error)

  })

})
