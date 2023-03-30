const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$atan2', function() {

  it('Operator$atan2 - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $atan2: ['this is NaN', 2]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$atan2 - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $atan2: ['this is NaN', 2]
          })

    should(result.result).be.null()

  }))

  it('Operator$atan2 - should return atan2 value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $atan2: [1, 2]
            }
          )

    should(await ec.evaluate()).equal(0.4636476090008061)

  })

})
