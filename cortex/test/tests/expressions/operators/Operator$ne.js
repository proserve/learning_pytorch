const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$ne', function() {

  it('Operator$ne true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $ne: [250, 200]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$ne - false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $ne: [200, 200]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

})
