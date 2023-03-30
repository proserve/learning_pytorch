const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$slice', function() {

  it('Operator$slice', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $slice: [{ $array: ['this is NaN', 2, 3, 5] }, 1, 3]
            }
          )

    should(await ec.evaluate()).deepEqual([2, 3])

  })

})
