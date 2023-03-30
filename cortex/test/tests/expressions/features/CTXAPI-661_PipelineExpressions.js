const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils')

describe('CTXAPI-661 Expressions - Pipeline Expression', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      name: 'c_ctxapi_661_custom_account',
      label: 'c_ctxapi_661_custom_account',
      createAcl: 'account.public',
      defaultAcl: 'role.administrator.delete',
      properties: [{
        name: 'c_name',
        label: 'name',
        type: 'Document',
        properties: [{
          name: 'c_first',
          label: 'first',
          type: 'String',
          indexed: true
        }, {
          name: 'c_last',
          label: 'last',
          type: 'String',
          indexed: true
        }]
      }]
    }).execute()

    org.objects.c_ctxapi_661_custom_account.insertMany([
      {
        c_name: {
          c_first: 'Test',
          c_last: 'Administrator'
        }
      },
      {
        c_name: {
          c_first: 'Test',
          c_last: 'Provider'
        }
      },
      {
        c_name: {
          c_first: 'Test',
          c_last: 'patient'
        }
      },
      {
        c_name: {
          c_first: 'Test',
          c_last: 'Unverified'
        }
      }
    ]).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_661_custom_account' }).execute()
  }))

  it('should run expressionPipelines on aggregations', async() => {
    let result = await promised(null, sandboxed(function() {
      /* global org */
      const { c_ctxapi_661_custom_account: Accounts } = org.objects
      return Accounts
        .aggregate()
        .project({
          _id: 1,
          c_name: 1
        })
        .skipAcl()
        .grant('read')
        .expressionPipeline([{
          $project: '$$ROOT.c_name.c_first'
        }, {
          $group: {
            _id: '$$ROOT',
            count: { $count: '_id' }
          }
        }]).toArray()

    }))
    should.equal(result[0]._id, 'Test')
    should.equal(result[0].count, 4)
  })

  it('should run expressionPipelines on transforms', async() => {
    let result = await promised(null, sandboxed(function() {
      /* global org */
      const { c_ctxapi_661_custom_account: Accounts } = org.objects
      return Accounts
        .find()
        .paths('c_name.c_first')
        .skipAcl()
        .grant('read')
        .expressionPipeline([{
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
                  if: { $eq: [{ $mod: ['$$CURSOR.position', 2] }, 0] },
                  then: {
                    $function: {
                      body: `return Object.assign(script.arguments[0], {now: new Date()})`,
                      args: [
                        { $mergeObjects: [ '$$ROOT.c_name', { $pick: ['$$CURSOR', 'position'] } ] }
                      ]
                    }
                  },
                  else: '$$REMOVE'
                }
              }
            },
            after: {
              in: {
                $object: {
                  total: '$$count'
                }
              }
            }
          }
        }]).toArray()

    }))
    should.equal(result[0].position, 0)
    should.equal(result[0].c_first, 'Test')
    should.exist(result[0].now)
    should.equal(result[1].position, 2)
    should.equal(result[1].c_first, 'Test')
    should.exist(result[1].now)
    should.equal(result[2].total, 4)

  })

})
