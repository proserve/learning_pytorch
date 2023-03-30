const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$pow', function() {

  it('Operator$pow - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $pow: ['this is NaN', 2]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$pow - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $pow: ['this is NaN', 2]
          })

    should(result.result).be.null()

  }))

  it('Operator$pow - should be a pow value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $pow: [4, 2]
            }
          )

    should(await ec.evaluate()).equal(16)

  })

})
