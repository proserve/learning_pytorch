const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$filter', function() {

  it('Operator$filter', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(ac,
            {
              $filter: {
                input: { $array: ['a', 'b', 'c', 'd', 'de', 'deal'] },
                as: 'item',
                cond: {
                  $eq: [{ $substr: ['$$item', 0, 2] }, 'de']
                }
              }
            })

    should(await ec.evaluate()).deepEqual(['de', 'deal'])

  })

})
