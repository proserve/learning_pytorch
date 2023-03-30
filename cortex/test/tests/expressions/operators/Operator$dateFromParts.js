const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      moment = require('moment-timezone'),
      should = require('should')

describe('Expressions - Operator$dateFromParts', function() {

  it('Operator$dateFromParts ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateFromParts: {
                year: 2020,
                month: 9,
                day: 24,
                hour: 14,
                minute: 51,
                millisecond: 0,
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual(moment.tz(moment.utc({
      year: 2020,
      month: 9,
      day: 24,
      hour: 14,
      minute: 51,
      millisecond: 0
    }).format(), 'America/Los_Angeles').toDate())

  })

  it('Operator$dateFromParts isoWeek/isoWeekYear', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateFromParts: {
                isoWeekYear: 2020,
                isoWeek: 54
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual(moment.utc({
      hour: 0,
      minute: 0,
      seconds: 0,
      millisecond: 0
    }).isoWeekYear(2020).isoWeek(54).toDate())

  })

})
