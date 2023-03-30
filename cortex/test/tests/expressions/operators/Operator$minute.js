const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$minute', function() {

  it('Operator$minute short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $minute: new Date(2020, 9, 9, 0, 10, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(10)
  })

  it('Operator$minute long call and timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $minute: {
                date: new Date(2020, 9, 9, 0, 10, 15),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(10)
  })

})
