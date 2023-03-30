const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      sandboxed = require('../../../lib/sandboxed'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$env', function() {

  before(sandboxed(function() {

    const docs = [
      {
        configuration: {
          export: 'operator__env'
        },
        label: 'operator__env',
        name: 'operator__env',
        object: 'script',
        type: 'library',
        script: `

      const { env } = require('decorators')

      class Test {

        @env
        operator__env = 'operator__env'
        
      }

    `
      },
      {
        object: 'manifest',
        scripts: {
          includes: ['*']
        }
      }
    ]
    require('developer').environment.import(docs, { backup: false }).toArray()

  }))

  it('Operator$env', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $env: 'operator__env'
            }
          )

    should(await ec.evaluate()).deepEqual('operator__env')

  })

})
