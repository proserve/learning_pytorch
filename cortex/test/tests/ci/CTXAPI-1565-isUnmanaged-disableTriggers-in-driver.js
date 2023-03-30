const sandboxed = require('../../lib/sandboxed')

describe('Features - CTXAPI-1565 isUnmanaged and disableTriggers in driver and sandbox', function() {

  before(sandboxed(function() {

    /* global script, org */

    const { environment } = require('developer'),
          docs = [
            {
              label: 'c_ctxapi_1565',
              name: 'c_ctxapi_1565',
              object: 'object',
              defaultAcl: 'owner.delete',
              createAcl: 'account.public',
              validateOwner: false,
              isUnmanaged: false,
              properties: [{
                label: 'c_string',
                name: 'c_string',
                type: 'String'
              }]
            },
            {
              label: 'c_ctxapi_1565',
              name: 'c_ctxapi_1565',
              object: 'script',
              description: 'c_ctxapi_1565',
              type: 'library',
              configuration: {
                export: 'c_ctxapi_1565'
              },
              script: `
              
              const { trigger } = require('decorators'),
                    counters = require('counters')
                             
              class c_ctxapi_1565 {
            
                @trigger('create.before', 'update.before', 'delete.before', { object: 'c_ctxapi_1565' })
                before({ context, event }) {
                  console.log('event', event)
                  counters.next('c_ctxapi_1565_'+event)                                                                               
                }                                                           
                
                @trigger('create.after', 'update.after', 'delete.after', { object: 'c_ctxapi_1565', inline: true })
                after({ context, event }) {
                  console.log('event', event)
                  counters.next('c_ctxapi_1565_'+event)                   
                }
                
              }                      
              `
            }
          ]

    script.as(
      script.principal,
      {
        safe: false,
        principal: {
          grant: 'update',
          skipAcl: true,
          bypassCreateAcl: true
        }
      },
      () => {
        environment.import(docs, { backup: false, triggers: false }).toArray()
      }
    )

  }))

  after(sandboxed(function() {

    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1565' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_1565' }).execute()

  }))

  afterEach(sandboxed(function() {

    const counters = require('counters')
    for (const event of ['create.before', 'update.before', 'delete.before', 'create.after', 'update.after', 'delete.after']) {
      counters.del(`c_ctxapi_1565_${event}`)
    }

  }))

  it('should run triggers where appropriate', sandboxed(function() {

    const counters = require('counters'),
          should = require('should'),
          { c_ctxapi_1565: Model } = org.objects

    Model.insertMany([{}, {}])
      .disableTriggers()
      .execute()

    Model.insertOne({})
      .disableTriggers()
      .execute()

    Model.insertMany([{}, {}])
      .isUnmanaged()
      .execute()

    Model.insertOne({})
      .isUnmanaged()
      .execute()

    should.equal(null, counters.get('c_ctxapi_1565_create.before'))
    should.equal(null, counters.get('c_ctxapi_1565_create.after'))

    // sanity check
    let { insertedIds } = Model.insertMany([{}, {}, {}]).execute()

    should.equal(3, counters.get('c_ctxapi_1565_create.before'))
    should.equal(3, counters.get('c_ctxapi_1565_create.after'))

    Model.updateOne({ _id: insertedIds[0]._id }, { $set: { c_string: 'one' } })
      .disableTriggers()
      .execute()

    Model.updateOne({ _id: insertedIds[0]._id }, { $set: { c_string: 'two' } })
      .isUnmanaged()
      .execute()

    should.equal(null, counters.get('c_ctxapi_1565_update.before'))
    should.equal(null, counters.get('c_ctxapi_1565_update.after'))

    // sanity
    Model.updateOne({ _id: insertedIds[0]._id }, { $set: { c_string: 'three' } })
      .execute()

    should.equal(1, counters.get('c_ctxapi_1565_update.before'))
    should.equal(1, counters.get('c_ctxapi_1565_update.after'))

    Model.deleteOne({ _id: insertedIds[1]._id })
      .disableTriggers()
      .execute()

    should.equal(null, counters.get('c_ctxapi_1565_delete.before'))
    should.equal(null, counters.get('c_ctxapi_1565_delete.after'))

    Model.deleteOne({ _id: insertedIds[2]._id })
      .execute()

    should.equal(1, counters.get('c_ctxapi_1565_delete.before'))
    should.equal(1, counters.get('c_ctxapi_1565_delete.after'))

  }))

  // isUnmanaged also skips audit record creation for enabled object definitions.
  // isUnmanaged will still update the updated property, if it exists.

})
