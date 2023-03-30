const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $arrayToObject', function() {

  it('$arrayToObject', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $arrayToObject: [{ $array: ['price', 2] }, { $array: ['discount', 3] }, { $literal: { k: 'tax', v: 5 } }]
            }
          )

    should(await ec.evaluate()).deepEqual({
      price: 2,
      discount: 3,
      tax: 5
    })

  })

})
