const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$stdDevSamp', function() {

  it('Operator$stdDevSamp - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $stdDevSamp: ['this is NaN', 1, 2, 3, 4, 5]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$stdDevSamp - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $stdDevSamp: ['this is NaN', 1, 2, 3, 4, 5]
          })

    should(result.result).be.null()

  }))

  it('Operator$stdDevSamp - should be a standard deviation sample value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $stdDevSamp: [1, 2, 3, 4, 5]
            }
          )

    should(await ec.evaluate()).equal(1.5811388300841898)

  })

})
