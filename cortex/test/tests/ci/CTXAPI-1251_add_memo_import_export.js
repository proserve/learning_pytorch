'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      { org } = require('../../lib/server')

describe('CTXAPI-1251 - Testing memo with ingest/export cycle', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'CTXAPI-1251 Ref',
      name: 'c_ctxapi_1251_ref',
      defaultAcl: 'owner.delete',
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
          writable: true
          // defaultValue: { type: 'static', value: 'foo' }
        }
      ]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-1251',
      name: 'c_ctxapi_1251',
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
          sourceObject: 'c_ctxapi_1251_ref'
        }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_1251' }).execute()
    Objects.deleteOne({ name: 'c_ctxapi_1251_ref' }).execute()

  }))

  it('Test memo in export pipe during exportEnvironment.', async() => {

    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer'),
            { c_ref_key: refKey } = org.objects.c_ctxapi_1251_ref.insertOne({}).lean(false).execute(),
            manifest = {
              object: 'manifest',
              c_ctxapi_1251_ref: {
                includes: [
                  refKey
                ]
              }
            },
            docs = exportEnvironment({
              manifest,
              package: {
                pipes: {
                  export: `
                    const { Transform } = require('runtime.transform')
                    module.exports = class extends Transform {
                      beforeAll(memo) {
                        memo.exportPipeTest = 'exportPipeTest'
                      }

                      each(object, memo) {
                        return object.object === 'c_ctxapi_1251_ref' ? {...object, c_optional: memo.exportPipeTest} : object
                      }

                      afterAll(memo) {
                        delete memo.exportPipeTest
                      }
                    }
                  `
                }
              }
            }).toArray()

      return docs.find(v => v.object === 'c_ctxapi_1251_ref')
    }))

    should.equal(result.object, 'c_ctxapi_1251_ref')
    should.equal(result.c_optional, 'exportPipeTest')

  })

  it('Test memo in beforeExport and afterExport during exportEnvironment.', async() => {

    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer'),
            { c_ref_key: refKey } = org.objects.c_ctxapi_1251_ref.insertOne({}).lean(false).execute(),
            manifest = {
              object: 'manifest',
              c_ctxapi_1251_ref: {
                includes: [
                  refKey
                ]
              }
            }

      exportEnvironment({
        manifest,
        package: {
          scripts: {
            beforeExport: `
              script.api.context.memo.set('beforeAndAfterExportMemoTest', 'beforeAndAfterExportMemoTest')
            `,
            afterExport: `
              const c_optional = script.api.context.memo.get('beforeAndAfterExportMemoTest') || 'not working'
              return org.objects.c_ctxapi_1251_ref.updateOne({ c_ref_key: '${refKey}' }, { $set: { c_optional } }).execute()
            `
          }
        }
      }).toArray()

      return org.objects.c_ctxapi_1251_ref.find().toArray().find(v => v.c_ref_key === refKey)
    }))

    should.equal(result.object, 'c_ctxapi_1251_ref')
    should.equal(result.c_optional, 'beforeAndAfterExportMemoTest')

  })

  it('Test memo in ingest pipe during importEnvironment.', async() => {

    const result = await promised(null, sandboxed(function() {
      const { environment: { import: importEnvironment } } = require('developer'),
            objDefinition = {
              object: 'object',
              label: 'c_ctxapi_1251_test_ingest_pipe',
              name: 'c_ctxapi_1251_test_ingest_pipe',
              defaultAcl: 'owner.delete',
              createAcl: 'account.public',
              uniqueKey: 'c_key',
              reporting: {
                enabled: true
              },
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
                  label: 'c_ingested_prop',
                  name: 'c_ingested_prop',
                  type: 'String'
                }
              ]
            },
            objInstance = {
              object: 'c_ctxapi_1251_test_ingest_pipe',
              c_key: '9a234637-c036-44e6-84f4-b073edc98978'
            },
            pkg = {
              object: 'package',
              pipes: {
                ingest: `
                  const { Transform } = require('runtime.transform')
                  module.exports = class extends Transform {
                    beforeAll(memo) {
                      memo.ingestPipeTest = 'ingestPipeTest'
                    }

                    each(object, memo) {
                      return object.object === 'c_ctxapi_1251_test_ingest_pipe' ? {...object, c_ingested_prop: memo.ingestPipeTest} : object
                    }

                    afterAll(memo) {
                      delete memo.ingestPipeTest
                    }
                  }
                `
              }
            }

      importEnvironment([pkg, objDefinition, objInstance], { backup: false }).toArray()

      return org.objects.c_ctxapi_1251_test_ingest_pipe.find().toArray().find(v => v.object === 'c_ctxapi_1251_test_ingest_pipe')
    }))

    should.equal(result.object, 'c_ctxapi_1251_test_ingest_pipe')
    should.equal(result.c_key, '9a234637-c036-44e6-84f4-b073edc98978')
    should.equal(result.c_ingested_prop, 'ingestPipeTest')

  })

  it('Test memo in beforeImport and afterImport during importEnvironment.', async() => {

    const result = await promised(null, sandboxed(function() {
      const { environment: { import: importEnvironment } } = require('developer'),
            objDefinition = {
              object: 'object',
              label: 'c_ctxapi_1251_test_ingest_pipe',
              name: 'c_ctxapi_1251_test_ingest_pipe',
              defaultAcl: 'owner.delete',
              createAcl: 'account.public',
              uniqueKey: 'c_key',
              reporting: {
                enabled: true
              },
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
                  label: 'c_ingested_prop',
                  name: 'c_ingested_prop',
                  type: 'String'
                }
              ]
            },
            objInstance = {
              object: 'c_ctxapi_1251_test_ingest_pipe',
              c_key: '9a234637-c036-44e6-84f4-b073edc98978'
            },
            pkg = {
              object: 'package',
              scripts: {
                beforeImport: `
                  script.api.context.memo.set('beforeAndAfterImportMemoTest', 'beforeAndAfterImportMemoTest')
                `,
                afterImport: `
                  const c_ingested_prop = script.api.context.memo.get('beforeAndAfterImportMemoTest') || 'not working'
                  return org.objects.c_ctxapi_1251_test_ingest_pipe.updateOne({ c_key: '9a234637-c036-44e6-84f4-b073edc98978' }, { $set: { c_ingested_prop } }).execute()
                `
              }
            }

      importEnvironment([pkg, objDefinition, objInstance], { backup: false }).toArray()

      return org.objects.c_ctxapi_1251_test_ingest_pipe.find().toArray().find(v => v.object === 'c_ctxapi_1251_test_ingest_pipe')
    }))

    should.equal(result.object, 'c_ctxapi_1251_test_ingest_pipe')
    should.equal(result.c_key, '9a234637-c036-44e6-84f4-b073edc98978')
    should.equal(result.c_ingested_prop, 'beforeAndAfterImportMemoTest')

  })

})
