'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-359 - Instance imports with circular references.', function() {

  before(sandboxed(function() {

    const { Objects } = org.objects

    Objects.insertMany([{
      label: 'c_ctxapi_359_a',
      name: 'c_ctxapi_359_a',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        { name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true }
      ]
    }, {
      label: 'c_ctxapi_359_b',
      name: 'c_ctxapi_359_b',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        { name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true }
      ]
    }]).execute()

    Objects.updateOne({
      name: 'c_ctxapi_359_a'
    }, {
      $push: {
        properties: [{
          name: 'c_ctxapi_359_b', label: 'c_ctxapi_359_b', type: 'Reference', sourceObject: 'c_ctxapi_359_b'
        }, {
          name: 'c_doc',
          label: 'c_doc',
          type: 'Document',
          properties: [{
            name: 'c_ctxapi_359_b', label: 'c_ctxapi_359_b', type: 'Reference', sourceObject: 'c_ctxapi_359_b'
          }]
        }, {
          name: 'c_arr',
          label: 'c_arr',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', validators: [{ name: 'uniqueInArray' }]
          }, {
            name: 'c_ctxapi_359_b', label: 'c_ctxapi_359_b', type: 'Reference', sourceObject: 'c_ctxapi_359_b'
          }]
        }]
      }
    }).execute()

    Objects.updateOne({
      name: 'c_ctxapi_359_b'
    }, {
      $push: {
        properties: [{
          name: 'c_ctxapi_359_a', label: 'c_ctxapi_359_a', type: 'Reference', sourceObject: 'c_ctxapi_359_a'
        }, {
          name: 'c_doc',
          label: 'c_doc',
          type: 'Document',
          properties: [{
            name: 'c_ctxapi_359_a', label: 'c_ctxapi_359_a', type: 'Reference', sourceObject: 'c_ctxapi_359_a'
          }]
        }, {
          name: 'c_arr',
          label: 'c_arr',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', validators: [{ name: 'uniqueInArray' }]
          }, {
            name: 'c_ctxapi_359_a', label: 'c_ctxapi_359_a', type: 'Reference', sourceObject: 'c_ctxapi_359_a'
          }]
        }]
      }
    }).execute()

  }))

  it('should fail to import instances with unhandled circular references - top-level', sandboxed(function() {

    /* global org */

    const should = require('should'),
          { environment } = require('developer'),
          { c_ctxapi_359_a: A, c_ctxapi_359_b: B } = org.objects,
          a = A.insertOne({}).lean(false).execute(),
          b = B.insertOne({}).lean(false).execute(),
          manifest = {
            manifest: {
              c_ctxapi_359_a: {
                includes: [a.c_key]
              }
            }
          }

    let before, err

    A.updateOne({ _id: a._id }, { $set: { c_ctxapi_359_b: b._id } }).execute()
    B.updateOne({ _id: b._id }, { $set: { c_ctxapi_359_a: a._id } }).execute()

    before = environment.export(
      manifest).toArray()

    A.deleteOne({ _id: a._id }).execute()
    B.deleteOne({ _id: b._id }).execute()

    try {
      environment.import(before, { backup: false, triggers: false }).toArray()
    } catch (e) {
      err = e
    }

    should.equal(err && err.errCode, 'cortex.invalidArgument.circularReference')

  }))

  it('should fail to import instances with unhandled circular references - in doc', sandboxed(function() {

    /* global org */

    const should = require('should'),
          { environment } = require('developer'),
          { c_ctxapi_359_a: A, c_ctxapi_359_b: B } = org.objects,
          a = A.insertOne({}).lean(false).execute(),
          b = B.insertOne({}).lean(false).execute(),
          manifest = {
            manifest: {
              c_ctxapi_359_a: {
                includes: [a.c_key]
              }
            }
          }

    let before, err

    A.updateOne({ _id: a._id }, { $set: { c_doc: { c_ctxapi_359_b: b._id } } }).execute()
    B.updateOne({ _id: b._id }, { $set: { c_doc: { c_ctxapi_359_a: a._id } } }).execute()

    before = environment.export(manifest).toArray()

    A.deleteOne({ _id: a._id }).execute()
    B.deleteOne({ _id: b._id }).execute()

    try {
      environment.import(before, { backup: false, triggers: false }).toArray()
    } catch (e) {
      err = e
    }

    should.equal(err && err.errCode, 'cortex.invalidArgument.circularReference')
    err.resource.startsWith(`c_ctxapi_359_a.${a.c_key}.c_doc.c_ctxapi_359_b.c_ctxapi_359_b.${b.c_key}.c_doc.c_ctxapi_359_a`).should.be.true()

  }))

  it('should fail to import instances with unhandled circular references - in doc array', sandboxed(function() {

    /* global org */

    const should = require('should'),
          { environment } = require('developer'),
          { c_ctxapi_359_a: A, c_ctxapi_359_b: B } = org.objects,
          a = A.insertOne({}).lean(false).execute(),
          b = B.insertOne({}).lean(false).execute(),
          manifest = {
            manifest: {
              c_ctxapi_359_a: {
                includes: [a.c_key]
              }
            }
          }

    let before, err

    A.updateOne({ _id: a._id }, { $push: { c_arr: [{ c_ctxapi_359_b: b._id }] } }).execute()
    B.updateOne({ _id: b._id }, { $push: { c_arr: [{ c_ctxapi_359_a: a._id }] } }).execute()

    before = environment.export(manifest).toArray()

    A.deleteOne({ _id: a._id }).execute()
    B.deleteOne({ _id: b._id }).execute()

    try {
      environment.import(before, { backup: false, triggers: false }).toArray()
    } catch (e) {
      err = e
    }

    should.equal(err && err.errCode, 'cortex.invalidArgument.circularReference')
    err.resource.startsWith(`c_ctxapi_359_a.${a.c_key}.c_arr.0.c_ctxapi_359_b.c_ctxapi_359_b.${b.c_key}.c_arr.0.c_ctxapi_359_a`).should.be.true()

  }))

})
