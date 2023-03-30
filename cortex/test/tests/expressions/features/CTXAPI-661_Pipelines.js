'use strict'
const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Pipelines', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      name: 'c_ctxapi_661_account_object',
      label: 'c_ctxapi_661_account_object',
      createAcl: 'account.public',
      defaultAcl: 'role.administrator.delete',
      properties: [{
        name: 'c_email',
        label: 'Email',
        type: 'String',
        indexed: true
      }]
    }).execute()

    org.objects.c_ctxapi_661_account_object.insertMany([
      { c_email: 'adam+admin@medable.com' },
      { c_email: 'franco+admin@medable.com' },
      { c_email: 'james+admin@medable.com' },
      { c_email: 'james+patient@medable.com' },
      { c_email: 'james+provider@medable.com' },
      { c_email: 'james+unverified@medable.com' },
      { c_email: 'joaquin+unverified@test.com' },
      { c_email: 'juan+unverified@mail.com' }
    ]).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_661_account_object' }).execute()
  }))

  it('check pipelines using expressions with cursor, grouping, math operators and accumulators', async() => {

    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([{
        $project: '$$ROOT'
      }, {
        $group: {
          _id: { $cond: [{ $mod: ['$$ROOT', 2] }, 'odd', 'even'] },
          addToSet: { $addToSet: '$$ROOT' },
          push: { $push: '$$ROOT' },
          first: { $first: '$$ROOT' },
          last: { $last: '$$ROOT' },
          min: { $min: '$$ROOT' },
          max: { $max: '$$ROOT' },
          avg: { $avg: '$$ROOT' },
          count: { $count: '$$ROOT' },
          sum: { $sum: '$$ROOT' },
          mergeObjects: { $mergeObjects: '$$CONTEXT.org' }
        }
      }],
      [9, 9, 9, 9, 9, 8, 7, 1, 0, 2, 3, 6, 5, 4, 345, 23, 34, 456, 1, 3, 5, 3, 5, 7, 78, 43324, 543, 564, 453, 234, 2345]
      ).toArray()
    }))
    should.equal(result.length, 2)
    should.equal(result[0]._id, 'odd')
    should.equal(result[0].first, 9)
    should.equal(result[0].last, 2345)
    should.equal(result[0].min, 1)
    should.equal(result[0].max, 2345)
    should.equal(result[0].avg, 189.7)
    should.equal(result[0].count, 20)
    should.equal(result[0].sum, 3794)
    should.equal(result[0].mergeObjects.code, 'test-org')
    should.deepEqual(result[0].addToSet, [9, 7, 1, 3, 5, 345, 23, 543, 453, 2345])
    should.deepEqual(result[0].push, [9, 9, 9, 9, 9, 7, 1, 3, 5, 345, 23, 1, 3, 5, 3, 5, 7, 543, 453, 2345])

    should.equal(result[1]._id, 'even')
    should.equal(result[1].first, 8)
    should.equal(result[1].last, 234)
    should.equal(result[1].min, 0)
    should.equal(result[1].max, 43324)
    should.equal(result[1].avg, 4064.5454545454545)
    should.equal(result[1].count, 11)
    should.equal(result[1].sum, 44710)
    should.equal(result[1].mergeObjects.code, 'test-org')
    should.deepEqual(result[1].addToSet, [8, 0, 2, 6, 4, 34, 456, 78, 43324, 564, 234])
    should.deepEqual(result[1].push, [8, 0, 2, 6, 4, 34, 456, 78, 43324, 564, 234])

  })

  it('check pipelines using expressions with string operators $trim $strLenCP $toLower', async() => {
    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $project: { $trim: { input: '$$ROOT' } }
        },
        {
          $match: {
            $gt: [{ $strLenCP: '$$ROOT' }, 4]
          }
        },
        {
          $project: { $toLower: '$$ROOT' }
        }
      ],
      [' Bridge', 'Port ', ' building ', 'airPOrt', 'HIGHWAY', 'street', 'ligHTs']
      ).toArray()
    }))
    should.exist(result)
    should.equal(result.length, 6)
    should.equal(result[0], 'bridge')
    should.equal(result[1], 'building')
    should.equal(result[2], 'airport')
    should.equal(result[3], 'highway')
    should.equal(result[4], 'street')
    should.equal(result[5], 'lights')
  })

  it('check pipelines using expressions with string operators $Ltrim $Rtrim $split $toUpper', async() => {

    const result = await promised(null, sandboxed(function() {
      const inputCursor = [' Bridge, Port , building, airPOrt, HIGHWAY, street, ligHTs'],
            outputCursor = require('expressions').pipeline.run([{
              $project: { $toUpper: '$$ROOT' }
            },
            {
              $project: { $split: ['$$ROOT', ','] }
            },
            {
              $project: {
                $map: {
                  input: '$$ROOT',
                  as: 'mapped',
                  in: {
                    $ltrim: {
                      input: {
                        $rtrim: {
                          input: '$$mapped',
                          chars: ' '
                        }
                      },
                      chars: ' '
                    }
                  }
                }
              }
            }],
            inputCursor
            )
      return outputCursor.next()
    }))
    should.exist(result)
    should.equal(result.length, 7)
    should.equal(result[0], 'BRIDGE')
    should.equal(result[1], 'PORT')
    should.equal(result[2], 'BUILDING')
    should.equal(result[3], 'AIRPORT')
    should.equal(result[4], 'HIGHWAY')
    should.equal(result[5], 'STREET')
    should.equal(result[6], 'LIGHTS')
  })

  it('check pipelines using expressions with aggregations', async() => {

    const result = await promised(null, sandboxed(function() {
      /* global org */
      const { c_ctxapi_661_account_object: Accounts } = org.objects
      return require('expressions').pipeline.run([
        // get all users that end with medable from an agg
        {
          $cursor: Accounts.aggregate().match({ c_email: /medable\.com$/ }).group({ _id: null, endsWithMedable: { $addToSet: 'c_email' } }).skipAcl().grant('read').limit(1).getOptions()
        },
        {
          $var: 'endsWithMedable'
        },
        // new cursor. a $cursor stage exhausts any previous cursors to > dev/null
        {
          $cursor: Accounts.aggregate().match({ c_email: /^j/ }).group({ _id: null, startsWithJ: { $addToSet: 'c_email' } }).skipAcl().grant('read').limit(1).getOptions()
        },
        {
          $var: 'startsWithJ'
        },
        {
          $project: {
            $mergeObjects: ['$$VAR.endsWithMedable', '$$VAR.startsWithJ']
          }
        }
      ]).next()
    }))
    should.exist(result)
    should.deepEqual(result.endsWithMedable.sort(), [
      'adam+admin@medable.com',
      'franco+admin@medable.com',
      'james+admin@medable.com',
      'james+patient@medable.com',
      'james+provider@medable.com',
      'james+unverified@medable.com'
    ])
    should.deepEqual(result.startsWithJ.sort(), [
      'james+admin@medable.com',
      'james+patient@medable.com',
      'james+provider@medable.com',
      'james+unverified@medable.com',
      'joaquin+unverified@test.com',
      'juan+unverified@mail.com'
    ])

  })

  it('check pipelines using expressions with transforms', async() => {

    const result = await promised(null, sandboxed(function() {
      /* global org */
      return require('expressions').pipeline.run([
        {
          $cursor: org.objects.accounts.find().skipAcl().grant(8).limit(4).getOptions()
        },
        {
          $transform: {
            vars: {
              limit: 0,
              total: 0
            },
            each: {
              set: {
                limit: {
                  $cond: {
                    if: { $lte: ['$$limit', 2] },
                    then: { $add: ['$$limit', 1] },
                    else: '$$limit'
                  }
                },
                total: { $add: ['$$total', 1] }
              },
              in: {
                $cond: {
                  if: { $lte: ['$$limit', 2] },
                  then: '$$REMOVE'
                }
              }
            },
            after: {
              in: {
                $object: {
                  limit: '$$limit',
                  total: '$$total'
                }
              }
            }
          }
        },
        {
          $var: 'firstResult'
        },
        {
          $cursor: {
            $mergeObjects: [
              { $literal: org.objects.accounts.find().skipAcl().grant(8).getOptions() },
              { $object: { limit: '$$VAR.firstResult.limit' } }
            ] }
        },
        {
          $transform: {
            vars: {
              count: 0
            },
            each: {
              set: {
                count: { $add: ['$$count', 1] }
              },
              in: {
                $cond: {
                  if: { $lte: ['$$count', 2] },
                  then: '$$REMOVE'
                }
              }
            },
            after: {
              in: {
                $object: {
                  count: '$$count'
                }
              }
            }
          }
        },
        {
          $var: 'secondResult'
        },
        {
          $project: {
            $mergeObjects: ['$$VAR.firstResult', '$$VAR.secondResult']
          }
        }
      ]).next()
    }))
    should.equal(result.limit, 3)
    should.equal(result.count, 3)
    should.equal(result.total, 4)
  })

  it('check pipelines using expressions with operators $function $object $gt $match $add $gt', async() => {
    const result = await promised(null, sandboxed(function() {
      return require('expressions').pipeline.run([
        {
          $project: { $add: [10, '$$ROOT'] }
        },
        {
          $match: {
            $gt: ['$$ROOT', 11]
          }
        },
        {
          $project: {
            $object: {
              value: '$ROOT',
              mod: {
                $function: {
                  body: `return script.arguments[0] * 5`,
                  args: ['$$ROOT']
                }
              }
            }
          }
        }
      ],
      [1, 2, 3, 4, 5, 6, 7]
      ).toArray()
    }))
    should.exist(result)
    should.equal(result.length, 6)
    should.equal(result[0].mod, 60)
    should.equal(result[1].mod, 65)
    should.equal(result[2].mod, 70)
    should.equal(result[3].mod, 75)
    should.equal(result[4].mod, 80)
    should.equal(result[5].mod, 85)
  })

})
