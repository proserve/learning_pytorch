const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$cos', function() {

  it('Operator$cos - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $cos: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$cos - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $cos: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$cos - should be cos value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $cos: 10
            }
          )

    should(await ec.evaluate()).equal(-0.8390715290764524)

  })

})
