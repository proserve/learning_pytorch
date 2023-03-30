const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Stage - $set', function() {

  it('should set a property', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $set: {
            test: 'another value'
          }
        }
      ],
      [{
        my_prop: 'test'
      }, {
        test: 'test'
      }]
      ).toArray()
    }))

    should.exist(result)
    result[0].should.deepEqual({ my_prop: 'test', test: 'another value' })
    result[1].should.deepEqual({ test: 'another value' })

  })

})
