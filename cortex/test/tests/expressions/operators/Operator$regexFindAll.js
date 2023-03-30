const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$regexFindAll', function() {

  it('Operator$regexFindAll', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $regexFindAll: {
                input: 'something to Check against techeck regex',
                regex: /check/,
                options: 'ig'
              }
            }
          ),
          result = await ec.evaluate()

    should(result.length).equal(2)
    should(result[0][0]).equal('Check')
    should(result[0].index).equal(13)
    should(result[1][0]).equal('check')
    should(result[1].index).equal(29)

  })

})
