const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$isNumber', function() {

  it('Operator$isNumber false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $isNumber: 'abc' }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$isNumber - true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $isNumber: 2 }
          )

    should(await ec.evaluate()).equal(true)

  })

})
