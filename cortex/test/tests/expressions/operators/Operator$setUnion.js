const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $setUnion', function() {

  it('$setUnion first case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setUnion: [{ $array: [ 'a', 'b', 'a' ] }, { $array: [ 'b', 'a' ] }]
            }
          )

    should(await ec.evaluate()).deepEqual(['a', 'b'])

  })

  it('$setUnion second case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setUnion: [{ $array: [ 'a', 'b' ] }, { $array: [ { $array: [ 'a', 'b' ] } ] }]
            }
          )

    should(await ec.evaluate()).deepEqual(['a', 'b', ['a', 'b']])

  })

  it('$setUnion third case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setUnion: [{ $array: [ { $toObjectId: '5f6d041f0000000000000000' }, 'b', { $toObjectId: '5f6d041f0000000000000000' } ] }, { $array: [ 'b', { $toObjectId: '5f6d041f0000000000000000' } ] }]
            }
          )

    should((await ec.evaluate()).map(a => a.toString())).deepEqual(['5f6d041f0000000000000000', 'b'])

  })

})
