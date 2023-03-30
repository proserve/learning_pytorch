const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $setIntersection', function() {

  it('$setIntersection found case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setIntersection: [ { $array: [ 'a', 'b', 'a' ] }, { $array: [ 'b', 'a' ] } ]
            }
          )

    should(await ec.evaluate()).deepEqual(['a', 'b'])

  })

  it('$setIntersection not found case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setIntersection: [{ $array: [ 'a', 'b' ] }, { $array: [ { $array: ['a', 'b'] } ] }]
            }
          )

    should(await ec.evaluate()).deepEqual([])

  })

})
