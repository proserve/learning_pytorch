const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - $allElementsTrue', function() {

  it('$allElementsTrue true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $allElementsTrue: [{ $array: ['', true, { $literal: {} }] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('$allElementsTrue false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $allElementsTrue: [{ $array: [0, true, { $literal: {} }] }]
            }
          )

    should(await ec.evaluate()).equal(false)

  })
})
