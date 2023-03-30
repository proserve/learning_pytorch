const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$omit', function() {

  it('Operator$omit - ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $omit: ['$$ROOT', 'a', 'b']
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

    should(Object.keys(result).length).equal(1)
    should(result.c).equal(3)

  })

})
