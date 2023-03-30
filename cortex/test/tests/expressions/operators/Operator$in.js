const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$in', function() {

  it('Operator$in true case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $in: [ 'abc', { $array: [ 'xyz', 'abc' ] } ] }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('Operator$in - false case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $in: [ 'xy', { $array: [ 'xyz', 'abc' ] } ] }
          )

    should(await ec.evaluate()).equal(false)

  })

  it('Operator$in - with complex objects case', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            { $in: [{ $toObjectId: '5f860be0e08f800100399c78' }, { $array: [{ $toObjectId: '5f860be0e08f800100399c78' }] }] }
          )

    should(await ec.evaluate()).equal(true)

  })

})
