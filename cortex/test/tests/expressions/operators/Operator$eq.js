const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$eq', function() {

  it('Operator$eq true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $eq: [200, 200]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$eq - false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $eq: [250, 200]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

})
