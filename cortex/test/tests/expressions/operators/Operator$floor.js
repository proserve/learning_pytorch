const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$floor', function() {

  it('Operator$floor - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $floor: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$floor - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $floor: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$floor - should be floored', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $floor: 1.1
            }
          )

    should(await ec.evaluate()).equal(1)

  })

})
