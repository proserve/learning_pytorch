const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $range', function() {

  it('$range forward', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $range: [0, 10, 2]
            }
          )

    should(await ec.evaluate()).deepEqual([ 0, 2, 4, 6, 8 ])

  })

  it('$range reverse', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $range: [10, 0, -2]
            }
          )

    should(await ec.evaluate()).deepEqual([ 10, 8, 6, 4, 2 ])

  })

})
