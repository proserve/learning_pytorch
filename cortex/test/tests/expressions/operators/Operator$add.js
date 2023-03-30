const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$add', function() {

  it('Operator$add - not an array should throw error', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $add: 'literal data'
              }
            )

      await ec.evaluate()
      throw Error('It should fail.')
    } catch (e) {
      const fault = e.toJSON()
      should(fault.errCode).equal('cortex.invalidArgument.query')
      should(fault.reason).equal('$add requires an array.')
    }
  })

  it('Operator$add - add numbers should return total', async() => {
    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $add: [1, 2, 3, 4, 5]
            }
          )
    should(await ec.evaluate()).equal(15)

  })

  it('Operator$add - add should be able to sum dates', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          inputDate = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $add: [inputDate, 50000]
            }
          )

    should((await ec.evaluate()).getTime()).equal(inputDate.getTime() + 50000)

  })

})
