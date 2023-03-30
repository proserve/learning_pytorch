const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $setEqual', function() {

  it('$setEqual true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setEqual: [{ $array: [ 'a', 'b', 'a' ] }, { $array: [ 'b', 'a' ] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('$setEqual false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setEqual: [{ $array: [ 'a', 'b' ] }, { $array: [ { $array: ['b', 'a'] } ] }]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

})
