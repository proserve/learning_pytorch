const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$regexFind', function() {

  it('Operator$regexFind', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $regexFind: {
                input: 'something to Check check against regex',
                regex: /check/,
                options: 'ig'
              }
            }
          ),
          result = await ec.evaluate()

    should(result.length).equal(1)
    should(result[0]).equal('Check')

  })

})
