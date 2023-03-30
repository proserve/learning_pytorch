const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $setIsSubset', function() {

  it('$setIsSubset true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setIsSubset: [{ $array: [ 'a', 'b', 'a' ] }, { $array: [ 'b', 'a' ] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('$setIsSubset false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $setIsSubset: [{ $array: [ 'a', 'b' ] }, { $array: [ { $array: [ 'a', 'b' ] } ] }]
            }
          )

    should(await ec.evaluate()).equal(false)

  })

})
