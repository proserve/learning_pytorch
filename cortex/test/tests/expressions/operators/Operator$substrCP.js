const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$substrCP', function() {

  it('Operator$substrCP', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $substrCP: ['𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡', 3, 2]
            }
          )

    should(await ec.evaluate()).equal('𝟛𝟜')

  })

})
