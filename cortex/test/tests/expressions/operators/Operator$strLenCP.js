const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$strLenCP', function() {

  it('Operator$strLenCP', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strLenCP: '寿司'
            }
          )

    should(await ec.evaluate()).equal(2)

  })

})
