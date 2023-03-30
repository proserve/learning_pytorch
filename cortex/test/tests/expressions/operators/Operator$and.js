const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$and', function() {

  it('Operator$and - false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $and: [false, true]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$and - true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $and: [true, 1, 'foo']
            }
          )

    should(await ec.evaluate()).equal(true)

  })

})
