'use strict'

/* global org */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_243_study.deleteMany({}).execute()
        org.objects.c_ctxapi_243_patient.deleteMany({}).execute()
        org.objects.objects.deleteOne({ name: 'c_ctxapi_243_study' }).execute()
        org.objects.objects.deleteOne({ name: 'c_ctxapi_243_patient' }).execute()

        should.equal(org.objects.objects.find({ name: 'c_ctxapi_243_study' }).count(), 0)
        should.equal(org.objects.objects.find({ name: 'c_ctxapi_243_patient' }).count(), 0)
      }

let instanceId

describe('Issues - Pipeline operations', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'CTXAPI-243 Patient',
      name: 'c_ctxapi_243_patient',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        { label: 'name', name: 'c_name', type: 'String', indexed: true },
        { label: 'address', name: 'c_address', type: 'String', array: true, indexed: true },
        { label: 'doesExercise', name: 'c_does_exercise', type: 'Boolean', indexed: true },
        { label: 'age', name: 'c_age', type: 'Number', indexed: true },
        { label: 'height', name: 'c_height', type: 'Number', indexed: true },
        { label: 'weight', name: 'c_weight', type: 'Number', indexed: true }
      ]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-243',
      name: 'c_ctxapi_243_study',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        { label: 'name', name: 'c_name', type: 'String', indexed: true },
        {
          name: 'c_patients',
          label: 'Patients',
          type: 'List',
          sourceObject: 'c_ctxapi_243_patient',
          readThrough: true,
          writeThrough: true
        }
      ]
    }).execute()
  }))

  before(sandboxed(function() {
    let i = 0
    org.objects.c_ctxapi_243_study.insertOne({ c_name: 'A Study' }).execute()

    while (i < 10) {
      i++
      org.objects.c_ctxapi_243_patient.insertOne({
        c_name: 'patient' + i,
        c_age: (Math.random() * 100).toFixed(0),
        c_height: (Math.random() * 200).toFixed(0),
        c_weight: (Math.random() * 150).toFixed(2),
        c_does_exercise: i % 2 === 0,
        c_address: ['address' + i, 'address0' + i]
      }).execute()
    }

  }))

  before(async() => {
    instanceId = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_243_study.find().next()._id
    }))
  })

  after(sandboxed(cleanInstances))

  describe('REST API', function() {

    it('should group and count with group operator', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?group={"_id":null,"count":{"$count":"_id"}}')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 1)
      should.equal(result.body.data[0].count, 10)
    })

    it('should group and count with pipeline operator', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$group":{"_id":null,"count":{"$count":"_id"}}}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 1)
      should.equal(result.body.data[0].count, 10)
    })

    it('should limit the results', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?limit=4')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 4)
    })

    it('should limit the results within a pipeline', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$limit":4}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 4)
    })

    it('should match the results using where operator', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?where={"c_does_exercise":{"$eq":true}}')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 5)
    })

    it('should match the results within a pipeline', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$match":{"c_does_exercise":{"$eq":true}}}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 5)
    })

    it('should sort the results', async() => {
      let result, ages

      result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?sort={"c_age":1}')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 10)
      ages = result.body.data.map(p => p.c_age)

      for (let current = 0; current < ages.length - 1; current++) {
        let next = current + 1

        ages[current].should.be.belowOrEqual(ages[next])
      }
    })

    it('should sort the results using pipeline', async() => {
      let result, ages

      result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$sort":{"c_age":1}}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 10)
      ages = result.body.data.map(p => p.c_age)

      for (let current = 0; current < ages.length - 1; current++) {
        let next = current + 1

        ages[current].should.be.belowOrEqual(ages[next])
      }
    })

    it('should skip the results', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?skip=3')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 7)
    })

    it('should skip the results in a pipeline', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$skip":3}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 7)
    })

    it('should unwind the results in a pipeline', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$project":{"c_address":1}},{"$unwind":"c_address"}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 20)
    })

    it('should project the results in a pipeline', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?pipeline=[{"$project":{"c_address":0,"c_age":1,"c_height":true,"c_weight":true,"c_name":1,"c_bmi":{"$divide":["c_weight",{"$pow":[{"$divide":["c_height",{"$number":100}]},{"$number":2}]}]}}}]')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 10)
      result.body.data.forEach(p => {
        should.exist(p.c_age)
        should.exist(p.c_height)
        should.exist(p.c_weight)
        should.exist(p.c_name)
        should.exist(p.c_bmi)
        should.not.exist(p.c_address)
      })

    })

    it('should project the results', async() => {
      let result = await performGET('/c_ctxapi_243_study/' + instanceId + '/c_patients?paths=c_age')

      should.exist(result)
      should.exist(result.body)
      should.not.exist(result.body.errCode)
      should.exist(result.body.data)
      should.equal(result.body.data.length, 10)
      result.body.data.forEach(p => {
        should.exist(p._id)
        should.exist(p.c_age)
        should.equal(p.object, 'c_ctxapi_243_patient')
      })

    })
  })
})

async function performGET(endpoint) {

  return server.sessions.admin
    .get(server.makeEndpoint(endpoint))
    .set(server.getSessionHeaders())
    .then()
}
