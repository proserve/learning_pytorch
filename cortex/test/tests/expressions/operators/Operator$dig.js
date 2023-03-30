const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dig', function() {

  it('Operator$dig', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dig: [{ $dbPath: `org.${server.org.code}.configuration` }, 'accounts.enableUsername']
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$dig not found', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dig: [{ $dbPath: `org.${server.org.code}.configuration` }, 'accounts.notExistingProp']
            }
          )

    should(await ec.evaluate()).equal(undefined)

  })

})
