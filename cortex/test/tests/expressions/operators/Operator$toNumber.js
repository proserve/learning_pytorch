const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toNumber', function() {

  it('Operator$toNumber using Date', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toNumber: new Date(1600979999450)
            }
          ),
          result = await ec.evaluate()

    should(result).equal(1600979999450)

  })

  it('Operator$toNumber using string', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toNumber: '5'
            }
          ),
          result = await ec.evaluate()

    should(result).equal(5)

  })

  it('Operator$toNumber using boolean', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toNumber: true
            }
          ),
          result = await ec.evaluate()

    should(result).equal(1)

  })

})
