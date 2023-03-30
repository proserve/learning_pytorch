const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$year', function() {

  it('Operator$year short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $year: new Date(Date.UTC(2020, 9, 9, 0, 0, 15))
            }
          ),
          result = await ec.evaluate()

    should(result).equal(2020)
  })

  it('Operator$year with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $year: {
                date: new Date(Date.UTC(2020, 0, 1, 0, 0, 15)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(2019)
  })

})
