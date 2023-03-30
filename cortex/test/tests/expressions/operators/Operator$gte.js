const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$gte', function() {

  it('Operator$gte', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gte: [1, 2] })

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$gte same values', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gte: [1, 1] })

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$gte bigger', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gte: [2, 1] })

    should(await ec.evaluate()).equal(true)

  })

})
