const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$expression', function() {

  it('Operator$expression', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $object: {
                value: {
                  $concat: ['My Balance: ', {
                    $toString: {
                      $expression: {
                        in: {
                          $add: [100, 1345, 122, 1233, 3456, 50]
                        }
                      }
                    }
                  }]
                }
              }
            }
          )

    should(await ec.evaluate()).deepEqual({
      'value': 'My Balance: 6306'
    })

  })

})
