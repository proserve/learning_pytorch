const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $arrayElemAt', function() {

  it('$arrayElemAt', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $arrayElemAt: [{ $array: [1, 2, 3, 5] }, -1]
            }
          )

    should(await ec.evaluate()).deepEqual(5)

  })

})
