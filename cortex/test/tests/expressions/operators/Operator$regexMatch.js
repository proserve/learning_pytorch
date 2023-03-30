const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$regexMatch', function() {

  it('Operator$regexMatch', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $regexMatch: {
                input: 'something to Check against regex',
                regex: /check/,
                options: 'ig'
              }
            }
          )

    should(await ec.evaluate()).equal(true)

  })

})
