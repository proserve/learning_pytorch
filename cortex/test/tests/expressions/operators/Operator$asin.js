const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$asin', function() {

  it('Operator$asin - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $asin: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$asin - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $asin: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$asin - should return asin value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $asin: 0.5
            }
          )

    should(await ec.evaluate()).equal(0.5235987755982989)

  })

})
