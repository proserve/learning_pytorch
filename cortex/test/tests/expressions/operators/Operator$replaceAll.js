const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$replaceAll', function() {

  it('Operator$replaceAll', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $replaceAll: {
                input: 'this is my name',
                find: 'i',
                replacement: { $literal: '1' }
              }
            }
          )

    should(await ec.evaluate()).equal('th1s 1s my name')

  })

})
