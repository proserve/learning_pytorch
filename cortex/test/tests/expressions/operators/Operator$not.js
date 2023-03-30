const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$not', function() {

  it('Operator$not - not false should be true', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $not: false
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$not - not true should be false', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $not: true
            }
          )

    should(await ec.evaluate()).equal(false)

  })

})
