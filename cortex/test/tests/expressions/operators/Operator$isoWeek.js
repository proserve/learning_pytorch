const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$isoWeek', function() {

  it('Operator$isoWeek short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeek: new Date(2020, 9, 9, 0, 0, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(41)
  })

  it('Operator$isoWeek long call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeek: {
                date: new Date(2020, 9, 9, 0, 0, 15)
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(41)
  })

  it('Operator$isoWeek with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeek: {
                date: new Date(2020, 9, 14, 0, 0, 15),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(42)
  })

})
