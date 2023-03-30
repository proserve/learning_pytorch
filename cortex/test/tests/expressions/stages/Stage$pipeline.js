const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('Stage - $pipeline', function() {

  it('should support $pipeline as stage of pipeline.run', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $pipeline: [{
            $cursor: {
              $object: {
                'grant': 8,
                'maxTimeMS': 10000,
                'object': 'account',
                'operation': 'cursor',
                'skipAcl': true,
                'where': {
                  $object: {
                    'email': '$$ROOT'
                  }
                }
              }
            }

          }, {
            $project: {
              $object: {
                email: '$$ROOT.email',
                mobile: '$$ROOT.mobile',
                locale: '$$ROOT.locale'
              }
            }
          }]
        }, {
          $set: {
            'from_top_pipeline': 1
          }
        }
      ], ['james+admin@medable.com']).toArray()
    }))

    should.exist(result)
    result[0].should.deepEqual({
      'email': 'james+admin@medable.com',
      'locale': 'en_US',
      'mobile': '+16049892489',
      'from_top_pipeline': 1
    })

  })

})
