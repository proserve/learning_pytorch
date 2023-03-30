const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$reverseArray', function() {

  it('Operator$reverseArray', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $reverseArray: { $array: ['this is NaN', 2, 3, 5] }
            }
          )

    should(await ec.evaluate()).deepEqual([5, 3, 2, 'this is NaN'])

  })

})
