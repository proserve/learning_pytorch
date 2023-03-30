const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $setDifference', function() {

  it('$setDifference no diff', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setDifference: [{ $array: [ 'a', 'b', 'a' ] }, { $array: [ 'b', 'a' ] }]
            }
          )

    should(await ec.evaluate()).deepEqual([])

  })

  it('$setDifference difference', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setDifference: [{ $array: [ 'a', 'b' ] }, { $array: [ { $array: [ 'a', 'b' ] } ] }]
            }
          )

    should(await ec.evaluate()).deepEqual(['a', 'b'])

  })

})
