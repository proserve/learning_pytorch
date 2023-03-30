const sandboxed = require('../../../lib/sandboxed')

describe('Expressions - Stage$unwind', function() {

  it('Stage$unwind - scripting should unwind arrays and non-arrays', sandboxed(function() {

    const should = require('should'),
          { pipeline: { run } } = require('expressions')

    let result = run([
      {
        $unwind: {
          path: '$foo',
          includeArrayIndex: 'fooIndex',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$foo.bar',
          includeArrayIndex: 'foobarIndex',
          preserveNullAndEmptyArrays: true
        }
      }
    ],
    [{ _id: 1,
      foo: [1, { bar: [1, 2, 3] }]
    },
    {
      _id: 2,
      foo: [2, { bar: [4, 5, 6] }]
    }
    ]
    ).toArray()

    should(result.length).equal(8)

    should(result[0]._id).equal(1)
    should(result[1]._id).equal(1)
    should(result[2]._id).equal(1)
    should(result[3]._id).equal(1)
    should(result[4]._id).equal(2)
    should(result[5]._id).equal(2)
    should(result[6]._id).equal(2)
    should(result[7]._id).equal(2)

    should(result[0].foo).equal(1) // no foo.bar but present due to preserveNullAndEmptyArrays
    should(result[0].fooIndex).equal(0)
    should(result[0].foobarIndex).equal(0)
    should(result[1].foo.bar).equal(1)
    should(result[1].fooIndex).equal(1)
    should(result[1].foobarIndex).equal(0)
    should(result[2].foo.bar).equal(2)
    should(result[2].fooIndex).equal(1)
    should(result[2].foobarIndex).equal(1)
    should(result[3].foo.bar).equal(3)
    should(result[3].fooIndex).equal(1)
    should(result[3].foobarIndex).equal(2)

    should(result[4].foo).equal(2) // no foo.bar but present due to preserveNullAndEmptyArrays
    should(result[4].fooIndex).equal(0)
    should(result[4].foobarIndex).equal(0)
    should(result[5].foo.bar).equal(4)
    should(result[5].fooIndex).equal(1)
    should(result[5].foobarIndex).equal(0)
    should(result[6].foo.bar).equal(5)
    should(result[6].fooIndex).equal(1)
    should(result[6].foobarIndex).equal(1)
    should(result[7].foo.bar).equal(6)
    should(result[7].fooIndex).equal(1)
    should(result[7].foobarIndex).equal(2)

    result = run([
      {
        $unwind: {
          path: '$foo',
          includeArrayIndex: 'fooIndex'
        }
      },
      {
        $unwind: {
          path: '$foo.bar',
          includeArrayIndex: 'foobarIndex'
        }
      }
    ],
    [{ _id: 1,
      foo: [1, { bar: [1, 2, 3] }]
    },
    {
      _id: 2,
      foo: [2, { bar: [4, 5, 6] }]
    }
    ]
    ).toArray()

    should(result.length).equal(6)

  }))

})
