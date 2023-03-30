const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$ifNull', function() {

  it('Operator$ifNull', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $ifNull: [null, true] })

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$gte with some falsy value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $ifNull: [undefined, 'A'] })

    should(await ec.evaluate()).equal('A')

  })

  it('Operator$gte with not null value', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $ifNull: [true, 'A'] })

    should(await ec.evaluate()).equal(true)

  })

})
