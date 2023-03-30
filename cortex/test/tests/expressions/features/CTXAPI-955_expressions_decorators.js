'use strict'
const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      loadScript = require('../../../lib/script.loader'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - decorators', function() {

  before(async() => {
    const expressionLib = loadScript('CTXAPI-955_ExpressionLib.js')
    await promised(null, sandboxed(function() {
      /* global script, org */
      org.objects.scripts.insertOne({
        label: 'CTXAPI-955 Expression Library',
        name: 'c_ctxapi_955_expression_lib',
        description: 'Library expression decorators',
        type: 'library',
        script: script.arguments.expressionLib,
        configuration: {
          export: 'c_ctxapi_955_expression_lib'
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

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_955_expression_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_test_conditional_acl' }).execute()

  }))

  it('should set a random value from the library decorator', async() => {
    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([{
        $project: '$$ROOT'
      }, {
        $pipeline: {
          in: 'aexp__set_random'
        }
      }],
      [
        {
          name: 'gaston'
        },
        {
          name: 'james'
        },
        {
          name: 'joaquin'
        }
      ]
      ).toArray()
    }))
    should.exist(result)
    should.exists(result[0].random)
    should.exists(result[1].random)
    should.exists(result[2].random)
  })

  it('should pick values from obejct', async() => {
    const result = await promised(null, sandboxed(function() {
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
    should.exists(result)
    result[0].should.deepEqual({ email: 'gaston@medable.com' })
    result[1].should.deepEqual({ email: 'james@medable.com', mobile: '+19999999999' })
    result[2].should.deepEqual({ email: 'joaquin@medable.com' })
  })

  it('shloud import with conditional acl', async() => {
    const acls = [
            {
              'allow': 'read',
              'expression': {
                '$regexMatch': {
                  'input': '$$ROOT.c_who',
                  'regex': '^james'
                }
              },
              'type': 'expression'
            },
            'expression.aexp__acl_gaston_if',
            'expression.aexp__acl_joaquin_grant'
          ],
          result = await promised(null, sandboxed(function() {
            const acls = script.arguments,
                  data = [
                    {
                      'allowConnections': true,
                      'auditing': {
                        'enabled': false
                      },
                      'canCascadeDelete': false,
                      'connectionOptions': {
                        'requireAccept': true,
                        'requiredAccess': 5,
                        'sendNotifications': true
                      },
                      'createAcl': [
                        'account.public'
                      ],
                      'defaultAcl': [
                        'owner.delete'
                      ],
                      'favorite': false,
                      'hasETag': false,
                      'hasOwner': true,
                      'isDeletable': true,
                      'isUnmanaged': false,
                      'isVersioned': false,
                      'label': 'Test Conditional Acls',
                      'localized': false,
                      'name': 'c_test_conditional_acl',
                      'object': 'object',
                      'objectTypes': [],
                      'properties': [
                        {
                          'label': 'c_key',
                          'name': 'c_key',
                          'type': 'UUID',
                          'autoGenerate': true,
                          'indexed': true,
                          'unique': true,
                          'writable': false
                        },
                        {
                          'acl': acls,
                          'aclOverride': false,
                          'array': false,
                          'auditable': false,
                          'canPull': true,
                          'canPush': true,
                          'creatable': false,
                          'defaultValue': [],
                          'dependencies': [],
                          'history': false,
                          'indexed': true,
                          'label': 'The String',
                          'localization': {
                            'acl': [],
                            'aclOverride': false,
                            'enabled': false,
                            'fallback': true,
                            'fixed': '',
                            'readAccess': 'read',
                            'strict': true,
                            'valid': [],
                            'writeAccess': 'update'
                          },
                          'lowercase': false,
                          'maxItems': 100,
                          'maxShift': false,
                          'minItems': 0,
                          'name': 'c_string',
                          'optional': false,
                          'readAccess': 'read',
                          'readable': true,
                          'removable': false,
                          'trim': false,
                          'type': 'String',
                          'unique': false,
                          'uniqueValues': false,
                          'uppercase': false,
                          'validators': [],
                          'writable': true,
                          'writeAccess': 'update',
                          'writeOnCreate': true
                        },
                        {
                          'acl': [],
                          'aclOverride': false,
                          'array': false,
                          'auditable': false,
                          'canPull': true,
                          'canPush': true,
                          'creatable': false,
                          'defaultValue': [],
                          'dependencies': [],
                          'history': false,
                          'indexed': true,
                          'label': 'Who',
                          'localization': {
                            'acl': [],
                            'aclOverride': false,
                            'enabled': false,
                            'fallback': true,
                            'fixed': '',
                            'readAccess': 'read',
                            'strict': true,
                            'valid': [],
                            'writeAccess': 'update'
                          },
                          'lowercase': false,
                          'maxItems': 100,
                          'maxShift': false,
                          'minItems': 0,
                          'name': 'c_who',
                          'optional': false,
                          'readAccess': 'read',
                          'readable': true,
                          'removable': false,
                          'trim': false,
                          'type': 'String',
                          'unique': false,
                          'uniqueValues': false,
                          'uppercase': false,
                          'validators': [],
                          'writable': true,
                          'writeAccess': 'update',
                          'writeOnCreate': true
                        }
                      ],
                      'resource': 'object.c_test_conditional_acl',
                      'shareAcl': [],
                      'shareChain': [],
                      'uniqueKey': 'c_key',
                      'validateOwner': true
                    },
                    {
                      'object': 'manifest',
                      'objects': [
                        {
                          'includes': [
                            '*'
                          ],
                          'name': 'c_test_conditional_acl'
                        }
                      ]
                    },
                    {
                      'dependencies': {},
                      'object': 'manifest-dependencies'
                    },
                    {
                      'object': 'manifest-exports',
                      'resources': [
                        'object.c_test_conditional_acl'
                      ]
                    }
                  ],
                  importLog = require('developer').environment.import(data, { backup: false }).toArray(),
                  docs = require('developer').environment.export({
                    manifest: {
                      'object': 'manifest',
                      'objects': [
                        {
                          'includes': [
                            '*'
                          ],
                          'name': 'c_test_conditional_acl'
                        }
                      ]
                    }
                  }).toArray()

            return { importLog, docs }
          }, {
            scriptArguments: acls
          }))

    should.exist(result)
    // eslint-disable-next-line one-var
    const doc = result.docs.find(doc => doc.name === 'c_test_conditional_acl')
    should.exist(doc)
    // eslint-disable-next-line one-var
    const prop = doc.properties.find(p => p.name === 'c_string')
    should.exist(prop)
    prop.acl.should.deepEqual([])
  })
})
