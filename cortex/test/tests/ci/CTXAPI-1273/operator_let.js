const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Operator$let', function() {

  it('Operator$let should work with root values', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $let: {
                vars: { key: '$key', array: '$array' },
                in: { $concat: ['$$key', '$$array'] }
              }
            }, {
              $$ROOT: {
                key: 'my-key',
                array: ['val1', 'val2', 'val3']
              }
            }
          ),
          result = await ec.evaluate()

    should.equal(result, 'my-keyval1,val2,val3')

  })
  it('Operator$let should work with literals using local vars', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $let: {
                vars: { key: '$key', array: '$array' },
                literal: true, // <-- when true, scan `in` for local vars
                in: { $match: { '$$key': { $in: '$$array' } } }
              }
            }, {
              $$ROOT: {
                key: 'my-key',
                array: ['val1', 'val2', 'val3']
              }
            }
          ),
          result = await ec.evaluate()

    should.deepEqual(result, { '$match': { 'my-key': { '$in': ['val1', 'val2', 'val3'] } } })

  })

  it('Operator$let should not cache expression result #CTXAPI-1786', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          input = [
            { a: 20, b: 10 },
            { a: 5, b: 8 },
            { a: 1, b: 2 }
          ],
          ec = expressions.createPipeline(
            ac,
            [{
              $project: {
                $let: {
                  vars: {
                    sum: { $add: [ '$a', '$b' ] }
                  },
                  literal: true,
                  in: { total: '$$sum' }
                }
              }
            }]
          ),
          cursor = await ec.evaluate({ input }),
          results = []

    while (await promised(cursor, 'hasNext')) {
      results.push(await promised(cursor, 'next'))
    }

    should.deepEqual(results, [{ total: 30 }, { total: 13 }, { total: 3 }])
  })

})
