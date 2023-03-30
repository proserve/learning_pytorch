'use strict'

/* global before, after */

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-221 - Export dependency setting behaviour.', function() {

  before(sandboxed(function() {

    /* global org, script */

    org.objects.org.updateOne({
      code: script.org.code
    }, {
      $push: {
        roles: [{
          name: 'c_ctxapi_221_ref',
          code: 'c_ctxapi_221_ref'
        }, {
          name: 'c_ctxapi_221',
          code: 'c_ctxapi_221',
          include: ['c_ctxapi_221_ref']
        }]
      }
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-221 Ref',
      name: 'c_ctxapi_221_ref',
      defaultAcl: ['owner.delete', 'role.c_ctxapi_221.read'], // <-- role to test dependencies
      createAcl: 'account.public',
      uniqueKey: 'c_ref_key',
      properties: [
        {
          label: 'c_ref_key',
          name: 'c_ref_key',
          type: 'UUID',
          autoGenerate: true,
          indexed: true,
          unique: true,
          writable: false
        },
        {
          label: 'c_optional',
          name: 'c_optional',
          type: 'String',
          defaultValue: { type: 'static', value: 'foo' }
        }
      ]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-221',
      name: 'c_ctxapi_221',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        {
          label: 'c_key',
          name: 'c_key',
          type: 'UUID',
          autoGenerate: true,
          indexed: true,
          unique: true,
          writable: false
        },
        {
          label: 'c_ref',
          name: 'c_ref',
          type: 'Reference',
          sourceObject: 'c_ctxapi_221_ref'
        }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects, Org } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_221' }).execute()
    Objects.deleteOne({ name: 'c_ctxapi_221_ref' }).execute()
    Org.updateOne({}, { $pull: { roles: ['c_ctxapi_221_ref', 'c_ctxapi_221'] } }).execute()

  }))

  it('Exporting Config - anything with dependencies should include dependencies', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer')

    {
      const manifest = {
              object: 'manifest',
              dependencies: true,
              objects: [{
                name: 'c_ctxapi_221',
                includes: [
                  '*'
                ]
              }]
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.true()
      resources.includes('object.c_ctxapi_221_ref').should.be.true()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.true()
    }

    {
      const manifest = {
              object: 'manifest',
              dependencies: true,
              objects: [{
                name: 'c_ctxapi_221_ref',
                includes: [
                  '*'
                ]
              }]
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.false()
      resources.includes('object.c_ctxapi_221_ref').should.be.true()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.true()
    }

    {
      const manifest = {
              object: 'manifest',
              dependencies: true,
              roles: {
                includes: ['c_ctxapi_221']
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.false()
      resources.includes('object.c_ctxapi_221_ref').should.be.false()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.true()
    }

  }))

  it('Exporting Config - anything without dependencies should include nothing', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer')

    {
      const manifest = {
              object: 'manifest',
              dependencies: false,
              objects: [{
                name: 'c_ctxapi_221',
                includes: [
                  '*'
                ]
              }]
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.true()
      resources.includes('object.c_ctxapi_221_ref').should.be.false()
      resources.includes('role.c_ctxapi_221').should.be.false()
      resources.includes('role.c_ctxapi_221_ref').should.be.false()
    }

    {
      const manifest = {
              object: 'manifest',
              dependencies: false,
              objects: [{
                name: 'c_ctxapi_221',
                includes: [
                  '*'
                ]
              }, {
                name: 'c_ctxapi_221_ref',
                includes: [
                  '*'
                ]
              }]
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.true()
      resources.includes('object.c_ctxapi_221_ref').should.be.true()
      resources.includes('role.c_ctxapi_221').should.be.false()
      resources.includes('role.c_ctxapi_221_ref').should.be.false()
    }

    {
      const manifest = {
              object: 'manifest',
              dependencies: false,
              roles: {
                includes: ['c_ctxapi_221']
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.false()
      resources.includes('object.c_ctxapi_221_ref').should.be.false()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.false()
    }

  }))

  it('Exporting Config - mixed dependency settings', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer')

    {
      const manifest = {
              object: 'manifest',
              dependencies: false,
              objects: [{
                name: 'c_ctxapi_221',
                includes: [
                  '*'
                ]
              }],
              roles: {
                dependencies: true,
                includes: ['c_ctxapi_221']
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.true()
      resources.includes('object.c_ctxapi_221_ref').should.be.false()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.true()
    }

    {
      const manifest = {
              object: 'manifest',
              dependencies: true,
              objects: [{
                name: 'c_ctxapi_221',
                includes: [
                  '*'
                ]
              }],
              roles: {
                dependencies: false,
                includes: ['c_ctxapi_221']
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes('object.c_ctxapi_221').should.be.true()
      resources.includes('object.c_ctxapi_221_ref').should.be.true()
      resources.includes('role.c_ctxapi_221').should.be.true()
      resources.includes('role.c_ctxapi_221_ref').should.be.false()
    }

  }))

  it('Exporting Instances - with dependency should include referenced instance data', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer'),
          { c_ref_key: refKey, _id: refId } = org.objects.c_ctxapi_221_ref.insertOne({}).lean(false).execute(),
          { c_key: key } = org.objects.c_ctxapi_221.insertOne({ c_ref: refId }).lean(false).execute(),
          manifest = {
            object: 'manifest',
            dependencies: true,
            c_ctxapi_221: {
              includes: [
                key
              ]
            }
          },
          { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

    resources.includes(`c_ctxapi_221.${key}`).should.be.true()
    resources.includes(`c_ctxapi_221_ref.${refKey}`).should.be.true()

  }))

  it('Exporting Instances - data without dependencies should not include referenced instance data', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer')

    {
      const { c_ref_key: refKey, _id: refId } = org.objects.c_ctxapi_221_ref.insertOne({}).lean(false).execute(),
            { c_key: key } = org.objects.c_ctxapi_221.insertOne({ c_ref: refId }).lean(false).execute(),
            manifest = {
              object: 'manifest',
              dependencies: false,
              c_ctxapi_221: {
                includes: [
                  key
                ]
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes(`c_ctxapi_221.${key}`).should.be.true()
      resources.includes(`c_ctxapi_221_ref.${refKey}`).should.be.false()
    }

  }))

  it('Exporting Instances - mixed dependency settings', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer')

    {
      const { c_ref_key: refKey, _id: refId } = org.objects.c_ctxapi_221_ref.insertOne({}).lean(false).execute(),
            { c_key: key } = org.objects.c_ctxapi_221.insertOne({ c_ref: refId }).lean(false).execute(),
            manifest = {
              object: 'manifest',
              dependencies: false,
              c_ctxapi_221: {
                dependencies: true, // <-- mixed settings
                includes: [
                  key
                ]
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes(`c_ctxapi_221.${key}`).should.be.true()
      resources.includes(`c_ctxapi_221_ref.${refKey}`).should.be.true()
    }

    {
      const { c_ref_key: refKey, _id: refId } = org.objects.c_ctxapi_221_ref.insertOne({}).lean(false).execute(),
            { c_key: key } = org.objects.c_ctxapi_221.insertOne({ c_ref: refId }).lean(false).execute(),
            manifest = {
              object: 'manifest',
              dependencies: true,
              c_ctxapi_221: {
                dependencies: false, // <-- mixed settings
                includes: [
                  key
                ]
              }
            },
            { resources } = exportEnvironment({ manifest }).toArray().find(v => v.object === 'manifest-exports')

      resources.includes(`c_ctxapi_221.${key}`).should.be.true()
      resources.includes(`c_ctxapi_221_ref.${refKey}`).should.be.false()
    }

  }))

})
