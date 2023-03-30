const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$substr', function() {

  it('Operator$substr', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $substr: ['testing', 3, 2]
            }
          )

    should(await ec.evaluate()).equal('ti')

  })

})
