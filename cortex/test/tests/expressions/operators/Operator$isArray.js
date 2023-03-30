const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$isArray', function() {

  it('Operator$isArray', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $isArray: { $literal: [1, 2, 3] } })

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$isArray with some falsy value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $isArray: undefined })

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$isArray with object', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $isArray: { $object: {} } })

    should(await ec.evaluate()).equal(false)

  })

})
