const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$jsonStringify', function() {

  it('Operator$jsonStringify', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $jsonStringify: {
                $object: {
                  'test': 'my_test',
                  'num': 124,
                  'value': { $concat: ['a', '-', 'b'] }
                }
              }
            }
          )

    should(await ec.evaluate()).deepEqual(JSON.stringify({
      'test': 'my_test',
      'num': 124,
      'value': 'a-b'
    }))

  })

})
