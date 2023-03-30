const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$gt', function() {

  it('Operator$gt', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gt: [1, 2] })

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$gt same values', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gt: [1, 1] })

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$gt bigger', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac, { $gt: [2, 1] })

    should(await ec.evaluate()).equal(true)

  })

})
