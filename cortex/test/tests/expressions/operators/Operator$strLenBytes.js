const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$strLenBytes', function() {

  it('Operator$strLenBytes', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strLenBytes: 'cafétéria'
            }
          )

    should(await ec.evaluate()).equal(11)

  })

  it('Operator$strLenBytes with single bytes chars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strLenBytes: 'cafeteria'
            }
          )

    should(await ec.evaluate()).equal(9)

  })

})
