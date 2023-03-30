const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$ltrim', function() {

  it('Operator$ltrim', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $ltrim: {
                input: '/#/#trim at right/#/#',
                chars: '/#'
              }
            }
          )

    should(await ec.evaluate()).equal('trim at right/#/#')

  })

})
