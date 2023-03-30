const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$mergeObjects', function() {

  it('Operator$mergeObjects - ', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $mergeObjects: [{ $literal: { a: 1 } }, '$$ROOT', null, 1, 'string', '$$ROOT.array']
            },
            {
              $$ROOT: {
                foo: 'bar',
                array: [1, 2, 3]
              }
            }
          ),
          result = await ec.evaluate()

    should(Object.keys(result).length).equal(3)
    should(result.a).equal(1)
    should(result.foo).equal('bar')
    should(result.array).deepEqual([1, 2, 3])

  })

})
