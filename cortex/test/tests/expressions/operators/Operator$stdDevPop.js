const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$stdDevPop', function() {

  it('Operator$stdDevPop - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $stdDevPop: ['this is NaN', 1, 2, 3, 4, 5]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$stdDevPop - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $stdDevPop: ['this is NaN', 1, 2, 3, 4, 5]
          })

    should(result.result).be.null()

  }))

  it('Operator$stdDevPop - should be a standard deviation population value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $stdDevPop: [1, 2, 3, 4, 5]
            }
          )

    should(await ec.evaluate()).equal(1.4142135623730951)

  })

})
