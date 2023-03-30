const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$multiply', function() {

  it('Operator$multiply - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $multiply: [1, 'this is NaN']
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$multiply - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $multiply: [1, 'this is NaN']
          })

    should(result.result).be.null()

  }))

  it('Operator$multiply - should multiply', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $multiply: [1, 2, 3]
            }
          )

    should(await ec.evaluate()).equal(6)

  })

})
