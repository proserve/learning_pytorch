const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$month', function() {

  it('Operator$month short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $month: new Date(Date.UTC(2020, 9, 1, 0, 0, 15))
            }
          ),
          result = await ec.evaluate()

    should(result).equal(8)
  })

  it('Operator$month with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $month: {
                date: new Date(Date.UTC(2020, 9, 1, 0, 0, 15)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(8)
  })

})
