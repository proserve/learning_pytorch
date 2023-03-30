const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toLower', function() {

  it('Operator$toLower', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toLower: 'MY NAME'
            }
          )

    should(await ec.evaluate()).equal('my name')

  })

})
