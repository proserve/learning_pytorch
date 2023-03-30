'use strict'

/* global before, after */

const { sandboxed } = require('../setup')

describe('Modules.Developer - CTXAPI-200 - Export ObjectId[] fails to add dependencies', function() {

  before(sandboxed(function() {

    const { import: importEnvironment } = require('developer').environment

    importEnvironment([
      {
        name: 'c_ctxapi_200a',
        label: 'c_ctxapi_200a',
        object: 'object',
        createAcl: ['account.public'],
        defaultAcl: ['owner.delete'],
        uniqueKey: 'c_name',
        properties: [{
          name: 'c_name',
          label: 'c_name',
          type: 'String',
          unique: true,
          indexed: true,
          validators: [{
            name: 'customName'
          }]
        }, {
          name: 'c_id',
          label: 'c_id',
          type: 'ObjectId',
          sourceObject: 'c_ctxapi_200b'
        }, {
          name: 'c_ids',
          label: 'c_ids',
          type: 'ObjectId',
          array: true,
          sourceObject: 'c_ctxapi_200b'
        }]
      },
      {
        name: 'c_ctxapi_200b',
        label: 'c_ctxapi_200b',
        object: 'object',
        createAcl: ['account.public'],
        defaultAcl: ['owner.delete'],
        uniqueKey: 'c_name',
        properties: [{
          name: 'c_name',
          label: 'c_name',
          type: 'String',
          unique: true,
          indexed: true,
          validators: [{
            name: 'customName'
          }]
        }]
      },
      {
        c_name: 'c_ulinaryDelights',
        object: 'c_ctxapi_200a',
        c_id: 'c_ctxapi_200b.c_ornOnTheCob',
        c_ids: ['c_ctxapi_200b.c_antStopThisThingWeStarted', 'c_ctxapi_200b.c_umberbatch']
      },
      {
        c_name: 'c_ornOnTheCob',
        object: 'c_ctxapi_200b'
      },
      {
        c_name: 'c_antStopThisThingWeStarted',
        object: 'c_ctxapi_200b'
      },
      {
        c_name: 'c_umberbatch',
        object: 'c_ctxapi_200b'
      },
      {
        object: 'manifest',
        includes: ['*']
      }
    ], {
      backup: false
    }).toArray() // exhaust cursor

  }))

  after(sandboxed(function() {

    /* global org */

    org.objects.objects.deleteMany({ name: /^c_ctxapi_200/ }).execute()

  }))

  it('Exported instances should be correctly mapped', sandboxed(function() {

    require('should')

    const { export: exportEnvironment } = require('developer').environment,
          instance = exportEnvironment({
            manifest: {
              c_ctxapi_200a: {
                includes: ['*']
              },
              c_ctxapi_200b: {
                includes: ['*']
              }
            }
          }).filter(v => v.c_name === 'c_ulinaryDelights')[0]

    instance.c_id.should.equal('c_ctxapi_200b.c_ornOnTheCob')
    instance.c_ids[0].should.equal('c_ctxapi_200b.c_antStopThisThingWeStarted')
    instance.c_ids[1].should.equal('c_ctxapi_200b.c_umberbatch')

  }))

  it('Imported instances should exist and be correctly mapped', sandboxed(function() {

    /* global org */

    require('should')

    const { equalIds } = require('util.id'),
          { c_ctxapi_200a: ModelA, c_ctxapi_200b: ModelB } = org.objects,
          culinaryDelights = ModelA.find().next(),
          cornOnTheCob = ModelB.find({ c_name: 'c_ornOnTheCob' }).next()._id,
          cantStopThisThingWeStarted = ModelB.find({ c_name: 'c_antStopThisThingWeStarted' }).next()._id,
          cumberbatch = ModelB.find({ c_name: 'c_umberbatch' }).next()._id

    equalIds(culinaryDelights.c_id, cornOnTheCob).should.be.true()
    equalIds(culinaryDelights.c_ids[0], cantStopThisThingWeStarted).should.be.true()
    equalIds(culinaryDelights.c_ids[1], cumberbatch).should.be.true()

  }))

})
