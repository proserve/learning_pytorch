'use strict'

/* global org, script */

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      convert = (from, to) => str => Buffer.from(str, from).toString(to),
      hexToUtf8 = convert('hex', 'utf8'),
      base64ToUtf8 = convert('base64', 'utf8'),
      base64ToHex = convert('base64', 'hex')

describe('CTXAPI-500 - Binary props instance data can be exported and imported', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      name: 'c_ctxapi_500_object',
      label: 'CTXAPI-500 Object',
      defaultAcl: 'role.administrator.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [{
        label: 'Binary Base64',
        name: 'c_binary_base64',
        type: 'Binary',
        outputEncoding: 'base64'
      }, {
        label: 'Binary Hex',
        name: 'c_binary_hex',
        type: 'Binary',
        outputEncoding: 'hex'
      }, {
        label: 'c_key',
        name: 'c_key',
        type: 'UUID',
        autoGenerate: true,
        indexed: true,
        unique: true,
        writable: false
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    require('should')
    org.objects.objects.deleteOne({ name: 'c_ctxapi_500_object' }).execute().should.equal(true)
  }))

  it('should export and import instance data with binary props', async function() {
    let instance, exp, exportData, manifest, manifestDependencies, manifestExports

    instance = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_500_object.insertOne({
        c_binary_base64: new Buffer('small text'), // eslint-disable-line node/no-deprecated-api
        c_binary_hex: new Buffer('something else') // eslint-disable-line node/no-deprecated-api
      }).lean(false).execute()
    }))

    should.exist(instance)
    should.equal(base64ToUtf8(instance.c_binary_base64), 'small text')
    should.equal(hexToUtf8(instance.c_binary_hex), 'something else')

    exp = await promised(null, sandboxed(function() {
      const { environment } = require('developer'),
            manifest = {
              manifest: {
                c_ctxapi_500_object: {
                  includes: [ script.arguments.instanceKey ]
                }
              }
            }

      return environment.export(manifest).toArray()
    }, {
      runtimeArguments: {
        instanceKey: instance.c_key
      }
    }))

    should.exist(exp)
    should.equal(exp.length, 4)
    exportData = exp.find(e => e.object === 'c_ctxapi_500_object')
    manifest = exp.find(e => e.object === 'manifest')
    manifestDependencies = exp.find(e => e.object === 'manifest-dependencies')
    manifestExports = exp.find(e => e.object === 'manifest-exports')

    should.equal(base64ToHex(exportData.c_binary_hex), instance.c_binary_hex)
    should.equal(exportData.c_binary_base64, instance.c_binary_base64)
    should.equal(exportData.c_key, instance.c_key)
    should.equal(exportData.resource, `c_ctxapi_500_object.${instance.c_key}`)

    should.equal(manifest.c_ctxapi_500_object.includes.length, 1)
    should.equal(manifest.c_ctxapi_500_object.includes[0], instance.c_key)

    manifestDependencies.dependencies.should.be.empty()

    should.equal(manifestExports.resources.length, 1)
    should.equal(manifestExports.resources[0], `c_ctxapi_500_object.${instance.c_key}`)

    instance = await promised(null, sandboxed(function() {
      const { environment } = require('developer'),
            { c_ctxapi_500_object: Model } = org.objects,
            should = require('should')

      Model.deleteMany().execute()
      should.equal(Model.find().count(), 0)
      environment.import(script.arguments.exp).toArray()
      should.equal(Model.find().count(), 1)

      return Model.find().next()
    }, {
      runtimeArguments: {
        exp
      }
    }))

    should.exist(instance)
    should.equal(instance.object, exp[0].object)
    should.equal(instance.c_binary_base64, exp[0].c_binary_base64)
    should.equal(instance.c_binary_hex, base64ToHex(exp[0].c_binary_hex))
    should.equal(instance.c_key, exp[0].c_key)

  })
})
