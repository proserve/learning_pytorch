const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$isoWeekYear', function() {

  it('Operator$isoWeekYear short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeekYear: new Date(2020, 9, 9, 0, 0, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(2020)
  })

  it('Operator$isoWeekYear long call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeekYear: {
                date: new Date(2020, 9, 9, 0, 0, 15)
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(2020)
  })

  it('Operator$isoWeekYear with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoWeekYear: {
                date: new Date(2021, 0, 1, 0, 0, 15),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(2020)
  })

})
