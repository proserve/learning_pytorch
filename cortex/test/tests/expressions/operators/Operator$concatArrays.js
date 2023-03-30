const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $concatArrays', function() {

  it('$concatArrays', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $concatArrays: [{ $array: [1, 2, 3, 5] }, { $array: [{ $array: [4, 5] }] }]
            }
          )

    should(await ec.evaluate()).deepEqual([ 1, 2, 3, 5, [ 4, 5 ] ])

  })

})
