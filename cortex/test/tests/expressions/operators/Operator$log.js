const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$log', function() {

  it('Operator$log - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $log: ['this is NaN', 2]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$log - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $log: ['this is NaN', 2]
          })

    should(result.result).be.null()

  }))

  it('Operator$log - should be a log value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $log: [4, 2]
            }
          )

    should(await ec.evaluate()).equal(2)

  })

})
