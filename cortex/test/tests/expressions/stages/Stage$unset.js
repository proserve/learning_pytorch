const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Stage - $unset', function() {

  it('should unset a property', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $unset: ['test']
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
    result[0].should.deepEqual({ my_prop: 'test' })
    result[1].should.deepEqual({ })

  })

})
