const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      moment = require('moment-timezone'),
      should = require('should')

describe('Expressions - Operator$dateFromString', function() {

  it('Operator$dateFromString ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateFromString: {
                dateString: '2020-10-09 00:00:15',
                format: 'YYYY-MM-DD HH:mm:ss',
                timezone: 'America/Los_Angeles',
                onError: null,
                onNull: new Date()
              }
            }
          ),
          result = await ec.evaluate(),

          expected = moment.utc(new Date('2020-10-09 00:00:15'), 'YYYY-MM-DD HH:mm:ss').tz('America/Los_Angeles').toDate()
    should(result).deepEqual(expected)
  })

  it('Operator$dateFromString invalid date', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateFromString: {
                dateString: 'invalid date',
                onError: 999
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(999)
  })

})
