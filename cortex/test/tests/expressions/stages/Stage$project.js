const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Stage - $project', function() {

  it('should project an object', async() => {

    const result = await promised(null, sandboxed(function() {
      /* global org */
      return require('expressions').pipeline.run([
        {
          $cursor: org.objects.accounts.find().limit(1).skipAcl().grant(8).getOptions()
        },
        {
          $project: {
            email: '$$ROOT.email',
            mobile: '$$ROOT.mobile'
          }
        }
      ]).toArray()
    }))

    should.exist(result)
    result[0].should.deepEqual({
      'email': 'james+admin@medable.com',
      'mobile': '+16049892489'
    })

  })

})
