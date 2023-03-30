const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$substrBytes', function() {

  it('Operator$substrBytes', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $substrBytes: ['寿司sushi', 0, 6]
            }
          )

    should(await ec.evaluate()).equal('寿司')

  })

})
