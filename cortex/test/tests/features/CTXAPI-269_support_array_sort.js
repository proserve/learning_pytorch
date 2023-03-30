
'use strict'

/* global org, after, before */

require('should')

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_269.deleteMany({}).execute()
        org.objects.objects.deleteOne({ name: 'c_ctxapi_269' }).execute()
        should.equal(org.objects.objects.find({ name: 'c_ctxapi_269' }).count(), 0)
      }

describe('Feature - Sort accepting array of objects', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      label: 'CTXAPI-269',
      name: 'c_ctxapi_269',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        { label: 'name', name: 'c_name', type: 'String', indexed: true },
        { label: 'age', name: 'c_age', type: 'Number', indexed: true }
      ]
    }).execute()

    let i = 0
    while (i < 10) {
      org.objects.c_ctxapi_269.insertOne({
        c_name: 'name_' + i,
        c_age: i + 1
      }).execute()
      i++
    }

  }))

  after(sandboxed(cleanInstances))

  it('accept array of object to sort', async function() {
    let result = await performGET('/c_ctxapi_269/?sort=[{"c_age": -1},{"c_name": 1}]')
    result.body.data.length.should.equal(10)
    result.body.data[0].c_age.should.equal(10)
    result.body.data[9].c_age.should.equal(1)
  })

  it('accept object to sort', async function() {
    let result = await performGET('/c_ctxapi_269/?sort={"c_age": -1,"c_name": 1}')
    result.body.data.length.should.equal(10)
    result.body.data[0].c_age.should.equal(10)
    result.body.data[9].c_age.should.equal(1)
  })

  it('accept array with single object to sort', async function() {
    let result = await performGET('/c_ctxapi_269/?sort=[{"c_age": -1}]')
    result.body.data.length.should.equal(10)
    result.body.data[0].c_age.should.equal(10)
    result.body.data[9].c_age.should.equal(1)
  })

})

async function performGET(endpoint) {

  return server.sessions.admin
    .get(server.makeEndpoint(endpoint))
    .set(server.getSessionHeaders())
    .then()
}
