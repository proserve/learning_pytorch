const { promised } = require('../../../../lib/utils'),
      sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      consts = require('../../../../lib/consts')

describe('Expressions - Expressions are stateless', function() {

  it('should add child context with new scope for $as and $let ops', async() => {
    let result

    result = await promised(null, sandboxed(function() {
      const { evaluate } = require('expressions')
      return evaluate(
        {
          $let: {
            vars: {
              before: '$$CONTEXT.principal.email'
            },
            in: {
              $as: {
                input: 'james+provider@medable.com',
                in: {
                  $let: {
                    vars: {
                      after: '$$CONTEXT.principal.email'
                    },
                    in: {
                      $array: ['$$before', '$$after']
                    }
                  }
                }
              }
            }
          }
        }
      )
    }))

    should.exist(result)
    result.should.containDeep({
      result: [
        'james+admin@medable.com',
        'james+provider@medable.com'
      ],
      contexts: {
        $let: {
          count: 1,
          evaluations: {
            'vars.before': {
              count: 1
            },
            'in.$as.input': {
              count: 1
            },
            'in.$as': {
              count: 1
            }
          },
          contexts: {
            'in.$as': {
              contexts: {
                'in.$let': {
                  count: 1,
                  evaluations: {
                    'vars.after': {
                      count: 1
                    },
                    'in.$array.0': {
                      count: 1
                    },
                    'in.$array.1': {
                      count: 1
                    },
                    'in.$array': {
                      count: 1
                    }
                  },
                  variableScope: [
                    'after'
                  ]
                }
              },
              accessScope: {
                object: 'ac',
                allow: 0,
                resolved: 0,
                grant: 0,
                roles: [
                  consts.roles.provider
                ],
                instanceRoles: [],
                principal: {
                  type: 1,
                  object: 'account',
                  roles: [
                    consts.roles.provider
                  ],
                  locked: false,
                  state: 'verified',
                  email: 'james+provider@medable.com',
                  name: {
                    additional: [],
                    first: 'Test',
                    last: 'Provider'
                  }
                },
                org: {
                  code: 'test-org'
                },
                context: {
                  object: ''
                }
              }
            }
          },
          variableScope: []
        }
      },
      accessScope: {
        object: 'ac',
        allow: 0,
        resolved: 0,
        grant: 0,
        roles: [
          consts.roles.admin,
          consts.roles.developer,
          consts.roles.support
        ],
        instanceRoles: [],
        principal: {
          type: 1,
          object: 'account',
          roles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          locked: false,
          state: 'verified',
          email: 'james+admin@medable.com',
          name: {
            additional: [],
            first: 'Test',
            last: 'Administrator'
          }
        },
        org: {
          code: 'test-org'
        },
        context: {
          object: ''
        }
      },
      variableScope: [
        '$$ROOT',
        'before'
      ]
    })

  })

})
