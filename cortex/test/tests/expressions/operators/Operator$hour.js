const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$hour', function() {

  it('Operator$hour short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $hour: new Date(2020, 9, 9, 0, 10, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(0)
  })

  it('Operator$hour long call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $hour: {
                date: new Date(2020, 9, 9, 0, 10, 15)
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(0)
  })

  it('Operator$hour with timezone call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $hour: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 10, 15)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(17)
  })

})
