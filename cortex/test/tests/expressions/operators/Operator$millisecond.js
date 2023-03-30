const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$millisecond', function() {

  it('Operator$millisecond short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $millisecond: new Date(2020, 9, 9, 0, 0, 15, 100)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(100)
  })

  it('Operator$millisecond long call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $millisecond: {
                date: new Date(2020, 9, 9, 0, 0, 15, 100),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(100)
  })

})
