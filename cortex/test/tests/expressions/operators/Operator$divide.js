const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$divide', function() {

  it('Operator$divide - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $divide: ['this is NaN', 2]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$divide - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $divide: ['this is NaN', 2]
          })

    should(result.result).be.null()

  }))

  it('Operator$divide - divide by 0 should be null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $divide: [2, 0]
          })

    should(result.result).equal(null)

  }))

  it('Operator$divide - should be a divided value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $divide: [10, 2]
            }
          )

    should(await ec.evaluate()).equal(5)

  })

})
