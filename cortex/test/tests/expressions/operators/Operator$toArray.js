const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toArray', function() {

  it('Operator$toArray', async() => {

    let ec, result

    const { principals: { admin } } = server,
          original = { array: [1], primitive: 1 },
          ac = new AccessContext(admin)

    ec = expressions.createContext(
      ac,
      {
        $toArray: { $literal: original.array }
      }
    )

    result = await ec.evaluate()

    should(result === original.array).equal(false)
    should(Array.isArray(result)).equal(true)
    should(result).deepEqual([1])

    ec = expressions.createContext(
      ac,
      {
        $toArray: original.primitive
      }
    )

    result = await ec.evaluate()

    should(Array.isArray(result)).equal(true)
    should(result).deepEqual([1])
  })

})
