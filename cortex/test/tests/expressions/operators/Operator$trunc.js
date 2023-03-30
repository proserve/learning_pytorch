const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$trunc', function() {

  it('Operator$trunc', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $trunc: [ 123.123 ]
            }
          )

    should(await ec.evaluate()).equal(123)

  })

  it('Operator$trunc with decimal place set', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $trunc: [ 123.123, 2 ]
            }
          )

    should(await ec.evaluate()).equal(123.12)

  })

  it('Operator$trunc with negative value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $trunc: [ 123.123, -1 ]
            }
          )

    should(await ec.evaluate()).equal(120)

  })

})
