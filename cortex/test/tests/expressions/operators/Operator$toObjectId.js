const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$toObjectId', function() {

  it('Operator$toObjectId using Date', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toObjectId: new Date(1600979999450)
            }
          ),
          result = await ec.evaluate()

    should(result.toString()).equal('5f6d041f0000000000000000')

  })

  it('Operator$toObjectId using string', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $toObjectId: '5ab9d2d331c2ab715d4212b3'
            }
          ),
          result = await ec.evaluate()

    should(result.toString()).equal('5ab9d2d331c2ab715d4212b3')

  })

})
