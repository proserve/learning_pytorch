const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { isArray } = require('underscore'),
      bent = require('bent'),
      getBuffer = bent('buffer'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      should = require('should')

let fileObject,
    legacyFileObject,
    nonLocalizedFileObject

describe('i18n - File localization', function() {

  before(async() => {
    // create some bundles
    const ids = await promised(null, sandboxed(function() {
      let result = {}
      const i18n = require('i18n'),
            Objects = global.org.objects

      // create i18n objects to then after create the bundles.
      Objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'app_1833',
          weight: 1,
          assets: [{
            key: 'ab231334-0479-4442-b356-03d5df784d17.ctxapi-1833.single.file',
            value: [{
              content: {
                source: 'buffer',
                buffer: Buffer.from('single file contents (not an array)'),
                filename: 'single_file.txt',
                mime: 'text/plain'
              }
            }]
          }, {
            key: 'ab231334-0479-4442-b356-03d5df784d17.ctxapi-1833.file.array',
            value: [{
              content: {
                source: 'buffer',
                buffer: Buffer.from('c_file_array contents #0'),
                filename: 'asset_file_0.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('c_file_array contents #1'),
                filename: 'asset_file_1.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('c_file_array contents #2'),
                filename: 'asset_file_2.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('c_file_array contents #3'),
                filename: 'asset_file_3.txt',
                mime: 'text/plain'
              }
            }]
          }],
          name: 'test__en_US_app_1833'
        },
        {
          locale: 'es_ES',
          namespace: 'app_1833',
          // assets are uploaded
          assets: [{
            key: 'ab231334-0479-4442-b356-03d5df784d17.ctxapi-1833.single.file',
            value: [{
              content: {
                source: 'buffer',
                buffer: Buffer.from('Los contenidos del archivo simple'),
                filename: 'archivo_simple.txt',
                mime: 'text/plain'
              }
            }]
          }, {
            key: 'ab231334-0479-4442-b356-03d5df784d17.ctxapi-1833.file.array',
            value: [{
              content: {
                source: 'buffer',
                buffer: Buffer.from('Contenido del arreglo de archivos #0'),
                filename: 'archivo_indice_0.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('Contenido del arreglo de archivos #1'),
                filename: 'archivo_indice_1.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('Contenido del arreglo de archivos #2'),
                filename: 'archivo_indice_2.txt',
                mime: 'text/plain'
              }
            }, {
              content: {
                source: 'buffer',
                buffer: Buffer.from('Contenido del arreglo de archivos #3'),
                filename: 'archivo_indice_3.txt',
                mime: 'text/plain'
              }
            }]
          }],
          name: 'test__es_ES_app_1833'
        }
      ]).skipAcl().grant(8).execute()

      // waiting for media processor
      require('debug').sleep(4000)

      i18n.buildBundles({ onePerNs: true })
      // i18n.buildBundles({ locales: ['en_US', 'es_ES'] })

      Objects.object.insertOne({
        name: 'i18n__legacy_file_localization_object',
        label: 'i18n__legacy_file_localization_object',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'c_key',
          uuidVersion: 4,
          autoGenerate: true,
          type: 'UUID',
          indexed: true,
          unique: true
        }, {
          name: 'c_file',
          label: 'c_file',
          type: 'File',
          localization: {
            enabled: true,
            strict: false,
            fallback: true,
            fixed: ''
          },
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }]
        }, {
          name: 'c_file_array',
          label: 'c_file_array',
          type: 'File',
          array: true,
          localization: {
            enabled: true,
            strict: false,
            fallback: true,
            fixed: ''
          },
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }]
        }]
      }).execute()

      Objects.object.insertOne({
        useBundles: true,
        name: 'i18n__file_localization_object',
        label: 'i18n__file_localization_object',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'c_key',
          uuidVersion: 4,
          autoGenerate: false,
          type: 'UUID',
          indexed: true,
          unique: true
        }, {
          type: 'File',
          name: 'c_file',
          label: 'c_file',
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }],
          localization: {
            enabled: true,
            translationKey: 'ctxapi-1833.single.file',
            namespace: 'app_1833'
          }
        }, {
          type: 'File',
          name: 'c_file_array',
          label: 'c_file_array',
          array: true,
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }],
          localization: {
            enabled: true,
            translationKey: 'ctxapi-1833.file.array',
            namespace: 'app_1833'
          }
        }]
      }).execute()

      Objects.object.insertOne({
        name: 'i18n__non_localized',
        label: 'i18n__non_localized',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        uniqueKey: 'c_key',
        properties: [{
          name: 'c_key',
          label: 'c_key',
          uuidVersion: 4,
          autoGenerate: true,
          type: 'UUID',
          indexed: true,
          unique: true
        }, {
          type: 'File',
          name: 'c_file',
          label: 'c_file',
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }]
        }, {
          type: 'File',
          name: 'c_file_array',
          label: 'c_file_array',
          array: true,
          processors: [{
            allowUpload: true,
            label: 'Content',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'content',
            passMimes: false,
            private: false,
            required: true,
            source: 'content',
            type: 'passthru'
          }]
        }]
      }).execute()

      result.legacyFileObject = Objects.i18n__legacy_file_localization_object.insertOne({
        c_key: 'ab917317-bf4a-4b44-9eca-b0f9f79791d5',
        c_file: {
          content: {
            source: 'buffer',
            buffer: Buffer.from('Legacy localization'),
            filename: 'legacy.txt',
            mime: 'text/plain'
          }
        },
        c_file_array: [{
          content: {
            source: 'buffer',
            buffer: Buffer.from('legacy array #0'),
            filename: 'legacy_array_0.txt',
            mime: 'text/plain'
          }
        }, {
          content: {
            source: 'buffer',
            buffer: Buffer.from('legacy array #1'),
            filename: 'legacy_array_1.txt',
            mime: 'text/plain'
          }
        }]
      }).locale('en_US').lean(false).execute()

      result.fileObject = Objects.i18n__file_localization_object.insertOne({
        c_key: 'ab231334-0479-4442-b356-03d5df784d17',
        c_file: {
          content: {
            source: 'buffer',
            buffer: Buffer.from('i18n single file initial value'),
            filename: 'initial_single.txt',
            mime: 'text/plain'
          }
        },
        c_file_array: [{
          content: {
            source: 'buffer',
            buffer: Buffer.from('i18n initialValue'),
            filename: 'initial1.txt',
            mime: 'text/plain'
          }
        }, {
          content: {
            source: 'buffer',
            buffer: Buffer.from('i18n initialValue #2'),
            filename: 'initial2.txt',
            mime: 'text/plain'
          }
        }, {
          content: {
            source: 'buffer',
            buffer: Buffer.from('i18n initialValue #3'),
            filename: 'initial3.txt',
            mime: 'text/plain'
          }
        }, {
          content: {
            source: 'buffer',
            buffer: Buffer.from('i18n initialValue #4'),
            filename: 'initial4.txt',
            mime: 'text/plain'
          }
        }]
      }).lean(false).execute()

      result.nonLocalizedFileObject = Objects.i18n__non_localized.insertOne({
        c_key: '3d51df39-fe30-4634-95fd-86bb4f0b22df',
        c_file: {
          content: {
            source: 'buffer',
            buffer: Buffer.from('This buffer is not localized'),
            filename: 'non_localized_file.txt',
            mime: 'text/plain'
          }
        },
        c_file_array: [{
          content: {
            source: 'buffer',
            buffer: Buffer.from('no localization array #0'),
            filename: 'non_localized_array_0.txt',
            mime: 'text/plain'
          }
        }, {
          content: {
            source: 'buffer',
            buffer: Buffer.from('no localization array #1'),
            filename: 'non_localized_array_1.txt',
            mime: 'text/plain'
          }
        }]
      }).lean(false).execute()

      // waiting for media-processor
      require('debug').sleep(4000)

      return result
    }))

    fileObject = ids.fileObject
    legacyFileObject = ids.legacyFileObject
    nonLocalizedFileObject = ids.nonLocalizedFileObject
  })

  after(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute()
        return global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
      })), { forceWorkerRun: true })
  })

  it('should return a translated file property', async function() {
    let promises = []
    const contents = {},
          result = await promised(null, sandboxed(function() {
            let result = {}
            const {
                    fileObjectId,
                    legacyFileObjectId,
                    nonLocalizedFileObjectId
                  } = global.script.arguments,
                  Objects = global.org.objects,
                  LocalizedObject = Objects.i18n__file_localization_object,
                  LegacyObject = Objects.i18n__legacy_file_localization_object,
                  NonLocalizedObject = Objects.i18n__non_localized

            result.nonLocalizedFile = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file`)
            result.nonLocalizedFileFacet = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file/content`)
            result.nonLocalizedFileArray = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file_array`)
            result.nonLocalizedFileArrayFacets = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file_array/content`)
            result.nonLocalizedFileArrayElement = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file_array/0`)
            result.nonLocalizedFileArrayElementFacet = NonLocalizedObject.find().pathRead(`${nonLocalizedFileObjectId}/c_file_array/0/content`)

            result.legacyFile = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file`)
            result.legacyFileFacet = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file/content`)
            result.legacyFileArray = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file_array`)
            result.legacyFileArrayFacets = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file_array/content`)
            result.legacyFileArrayElement = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file_array/1`)
            result.legacyFileArrayElementFacet = LegacyObject.find().pathRead(`${legacyFileObjectId}/c_file_array/1/content`)

            result.localizedFile = LocalizedObject.find().pathRead(`${fileObjectId}/c_file`)
            result.localizedFileFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file/content`)
            result.localizedFileArray = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array`)
            result.localizedFileArrayFacets = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/content`)
            result.localizedFileArrayElement = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2`)
            result.localizedFileArrayElementFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2/content`)

            global.script.locale = 'es_ES'

            result.spanishFile = LocalizedObject.find().pathRead(`${fileObjectId}/c_file`)
            result.spanishFileFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file/content`)
            result.spanishFileArray = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array`)
            result.spanishFileArrayFacets = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/content`)
            result.spanishFileArrayElement = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2`)
            result.spanishFileArrayElementFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2/content`)

            global.script.locale = 'en_GB'

            result.nonExistingLocaleFile = LocalizedObject.find().pathRead(`${fileObjectId}/c_file`)
            result.nonExistingLocaleFileFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file/content`)
            result.nonExistingLocaleFileArray = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array`)
            result.nonExistingLocaleFileArrayFacets = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/content`)
            result.nonExistingLocaleFileArrayElement = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2`)
            result.nonExistingLocaleFileArrayElementFacet = LocalizedObject.find().pathRead(`${fileObjectId}/c_file_array/2/content`)

            return result
          }, {
            runtimeArguments: {
              fileObjectId: fileObject._id,
              legacyFileObjectId: legacyFileObject._id,
              nonLocalizedFileObjectId: nonLocalizedFileObject._id
            }
          }))

    should.exist(result)
    result.should.containDeep({
      nonLocalizedFile: {
        creator: server.principals.admin._id,
        filename: 'non_localized_file.txt',
        mime: 'text/plain',
        size: 28,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__non_localizeds/${nonLocalizedFileObject._id}/c_file/content`,
        resource: 'i18n__non_localized.c_key(3d51df39-fe30-4634-95fd-86bb4f0b22df).c_file.content'
      },
      nonLocalizedFileFacet: {
        creator: server.principals.admin._id,
        filename: 'non_localized_file.txt',
        mime: 'text/plain',
        size: 28,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      nonLocalizedFileArray: [
        {
          creator: server.principals.admin._id,
          _id: nonLocalizedFileObject.c_file_array[0]._id,
          filename: 'non_localized_array_0.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__non_localizeds/${nonLocalizedFileObject._id}/c_file_array/${nonLocalizedFileObject.c_file_array[0]._id}/content`,
          resource: `i18n__non_localized.c_key(3d51df39-fe30-4634-95fd-86bb4f0b22df).c_file_array[]._id(${nonLocalizedFileObject.c_file_array[0]._id}).content`
        },
        {
          creator: server.principals.admin._id,
          _id: nonLocalizedFileObject.c_file_array[1]._id,
          filename: 'non_localized_array_1.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__non_localizeds/${nonLocalizedFileObject._id}/c_file_array/${nonLocalizedFileObject.c_file_array[1]._id}/content`,
          resource: `i18n__non_localized.c_key(3d51df39-fe30-4634-95fd-86bb4f0b22df).c_file_array[]._id(${nonLocalizedFileObject.c_file_array[1]._id}).content`
        }
      ],
      nonLocalizedFileArrayFacets: [
        {
          creator: server.principals.admin._id,
          filename: 'non_localized_array_0.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'non_localized_array_1.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        }
      ],
      nonLocalizedFileArrayElement: {
        creator: server.principals.admin._id,
        _id: nonLocalizedFileObject.c_file_array[0]._id,
        filename: 'non_localized_array_0.txt',
        mime: 'text/plain',
        size: 24,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__non_localizeds/${nonLocalizedFileObject._id}/c_file_array/${nonLocalizedFileObject.c_file_array[0]._id}/content`,
        resource: `i18n__non_localized.c_key(3d51df39-fe30-4634-95fd-86bb4f0b22df).c_file_array[]._id(${nonLocalizedFileObject.c_file_array[0]._id}).content`
      },
      nonLocalizedFileArrayElementFacet: {
        creator: server.principals.admin._id,
        filename: 'non_localized_array_0.txt',
        mime: 'text/plain',
        size: 24,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      legacyFile: {
        creator: server.principals.admin._id,
        locale: 'en_US',
        filename: 'legacy.txt',
        mime: 'text/plain',
        size: 19,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__legacy_file_localization_objects/${legacyFileObject._id}/c_file/content`,
        resource: 'i18n__legacy_file_localization_object.c_key(ab917317-bf4a-4b44-9eca-b0f9f79791d5).c_file.content'
      },
      legacyFileFacet: {
        creator: server.principals.admin._id,
        filename: 'legacy.txt',
        mime: 'text/plain',
        size: 19,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      legacyFileArray: [
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: legacyFileObject.c_file_array[0]._id,
          filename: 'legacy_array_0.txt',
          mime: 'text/plain',
          size: 15,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__legacy_file_localization_objects/${legacyFileObject._id}/c_file_array/content`,
          resource: 'i18n__legacy_file_localization_object.c_key(ab917317-bf4a-4b44-9eca-b0f9f79791d5).c_file_array[].content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: legacyFileObject.c_file_array[1]._id,
          filename: 'legacy_array_1.txt',
          mime: 'text/plain',
          size: 15,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__legacy_file_localization_objects/${legacyFileObject._id}/c_file_array/content`,
          resource: 'i18n__legacy_file_localization_object.c_key(ab917317-bf4a-4b44-9eca-b0f9f79791d5).c_file_array[].content'
        }
      ],
      legacyFileArrayFacets: [
        {
          creator: server.principals.admin._id,
          filename: 'legacy_array_0.txt',
          mime: 'text/plain',
          size: 15,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'legacy_array_1.txt',
          mime: 'text/plain',
          size: 15,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        }
      ],
      legacyFileArrayElement: {
        creator: server.principals.admin._id,
        locale: 'en_US',
        _id: legacyFileObject.c_file_array[1]._id,
        filename: 'legacy_array_1.txt',
        mime: 'text/plain',
        size: 15,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__legacy_file_localization_objects/${legacyFileObject._id}/c_file_array/content`,
        resource: 'i18n__legacy_file_localization_object.c_key(ab917317-bf4a-4b44-9eca-b0f9f79791d5).c_file_array[].content'
      },
      legacyFileArrayElementFacet: {
        creator: server.principals.admin._id,
        filename: 'legacy_array_1.txt',
        mime: 'text/plain',
        size: 15,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      localizedFile: {
        creator: server.principals.admin._id,
        locale: 'en_US',
        filename: 'single_file.txt',
        mime: 'text/plain',
        size: 35,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__file_localization_objects/${fileObject._id}/content`,
        resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
      },
      localizedFileFacet: {
        creator: server.principals.admin._id,
        filename: 'single_file.txt',
        mime: 'text/plain',
        size: 35,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      localizedFileArray: [
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: fileObject.c_file_array[0]._id,
          filename: 'asset_file_0.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: fileObject.c_file_array[1]._id,
          filename: 'asset_file_1.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: fileObject.c_file_array[2]._id,
          filename: 'asset_file_2.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'en_US',
          _id: fileObject.c_file_array[3]._id,
          filename: 'asset_file_3.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        }
      ],
      localizedFileArrayFacets: [
        {
          creator: server.principals.admin._id,
          filename: 'asset_file_0.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'asset_file_1.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'asset_file_2.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'asset_file_3.txt',
          mime: 'text/plain',
          size: 24,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        }
      ],
      localizedFileArrayElement: {
        creator: server.principals.admin._id,
        locale: 'en_US',
        _id: fileObject.c_file_array[2]._id,
        filename: 'asset_file_2.txt',
        mime: 'text/plain',
        size: 24,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__file_localization_objects/${fileObject._id}/content`,
        resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
      },
      localizedFileArrayElementFacet: {
        creator: server.principals.admin._id,
        filename: 'asset_file_2.txt',
        mime: 'text/plain',
        size: 24,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      spanishFile: {
        creator: server.principals.admin._id,
        locale: 'es_ES',
        filename: 'archivo_simple.txt',
        mime: 'text/plain',
        size: 33,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__file_localization_objects/${fileObject._id}/content`,
        resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
      },
      spanishFileFacet: {
        creator: server.principals.admin._id,
        filename: 'archivo_simple.txt',
        mime: 'text/plain',
        size: 33,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      spanishFileArray: [
        {
          creator: server.principals.admin._id,
          locale: 'es_ES',
          _id: fileObject.c_file_array[0]._id,
          filename: 'archivo_indice_0.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'es_ES',
          _id: fileObject.c_file_array[1]._id,
          filename: 'archivo_indice_1.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'es_ES',
          _id: fileObject.c_file_array[2]._id,
          filename: 'archivo_indice_2.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        },
        {
          creator: server.principals.admin._id,
          locale: 'es_ES',
          _id: fileObject.c_file_array[3]._id,
          filename: 'archivo_indice_3.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          path: `/i18n__file_localization_objects/${fileObject._id}/content`,
          resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
        }
      ],
      spanishFileArrayFacets: [
        {
          creator: server.principals.admin._id,
          filename: 'archivo_indice_0.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'archivo_indice_1.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'archivo_indice_2.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        },
        {
          creator: server.principals.admin._id,
          filename: 'archivo_indice_3.txt',
          mime: 'text/plain',
          size: 36,
          location: 4,
          storageId: 'medable',
          name: 'content',
          state: 2,
          object: 'facet'
        }
      ],
      spanishFileArrayElement: {
        creator: server.principals.admin._id,
        locale: 'es_ES',
        _id: fileObject.c_file_array[2]._id,
        filename: 'archivo_indice_2.txt',
        mime: 'text/plain',
        size: 36,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        path: `/i18n__file_localization_objects/${fileObject._id}/content`,
        resource: 'i18n__file_localization_object.c_key(ab231334-0479-4442-b356-03d5df784d17).content'
      },
      spanishFileArrayElementFacet: {
        creator: server.principals.admin._id,
        filename: 'archivo_indice_2.txt',
        mime: 'text/plain',
        size: 36,
        location: 4,
        storageId: 'medable',
        name: 'content',
        state: 2,
        object: 'facet'
      },
      nonExistingLocaleFile: null,
      nonExistingLocaleFileFacet: null,
      nonExistingLocaleFileArray: null,
      nonExistingLocaleFileArrayFacets: null,
      nonExistingLocaleFileArrayElement: null,
      nonExistingLocaleFileArrayElementFacet: null
    })

    Object.keys(result).filter(k => !!result[k]).forEach(k => {
      if (!isArray(result[k])) {
        promises.push(getBuffer(result[k].url).then(buffer => {
          contents[k] = buffer.toString()
        }))
      } else {
        contents[k] = []
        result[k].forEach((elem, i) => {
          promises.push(getBuffer(elem.url).then(buffer => {
            contents[k][i] = buffer.toString()
          }))
        })
      }
    })

    await Promise.all(promises)

    should.exist(contents)
    contents.should.deepEqual({
      nonLocalizedFile: 'This buffer is not localized',
      nonLocalizedFileFacet: 'This buffer is not localized',
      nonLocalizedFileArray: [
        'no localization array #0',
        'no localization array #1'
      ],
      nonLocalizedFileArrayFacets: [
        'no localization array #0',
        'no localization array #1'
      ],
      nonLocalizedFileArrayElement: 'no localization array #0',
      nonLocalizedFileArrayElementFacet: 'no localization array #0',
      legacyFile: 'Legacy localization',
      legacyFileFacet: 'Legacy localization',
      legacyFileArray: [
        'legacy array #0',
        'legacy array #1'
      ],
      legacyFileArrayFacets: [
        'legacy array #0',
        'legacy array #1'
      ],
      legacyFileArrayElement: 'legacy array #1',
      legacyFileArrayElementFacet: 'legacy array #1',
      localizedFile: 'single file contents (not an array)',
      localizedFileFacet: 'single file contents (not an array)',
      localizedFileArray: [
        'c_file_array contents #0',
        'c_file_array contents #1',
        'c_file_array contents #2',
        'c_file_array contents #3'
      ],
      localizedFileArrayFacets: [
        'c_file_array contents #0',
        'c_file_array contents #1',
        'c_file_array contents #2',
        'c_file_array contents #3'
      ],
      localizedFileArrayElement: 'c_file_array contents #2',
      localizedFileArrayElementFacet: 'c_file_array contents #2',
      spanishFile: 'Los contenidos del archivo simple',
      spanishFileFacet: 'Los contenidos del archivo simple',
      spanishFileArray: [
        'Contenido del arreglo de archivos #0',
        'Contenido del arreglo de archivos #1',
        'Contenido del arreglo de archivos #2',
        'Contenido del arreglo de archivos #3'
      ],
      spanishFileArrayFacets: [
        'Contenido del arreglo de archivos #0',
        'Contenido del arreglo de archivos #1',
        'Contenido del arreglo de archivos #2',
        'Contenido del arreglo de archivos #3'
      ],
      spanishFileArrayElement: 'Contenido del arreglo de archivos #2',
      spanishFileArrayElementFacet: 'Contenido del arreglo de archivos #2'
    })
  })

})
