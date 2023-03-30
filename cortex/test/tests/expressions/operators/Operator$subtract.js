const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$subtract', function() {

  it('Operator$subtract - not a two-element array should throw error', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $subtract: 'literal data'
              }
            )

      await ec.evaluate()
      throw Error('It should fail.')
    } catch (e) {
      const fault = e.toJSON()
      should(fault.errCode).equal('cortex.invalidArgument.query')
      should(fault.reason).equal('$subtract requires an array with exactly 2 elements.')
    }
  })

  it('Operator$subtract - subtract numbers should return difference', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $subtract: [12, 6]
            }
          )
    should(await ec.evaluate()).equal(6)

  })

  it('Operator$subtract - subtract should work with dates', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          inputDate = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $subtract: [inputDate, 50000]
            }
          )

    should((await ec.evaluate()).getTime()).equal(inputDate.getTime() - 50000)

  })

})
