const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$or', function() {

  it('Operator$or - false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $or: [false]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$or - true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $or: [false, false, 0, '', true]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

})
