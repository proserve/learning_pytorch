const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$zip', function() {

  it('Operator$zip', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $zip: {
                inputs: [{ $array: [1, 2, 3] }, { $array: [4, 5, 6] }, { $array: [7, 8, 9] }]
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual([[1, 4, 7], [2, 5, 8], [3, 6, 9]])
  })

  it('Operator$zip using longest', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $zip: {
                inputs: [{ $array: [1, 2, 3] }, { $array: [4, 5, 6, 7] }, { $array: [8, 9] }],
                useLongestLength: true
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual([[1, 4, 8], [2, 5, 9], [3, 6, null], [ null, 7, null ]])
  })

  it('Operator$zip using defaults', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $zip: {
                inputs: [ { $array: [ 1 ] }, { $array: [ 2, 3 ] }, { $array: [ 4 ] } ],
                useLongestLength: true,
                defaults: { $array: ['a', 'b', 'c'] }
              }
            }
          ),
          result = await ec.evaluate()

    should(result).deepEqual([ [ 1, 2, 4 ], [ 'a', 3, 'c' ] ])
  })
})
