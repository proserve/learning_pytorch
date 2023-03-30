const sandboxed = require('../../../lib/sandboxed')

describe('Expressions - Accumulator$addToSet', function() {

  it('Accumulator$addToSet - scripting should not contain duplicates', sandboxed(function() {

    const { ObjectID } = global,
          should = require('should'),
          { pipeline: { run } } = require('expressions'),
          input = [
            1,
            'foo',
            [1, 2, 3],
            [3, 2, 1],
            { foo: 'bar' },
            new Buffer('abc'), // eslint-disable-line node/no-deprecated-api
            new Date(),
            true,
            new ObjectID(),
            /foo/
          ],
          cursor = run([
            {
              $group: {
                _id: null,
                set: { $addToSet: '$$ROOT' }
              }
            }
          ], [
            ...input, ...input
          ])

    should(cursor.next().set.length).equal(input.length)

  }))

})
