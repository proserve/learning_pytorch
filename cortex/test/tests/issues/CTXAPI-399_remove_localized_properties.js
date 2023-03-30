'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-399 - remove/unset localized properties', function() {

  before(sandboxed(function() {

    let idOne,
        instanceId

    org.objects.objects.insertOne({
      label: 'c_ctxapi_399',
      name: 'c_ctxapi_399',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true,
          removable: true,
          localization: {
            enabled: true,
            strict: false,
            fallback: true,
            acl: [],
            fixed: '',
            valid: ['en_US', 'es_AR']
          }
        }]
    }).execute()

    idOne = org.objects.c_ctxapi_399.insertOne({
      c_string: 'Hello'
    }).execute()

    org.objects.c_ctxapi_399.updateOne({ _id: idOne }, {
      $set: {
        c_string: 'Hola'
      }
    }).locale('es_AR').execute()

    org.objects.objects.insertOne({
      label: 'c_ctxapi_399_loc_after',
      name: 'c_ctxapi_399_loc_after',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true,
          removable: true
        }]
    }).execute()

    instanceId = org.objects.c_ctxapi_399_loc_after.insertOne({
      c_string: 'Hello My old value!'
    }).execute()

    org.objects.objects.updateOne({ name: 'c_ctxapi_399_loc_after' }, {
      $set: {
        properties: [{
          name: 'c_string',
          label: 'c_string',
          type: 'String',
          indexed: true,
          removable: true,
          localization: {
            enabled: true,
            strict: false,
            fallback: true,
            acl: [],
            fixed: '',
            valid: ['en_US', 'es_AR']
          }
        }]
      }
    }).execute()

    org.objects.c_ctxapi_399_loc_after.updateOne({ _id: instanceId }, {
      $set: {
        c_string: 'Hello My new value!'
      }
    }).execute()

    org.objects.c_ctxapi_399_loc_after.updateOne({ _id: instanceId }, {
      $set: {
        c_string: 'Hola'
      }
    }).locale('es_AR').execute()

  }))

  after(sandboxed(function() {
    org.objects.c_ctxapi_399.deleteMany({}).execute()
    org.objects.c_ctxapi_399_loc_after.deleteMany({}).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_399' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_399_loc_after' }).execute()
  }))

  it('run $unset property on document created with localization', sandboxed(function() {
    const should = require('should'),
          _id = org.objects.c_ctxapi_399.find().toArray()[0]._id
    /* global org */
    org.objects.c_ctxapi_399.updateOne({ _id }, {
      $unset: { c_string: 1 }
    }).execute()

    let result = org.objects.c_ctxapi_399.find({ _id }).include('locales').next()
    result.c_string.should.equal('Hola')
    result.locales.c_string.length.should.equal(1)
    result.locales.c_string[0].locale.should.equal('es_AR')

    // now remove latest locale
    org.objects.c_ctxapi_399.updateOne({ _id }, {
      $unset: { c_string: 1 }
    }).locale(result.locales.c_string[0].locale).execute()

    result = org.objects.c_ctxapi_399.find({ _id }).include('locales').next()
    should.not.exist(result.c_string)
    result.locales.c_string.length.should.equal(0)
  }))

  it('run $unset property on document update with localization', sandboxed(function() {
    const should = require('should'),
          _id = org.objects.c_ctxapi_399_loc_after.find().toArray()[0]._id
    /* global org */
    org.objects.c_ctxapi_399_loc_after.updateOne({ _id }, {
      $unset: { c_string: 1 }
    }).execute()

    let result = org.objects.c_ctxapi_399_loc_after.find({ _id }).include('locales').next()
    result.c_string.should.equal('Hola')
    result.locales.c_string.length.should.equal(1)
    result.locales.c_string[0].locale.should.equal('es_AR')

    // now remove latest locale
    org.objects.c_ctxapi_399_loc_after.updateOne({ _id }, {
      $unset: { c_string: 1 }
    }).locale(result.locales.c_string[0].locale).execute()

    result = org.objects.c_ctxapi_399_loc_after.find({ _id }).include('locales').next()
    should.not.exist(result.c_string)
    result.locales.c_string.length.should.equal(0)
  }))

})
