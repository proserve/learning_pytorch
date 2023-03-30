'use strict'

/* global org, script */

const sandboxed = require('../../lib/sandboxed'),
      loadScript = require('../../lib/script.loader'),
      { promised } = require('../../../lib/utils'),
      server = require('../../lib/server'),
      should = require('should'),
      _ = require('underscore')

describe('CTXAPI-489 - Runtime triggers are missing the request body', function() {

  before(async function() {
    const triggerScript = loadScript('CTXAPI-489_ObjectScripts.js')
    await promised(null, sandboxed(function() {

      org.objects.objects.insertOne({
        name: 'c_ctxapi_489_object',
        label: 'CTXAPI-489 Object',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          name: 'c_string',
          label: 'String',
          type: 'String',
          indexed: true,
          removable: true
        }, {
          name: 'c_strings',
          label: 'strings',
          type: 'String',
          indexed: true,
          removable: true,
          array: true
        }]
      }).execute()

      org.objects.script.insertOne({
        name: 'c_ctxapi_489_trigger_lib',
        label: 'c_ctxapi_489_trigger_lib',
        description: 'CTXAPI-489 trigger lib',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_489_trigger_lib'
        }
      }).execute()

    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_489_object.deleteMany().execute()
  }))

  after(sandboxed(function() {
    org.objects.scripts.deleteMany({ name: 'c_ctxapi_489_trigger_lib' }).execute()
    org.objects.objects.deleteMany({ name: 'c_ctxapi_489_object' }).execute()
  }))

  it('should access request body when updating through a PUT request', async() => {
    let putResponse, instance

    instance = await server.sessions.admin
      .post(server.makeEndpoint('/c_ctxapi_489_object'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        c_string: 'Howard',
        c_strings: ['Initial']
      })
      .then()

    putResponse = await server.sessions.admin
      .put(server.makeEndpoint(`/c_ctxapi_489_object/${instance.body._id}`))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        c_string: 'Howie'
      })
      .then()

    should.exist(putResponse)
    should.exist(putResponse.body)
    should.not.exist(putResponse.body.errCode)
    should.equal(putResponse.body.c_string, 'Howie')
    should.equal(putResponse.body.c_strings[0], 'Initial')
    should.equal(putResponse.body.c_strings[1], '{"c_string":"Howie"}')
  })

  it('should not edit the body on before create trigger', async function() {
    let instance

    instance = await server.sessions.admin
      .post(server.makeEndpoint('/c_ctxapi_489_object'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        c_string: 'Danger'
      })
      .then()

    should.exist(instance)
    should.exist(instance.body)
    should.not.exist(instance.body.errCode)
    should.equal(instance.body.c_string, 'Danger')
    should.equal(instance.body.c_strings.length, 0)
  })

  it('should access the body within transform policy', async function() {
    let instances, inserted, result

    inserted = await promised(null, sandboxed(function() {
      script.exit(
        org.objects.c_ctxapi_489_object.insertMany([
          { c_string: 'January' },
          { c_string: 'February' },
          { c_string: 'March' },
          { c_string: 'April' },
          { c_string: 'May' },
          { c_string: 'June' },
          { c_string: 'July' },
          { c_string: 'August' },
          { c_string: 'September' },
          { c_string: 'October' },
          { c_string: 'November' },
          { c_string: 'December' }
        ]).execute()
      )
    }))

    should.exist(inserted)
    should.not.exist(inserted.errCode)
    should.equal(inserted.insertedCount, 12)

    result = await server.sessions.admin
      .post(server.makeEndpoint('/routes/c_ctxapi_489_object'))
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .send({
        filter: true,
        blacklist: [
          'January',
          'February',
          'March',
          'July',
          'Howard'
        ]
      })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.equal(result.body.object, 'list')
    should.equal(result.body.hasMore, false)
    should.equal(result.body.data.length, 9)
    should.equal(result.body.data[8], 'Transform is done! Filtered 4 elements out. Body was {"filter":true,"blacklist":["January","February","March","July","Howard"]}')

    instances = _.initial(result.body.data)

    instances.forEach(elem => {
      should.equal(elem.object, 'c_ctxapi_489_object')
      should.equal(elem.c_strings.length, 0)
    })

    should.equal(instances[0].c_string, 'April')
    should.equal(instances[1].c_string, 'May')
    should.equal(instances[2].c_string, 'June')
    should.equal(instances[3].c_string, 'August')
    should.equal(instances[4].c_string, 'September')
    should.equal(instances[5].c_string, 'October')
    should.equal(instances[6].c_string, 'November')
    should.equal(instances[7].c_string, 'December')
  })
})
