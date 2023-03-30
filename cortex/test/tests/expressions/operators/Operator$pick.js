const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$pick', function() {

  it('Operator$pick - ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $pick: ['$$ROOT', 'a', 'b']
            },
            {
              $$ROOT: {
                a: 1,
                b: 2,
                c: 3
              }
            }
          ),
          result = await ec.evaluate()

    should(Object.keys(result).length).equal(2)
    should(result.a).equal(1)
    should(result.b).equal(2)

  })

})
