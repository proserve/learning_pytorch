const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$array', function() {

  it('Operator$array', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $array: [{ $literal: 'a' }, { $abs: -1 }, 2]
            }
          )

    should(await ec.evaluate()).deepEqual(['a', 1, 2])

  })

})
