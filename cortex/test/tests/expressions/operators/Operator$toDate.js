const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toDate', function() {

  it('Operator$toDate using timestamp', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toDate: 1600979999450
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual(new Date(1600979999450))

  })

  it('Operator$toDate using string', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toDate: '2010-09-20 00:00:00'
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual(new Date(2010, 8, 20, 0, 0, 0))

  })

  it('Operator$toDate using date', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toDate: new Date(2010, 9, 20)
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual(new Date(2010, 9, 20))

  })

})
