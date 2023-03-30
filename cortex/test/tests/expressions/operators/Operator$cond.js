const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$cond', function() {

  it('Operator$cond short form', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          val = 'a',
          ec = expressions.createContext(
            ac,
            {
              $cond: [val === 'a', 'OK', 'FALSE']
            }
          )

    should(await ec.evaluate()).equal('OK')

  })

  it('Operator$cond long form', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          val = 'a',
          ec = expressions.createContext(
            ac,
            {
              $cond: {
                if: val === 'a',
                then: 'OK',
                else: 'FALSE'
              }
            }
          )

    should(await ec.evaluate()).equal('OK')

  })

})
