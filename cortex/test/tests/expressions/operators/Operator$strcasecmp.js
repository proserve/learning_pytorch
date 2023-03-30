const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$strcasecmp', function() {

  it('Operator$strcasecmp same', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strcasecmp: ['13Q4', '13q4']
            }
          )

    should(await ec.evaluate()).equal(0)

  })
  it('Operator$strcasecmp lower', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strcasecmp: ['13Q', '13q4']
            }
          )

    should(await ec.evaluate()).equal(-1)

  })

  it('Operator$strcasecmp bigger', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $strcasecmp: ['13Q45', '13q4']
            }
          )

    should(await ec.evaluate()).equal(1)

  })

})
