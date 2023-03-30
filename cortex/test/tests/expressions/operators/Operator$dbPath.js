const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dbPath', function() {

  it('Operator$dbPath', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dbPath: `org.${server.org.code}.configuration.accounts.enableEmail`
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$dbPath not existing path', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dbPath: `org.${server.org.code}.configuration.accounts.somethingNotExisting`
            }
          )

    should(await ec.evaluate()).equal(undefined)

  })

})
