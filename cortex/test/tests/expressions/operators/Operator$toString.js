const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toString', function() {

  it('Operator$toString - toString number should return string', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toString: 1234
            }
          )

    should(await ec.evaluate()).equal('1234')

  })

  it('Operator$toString - toString boolean should return string', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toString: false
            }
          )

    should(await ec.evaluate()).equal('false')

  })

})
