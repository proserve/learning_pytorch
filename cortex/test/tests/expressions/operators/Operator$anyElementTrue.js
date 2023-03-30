const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $anyElementTrue', function() {

  it('$anyElementTrue true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $anyElementTrue: [{ $array: [0, true, { $literal: {} }] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('$anyElementTrue false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $anyElementTrue: [{ $array: [0, null, undefined] }]
            }
          )

    should(await ec.evaluate()).equal(false)

  })
})
