'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { org } = require('../../../lib/server'),
      should = require('should')

describe('CTXAPI-1834 - Export conditional legacy scripts', function() {

  before(sandboxed(function() {

    org.objects.script.insertOne({
      label: 'CTXAPI-1834 Trigger',
      name: 'c_ctxapi_1834_trigger',
      type: 'trigger',
      script: `
          console.log('Test CTXAPI-1834')
        `,
      configuration: {
        object: 'account',
        event: 'update.before'
      },
      if: {
        $eq: [
          '$$ROOT.email',
          'test@medable.com'
        ]
      }
    }).execute()

    org.objects.script.insertOne({
      label: 'CTXAPI-1834 Job',
      name: 'c_ctxapi_1834_job',
      type: 'job',
      script: `
          console.log('Test CTXAPI-1834')
        `,
      configuration: {
        cron: '0 0 * * *'
      },
      if: {
        $eq: [
          '$$DATE',
          '2032-09-01T20:42:34.333Z'
        ]
      }
    }).execute()

    org.objects.script.insertOne({
      label: 'CTXAPI-1834 Route',
      name: 'c_ctxapi_1834_route',
      type: 'route',
      script: ` return 'Test CTXAPI-1834' `,
      configuration: {
        acl: 'account.public',
        method: 'get',
        path: '/c_ctxapi_1834'
      },
      if: {
        $eq: [
          '$$SCRIPT.principal.email',
          'developer@medable.com'
        ]
      }
    }).execute()

  }))

  after(sandboxed(function() {

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1834_trigger' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1834_job' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1834_route' }).execute()

  }))

  it('should export legacy scripts with conditionals', async() => {

    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer'),
            manifest = {
              dependencies: false,
              object: 'manifest',
              scripts: {
                includes: [
                  'c_ctxapi_1834_trigger',
                  'c_ctxapi_1834_job',
                  'c_ctxapi_1834_route'
                ]
              }
            }

      return exportEnvironment({ manifest }).toArray()
    }))

    should.exist(result)
    result.should.deepEqual([
      {
        active: true,
        configuration: {
          event: 'update.before',
          inline: false,
          object: 'account',
          paths: []
        },
        environment: '*',
        if: {
          $eq: [
            '$$ROOT.email',
            'test@medable.com'
          ]
        },
        label: 'CTXAPI-1834 Trigger',
        language: 'javascript/es6',
        name: 'c_ctxapi_1834_trigger',
        object: 'script',
        optimized: false,
        principal: null,
        resource: 'script.c_ctxapi_1834_trigger',
        script: "console.log('Test CTXAPI-1834')",
        type: 'trigger',
        weight: 0
      },
      {
        active: true,
        configuration: {
          cron: '0 0 * * *'
        },
        environment: '*',
        if: {
          $eq: [
            '$$DATE',
            '2032-09-01T20:42:34.333Z'
          ]
        },
        label: 'CTXAPI-1834 Job',
        language: 'javascript/es6',
        name: 'c_ctxapi_1834_job',
        object: 'script',
        optimized: false,
        principal: null,
        resource: 'script.c_ctxapi_1834_job',
        script: "console.log('Test CTXAPI-1834')",
        type: 'job',
        weight: 0
      },
      {
        active: true,
        configuration: {
          acl: [
            'account.public'
          ],
          apiKey: null,
          authValidation: 'legacy',
          method: 'get',
          path: '/c_ctxapi_1834',
          plainText: false,
          priority: 0,
          system: false,
          urlEncoded: false
        },
        environment: '*',
        if: {
          $eq: [
            '$$SCRIPT.principal.email',
            'developer@medable.com'
          ]
        },
        label: 'CTXAPI-1834 Route',
        language: 'javascript/es6',
        name: 'c_ctxapi_1834_route',
        object: 'script',
        optimized: false,
        principal: null,
        resource: 'script.c_ctxapi_1834_route',
        script: "return 'Test CTXAPI-1834'",
        type: 'route',
        weight: 0
      },
      {
        dependencies: false,
        object: 'manifest',
        scripts: {
          includes: [
            'c_ctxapi_1834_trigger',
            'c_ctxapi_1834_job',
            'c_ctxapi_1834_route'
          ]
        }
      },
      {
        dependencies: {},
        object: 'manifest-dependencies'
      },
      {
        object: 'manifest-exports',
        resources: [
          'script.c_ctxapi_1834_job',
          'script.c_ctxapi_1834_route',
          'script.c_ctxapi_1834_trigger'
        ]
      }
    ])

  })

})
