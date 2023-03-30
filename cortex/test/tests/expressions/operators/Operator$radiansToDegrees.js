const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$radiansToDegrees', function() {

  it('Operator$radiansToDegrees - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $radiansToDegrees: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$radiansToDegrees - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $radiansToDegrees: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$radiansToDegrees - should be a degree value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $radiansToDegrees: 1.5707963267948966
            }
          )

    should(await ec.evaluate()).equal(90)

  })

})
