'use strict'

/* global org */

require('should')

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_244_patient.deleteMany({}).execute()
        org.objects.objects.deleteOne({ name: 'c_ctxapi_244_patient' }).execute()
        should.equal(org.objects.objects.find({ name: 'c_ctxapi_244_patient' }).count(), 0)
      }

describe('Issues - Aggregation Project with latest engine', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'CTXAPI-244 Patient',
      name: 'c_ctxapi_244_patient',
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

  }))

  before(sandboxed(function() {
    org.objects.c_ctxapi_244_patient.insertOne({
      c_name: 'patient',
      c_age: (Math.random() * 100).toFixed(0),
      c_height: (Math.random() * 200).toFixed(0),
      c_weight: (Math.random() * 150).toFixed(2),
      c_does_exercise: true,
      c_address: ['address', 'address0']
    }).execute()
  }))

  after(sandboxed(cleanInstances))

  describe('Test Projection fields', function() {

    it('should project age and name with integer', sandboxed(function() {
      require('should')
      const patients = org.objects.c_ctxapi_244_patient.aggregate().project({ c_age: 1, c_name: 1 }).engine('latest').toArray(),
            keys = Object.keys(patients[0])
      keys.length.should.equal(3)
      keys[0].should.equal('c_age')
      keys[1].should.equal('c_name')
      keys[2].should.equal('_id')
    }))

    it('should project age and name with boolean', sandboxed(function() {
      require('should')
      const patients = org.objects.c_ctxapi_244_patient.aggregate().project({ c_age: true, c_name: true }).engine('latest').toArray(),
            keys = Object.keys(patients[0])
      keys.length.should.equal(3)
      keys[0].should.equal('c_age')
      keys[1].should.equal('c_name')
      keys[2].should.equal('_id')
    }))

    it('should project age true and name false with boolean', sandboxed(function() {
      require('should')
      const patients = org.objects.c_ctxapi_244_patient.aggregate().project({ c_age: true, c_name: false }).engine('latest').toArray(),
            keys = Object.keys(patients[0])
      keys.length.should.equal(2)
      keys[0].should.equal('c_age')
      keys[1].should.equal('_id')
    }))
  })
})
