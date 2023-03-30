const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$acl', function() {

  it('Operator$acl', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $acl: 'account.public.script'
            }
          )

    should(await ec.evaluate()).equal(8)

  })

  it('Operator$acl using object entry', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $acl: [{ $object: { type: 'role', target: 'administrator', allow: 'read' } }]
            }
          )

    should(await ec.evaluate()).equal(4)

  })

})
