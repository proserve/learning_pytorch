const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dateToString', function() {

  it('Operator$dateToString ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dateToString: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 0, 15)),
                format: 'MM/DD/YYYY Z',
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual('10/08/2020 -07:00')
  })

})
