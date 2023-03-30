const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$split', function() {

  it('Operator$split', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $split: ['hello this is my name', ' ']
            }
          )

    should(await ec.evaluate()).deepEqual(['hello', 'this', 'is', 'my', 'name'])

  })

})
