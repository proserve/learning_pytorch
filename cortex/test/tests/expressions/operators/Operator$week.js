const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$week', function() {

  it('Operator$week with short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $week: new Date(2020, 9, 9, 0, 0, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(41)
  })

  it('Operator$week with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $week: {
                date: new Date(2020, 9, 9, 0, 0, 15),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(41)
  })

})
