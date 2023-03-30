const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$avg', function() {

  it('Operator$avg', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $avg: [2, 5, 10, 33, 24]
            }
          )

    should(await ec.evaluate()).equal(14.8)

  })

  it('Operator$avg with expressions inside', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $avg: [2, 5, 10, { $literal: 33 }, { $add: [2, 2, 20] }]
            }
          )

    should(await ec.evaluate()).equal(14.8)

  })

  it('Operator$avg empty array', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $avg: []
              }
            )
      await ec.evaluate()

    } catch (e) {
      should(e.reason).equal('Unknown expression type [object Object]')
    }

  })

  it('Operator$avg invalid input', async() => {

    try {
      const { principals: { admin } } = server,
            ac = new AccessContext(admin),
            ec = expressions.createContext(
              ac,
              {
                $avg: {}
              }
            )
      await ec.evaluate()

    } catch (e) {
      should(e.reason).equal('Unknown expression type [object Object]')
    }

  })

})
