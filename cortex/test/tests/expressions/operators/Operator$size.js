const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$size', function() {

  it('Operator$size', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $size: { $array: ['this is NaN', 2, 3, 5] }
            }
          )

    should(await ec.evaluate()).equal(4)

  })

})
