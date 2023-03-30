const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $indexOfArray', function() {

  it('$indexOfArray', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $indexOfArray: [ { $array: [ 'a', 'abc', 'de', { $array: ['de'] } ] }, { $array: ['de'] } ]
            }
          )

    should(await ec.evaluate()).equal(3)

  })

  it('$indexOfArray not found', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $indexOfArray: [ { $array: [ 'a', 'abc', 'b' ] }, 'b', 0, 1 ] }
          )

    should(await ec.evaluate()).equal(-1)

  })

  it('$indexOfArray input array null', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $indexOfArray: [ null, 'b', 0, 1 ] }
          )

    should(await ec.evaluate()).equal(null)

  })

})
