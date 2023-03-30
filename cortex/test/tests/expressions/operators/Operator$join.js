const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$join', function() {

  it('Operator$join - not a two-element array should throw error', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $join: 'literal data'
              }
            )

      await ec.evaluate()
      throw Error('It should fail.')
    } catch (e) {
      const fault = e.toJSON()
      should(fault.errCode).equal('cortex.invalidArgument.query')
      should(fault.reason).equal('$join requires an array with exactly 2 elements.')
    }
  })

  it('Operator$join - join should join elements of array', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $join: [{ $array: [2, 3, 4] }, '*']
            }
          )

    should(await ec.evaluate()).equal('2*3*4')

  })

})
