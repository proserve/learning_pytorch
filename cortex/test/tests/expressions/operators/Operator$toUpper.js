const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toUpper', function() {

  it('Operator$toUpper', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toUpper: 'my string'
            }
          )

    should(await ec.evaluate()).equal('MY STRING')

  })

})
