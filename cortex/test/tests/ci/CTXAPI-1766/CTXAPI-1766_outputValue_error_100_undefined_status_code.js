'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('CTXAPI-1766 - error when bulk output is not properly handled', function() {

  before(async() => {
    await promised(null, sandboxed(function() {

      global.org.objects.objects.insertOne({
        name: 'c_ctxapi_1766_string',
        label: 'c_ctxapi_1766_string',
        createAcl: [
          'account.public'
        ],
        defaultAcl: [
          'role.administrator.delete'
        ],
        properties: [{
          acl: [
            'role.administrator'
          ],
          name: 'c_string',
          label: 'c_string',
          type: 'String'
        }]
      }).execute()

      global.org.objects.c_ctxapi_1766_string.insertMany({
        c_string: 'test'
      }, {
        c_string: 'test2'
      }, {
        c_string: 'test3'
      }).execute()
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      global.org.objects.c_ctxapi_1766_string.deleteMany().skipAcl().grant(8).execute()
    }))
  })

  it('should return the proper error instead of gateway timeout', async() => {
    const instance = await promised(null, sandboxed(function() {
            const [item] = global.org.objects.c_ctxapi_1766_string.find().toArray()
            return item
          })),

          result = await server.sessions.patient
            .post(server.makeEndpoint(`/c_ctxapi_1766_string/db/bulk`))
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .send([{
              'match': { '_id': instance._id },
              'operation': 'updateOne',
              'update': {
                '$set': {
                  'c_string': 'testXXX'
                }
              }
            }])
    should(result.body.errCode).equal('cortex.accessDenied.instanceUpdate')

  })

})
