const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$jsonParse', function() {

  it('Operator$jsonParse object', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $jsonParse: '{"value":"my value","num":123}'
            }
          )

    should(await ec.evaluate()).deepEqual({
      'value': 'my value',
      'num': 123
    })

  })

  it('Operator$jsonParse array', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $jsonParse: '[{"value":"my value","num":123},{"value":"my 2","num":2}]'
            }
          )

    should(await ec.evaluate()).deepEqual([{
      'value': 'my value',
      'num': 123
    }, {
      'value': 'my 2',
      'num': 2
    }])

  })

})
