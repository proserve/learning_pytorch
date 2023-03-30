const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $objectToArray', function() {

  it('$objectToArray', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $objectToArray: { $literal: {
                price: 2,
                discount: 3,
                tax: 5
              } }
            }
          )

    should(await ec.evaluate()).deepEqual([
      { k: 'price', v: 2 },
      { k: 'discount', v: 3 },
      { k: 'tax', v: 5 }
    ])

  })

})
