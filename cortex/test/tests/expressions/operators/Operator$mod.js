const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$mod', function() {

  it('Operator$mod - not a two-element array should throw error', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $mod: 'literal data'
              }
            )

      await ec.evaluate()
      throw Error('It should fail.')
    } catch (e) {
      const fault = e.toJSON()
      should(fault.errCode).equal('cortex.invalidArgument.query')
      should(fault.reason).equal('$mod requires an array with exactly 2 elements.')
    }
  })

  it('Operator$mod - first arg NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $mod: ['this is NaN', 2]
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$mod - second arg NaN', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $mod: [12, 'this is NaN']
            }
          )

    should(await ec.evaluate()).be.NaN()

  })

  it('Operator$mod - scripting first arg NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $mod: ['this is NaN', 2]
          })

    should(result.result).be.null()

  }))

  it('Operator$mod - scripting second arg NaN is null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $mod: [12, 'this is NaN']
          })

    should(result.result).be.null()

  }))

  it('Operator$mod - mod by 0 should be null', sandboxed(function() {

    const should = require('should')

    const { evaluate } = require('expressions'),
          result = evaluate({
            $mod: [9, 0]
          })

    should(result.result).equal(null)

  }))

  it('Operator$mod - should be a modulo value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $mod: [11, 3]
            }
          )

    should(await ec.evaluate()).equal(2)

  })

})
