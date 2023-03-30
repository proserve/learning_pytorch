const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dateToParts', function() {

  it('Operator$dateToParts with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateToParts: {
                date: new Date(Date.UTC(2020, 9, 1, 0, 0, 0, 0)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual({
      year: 2020,
      month: 8,
      day: 30,
      hour: 17,
      minute: 0,
      second: 0,
      millisecond: 0
    })
  })

  it('Operator$dateToParts with iso8601', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateToParts: {
                date: new Date(Date.UTC(2020, 9, 1, 0, 0, 0, 0)),
                timezone: 'America/Los_Angeles',
                iso8601: true
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual({
      isoWeekYear: 2020,
      isoWeek: 40,
      isoDayOfWeek: 3,
      hour: 17,
      minute: 0,
      second: 0,
      millisecond: 0
    })
  })

})
