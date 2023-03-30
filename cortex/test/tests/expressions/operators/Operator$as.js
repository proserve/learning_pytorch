const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$as', function() {

  it('Operator$as', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $let: {
                vars: {
                  before: '$$CONTEXT.principal.email'
                },
                in: {
                  $as: {
                    input: {
                      principal: 'james+patient@medable.com',
                      grant: 4,
                      skipAcl: true,
                      bypassCreateAcl: true,
                      roles: [], // roles to assign
                      scope: '*'
                    },
                    in: {
                      $array: ['$$before', '$$CONTEXT.principal.email', '$$CONTEXT.principal.skipAcl', '$$CONTEXT.grant', '$$CONTEXT.allow']
                    }
                  }
                }
              }
            }
          )

    should(await ec.evaluate()).deepEqual(['james+admin@medable.com', 'james+patient@medable.com', true, 4, 0])

  })

  it('Operator$as short form', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $let: {
                vars: {
                  before: '$$CONTEXT.principal.email'
                },
                in: {
                  $as: {
                    input: 'james+patient@medable.com',
                    in: {
                      $array: ['$$before', '$$CONTEXT.principal.email']
                    }
                  }
                }
              }
            }
          )

    should(await ec.evaluate()).deepEqual(['james+admin@medable.com', 'james+patient@medable.com'])

  })

})
