const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$max', function() {

  it('Operator$max - not an array should throw error', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $max: 'literal data'
              }
            )

      await ec.evaluate()
      throw Error('It should fail.')
    } catch (e) {
      const fault = e.toJSON()
      should(fault.errCode).equal('cortex.invalidArgument.query')
      should(fault.reason).equal('$max requires an array with 0 to 100 elements.')
    }
  })

  it('Operator$max - max numbers should return maximum value', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $max: [1, 7, 5]
            }
          )
    should(await ec.evaluate()).equal(7)

  })

})
