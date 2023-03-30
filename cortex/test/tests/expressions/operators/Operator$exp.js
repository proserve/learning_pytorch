const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$exp', function() {

  it('Operator$exp - NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $exp: 'this is NaN'
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$exp - scripting NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $exp: 'this is NaN'
          })

    should(result.result).be.null()

  }))

  it('Operator$exp - should be a exp value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $exp: 4
            }
          )

    should(await ec.evaluate()).equal(54.598150033144236)

  })

})
