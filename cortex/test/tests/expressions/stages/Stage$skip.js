const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('CTXAPI-923 - $skip stage', function() {

  it('should skip the first X entries', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $project: { $toLower: '$$ROOT' }
        },
        {
          $skip: 5
        }
      ],
      ['Skip', 'these', 'first', 'five', 'entries.', 'Not', 'these', 'ones']
      ).toArray()
    }))

    should.exist(result)
    result[0].should.equal('not')
    result[1].should.equal('these')
    result[2].should.equal('ones')
  })

  it('should skip all entries', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $project: { $toLower: '$$ROOT' }
        },
        {
          $skip: 8
        }
      ],
      ['Skip', 'these', 'first', 'five', 'entries.', 'Not', 'these', 'ones']
      ).toArray()
    }))

    should.exist(result)
    result.length.should.equal(0)
  })

  it('should skip all entries when argument is higher than total', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $project: { $toLower: '$$ROOT' }
        },
        {
          $skip: 20
        }
      ],
      ['Skip', 'these', 'first', 'five', 'entries.', 'Not', 'these', 'ones']
      ).toArray()
    }))

    should.exist(result)
    result.length.should.equal(0)
  })

  it('should fail to skip zero entries', async() => {
    let result, error

    try {
      result = await promised(null, sandboxed(function() {
        return require('expressions').pipeline.run([
          {
            $project: { $toLower: '$$ROOT' }
          },
          {
            $skip: 0
          }
        ],
        ['Skip', 'these', 'first', 'five', 'entries.', 'Not', 'these', 'ones']
        ).toArray()
      }))
    } catch (e) {
      error = e
    }

    should.not.exist(result)
    should.exist(error)
    error.should.containDeep({
      object: 'fault',
      name: 'db',
      code: 'kInvalidArgument',
      errCode: 'cortex.invalidArgument.query',
      statusCode: 400,
      reason: 'Stage $skip requires a positive integer.',
      message: 'Invalid query arguments.',
      path: 'pipeline.1.$skip'
    })
  })

  it('should fail to skip from negative argument', async() => {
    let result, error

    try {
      result = await promised(null, sandboxed(function() {
        return require('expressions').pipeline.run([
          {
            $project: { $toLower: '$$ROOT' }
          },
          {
            $skip: -2
          }
        ],
        ['Skip', 'these', 'first', 'five', 'entries.', 'Not', 'these', 'ones']
        ).toArray()
      }))
    } catch (e) {
      error = e
    }

    should.not.exist(result)
    should.exist(error)
    error.should.containDeep({
      object: 'fault',
      name: 'db',
      code: 'kInvalidArgument',
      errCode: 'cortex.invalidArgument.query',
      statusCode: 400,
      reason: 'Stage $skip requires a positive integer.',
      message: 'Invalid query arguments.',
      path: 'pipeline.1.$skip'
    })
  })

})
