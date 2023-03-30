const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$degreesToRadians', function() {

  it('Operator$degreesToRadians - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $degreesToRadians: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$degreesToRadians - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $degreesToRadians: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$degreesToRadians - should be a radian value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $degreesToRadians: 90
            }
          )

    should(await ec.evaluate()).equal(1.5707963267948966)

  })

})
