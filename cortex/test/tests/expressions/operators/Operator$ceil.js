const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$ceil', function() {

  it('Operator$ceil - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $ceil: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$ceil - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $ceil: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$ceil - should be ceil', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $ceil: 2.6
            }
          )

    should(await ec.evaluate()).equal(3)

  })

})
