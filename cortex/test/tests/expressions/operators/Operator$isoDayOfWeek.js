const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$isoDayOfWeek', function() {

  it('Operator$isoDayOfWeek short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoDayOfWeek: new Date(Date.UTC(2020, 9, 9, 0, 0, 15))
            }
          ),
          result = await ec.evaluate()

    should(result).equal(4)
  })

  it('Operator$isoDayOfWeek with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoDayOfWeek: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 0, 15)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(4)
  })

  it('Operator$isoDayOfWeek with invalid timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $isoDayOfWeek: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 0, 15)),
                timezone: 'America/Not_Exists'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(undefined)
  })

})
