const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dayOfYear', function() {

  it('Operator$dayOfYear short call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dayOfYear: new Date(Date.UTC(2020, 9, 9, 0, 0, 15))
            }
          ),
          result = await ec.evaluate()

    should(result).equal(282)
  })

  it('Operator$dayOfYear long call', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dayOfYear: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 0, 15))
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(282)
  })

  it('Operator$dayOfYear with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dayOfYear: {
                date: new Date(Date.UTC(2020, 9, 9, 0, 0, 15)),
                timezone: 'America/Los_Angeles'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(282)
  })

})
