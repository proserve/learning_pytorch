const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$dayOfWeek', function() {

  it('Operator$dayOfWeek ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $dayOfWeek: new Date(2020, 9, 9, 0, 0, 15)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(5)
  })

})
