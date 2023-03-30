const should = require('should'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      waitUntilWorkerEnds = async() => {
        let done = false, err = null
        const testId = server.mochaCurrentTestUuid,
              handler = (message, e) => {
                if (message.mochaCurrentTestUuid === testId) {
                  if (message.worker === 'media-processor') {
                    done = true
                    err = e
                  }
                }
              }

        server.events.on('worker.done', handler)

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }
        server.events.removeListener('worker.done', handler)

        if (err) {
          throw err
        }
        return true
      },
      getObjects = async function() {
        const results = await promised(null, sandboxed(function() {

          const locales = org.objects.c_ctxapi_501_localized_file.find().include('locales').paths('locales').next(),
                es = org.objects.c_ctxapi_501_localized_file.find().locale('es_AR').next(),
                en = org.objects.c_ctxapi_501_localized_file.find().locale('en_US').next(),
                fallback = org.objects.c_ctxapi_501_localized_file.find().locale('fr_CA').next()

          return { locales, es, en, fallback }
        }))
        return results
      }

describe('Features - CTXAPI-501 Localized Files', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, consts */
      org.objects.objects.insertOne({
        label: 'CTXAPI_501 Localized File',
        name: 'c_ctxapi_501_localized_file',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        uniqueKey: 'c_key',
        properties: [{
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
          name: 'c_file_more_facets',
          label: 'c_file_more_facets',
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
          }, {
            allowUpload: true,
            label: 'Second Facet',
            maxFileSize: 10000000,
            mimes: ['*'],
            name: 'c_second_facet',
            passMimes: false,
            private: false,
            required: true,
            source: 'c_second_facet',
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
  })

  afterEach(sandboxed(function() {
    org.objects.c_ctxapi_501_localized_file.deleteMany({}).execute()
  }))

  beforeEach(sandboxed(function() {
    require('should')
    org.objects.c_ctxapi_501_localized_file.find().count().should.equal(0)
  }))

  it('check localized file properties', async() => {

    await promised(null, sandboxed(function() {
      /* global org, consts */
      /* eslint-disable node/no-deprecated-api */
      const _id = org.objects.c_ctxapi_501_localized_file.insertOne({
        c_file: {
          content: { buffer: new Buffer('This is text in english'), filename: 'english_c_file.bin' }
        },
        c_file_more_facets: {
          content: { buffer: new Buffer('This is another english text'), filename: 'english_facet_1.bin' },
          c_second_facet: { buffer: new Buffer('This is another english text'), filename: 'english_facet_2.bin' }
        },
        c_file_array: [{
          content: { buffer: new Buffer('This is text in english'), filename: 'english_c_file.bin' }
        }, {
          content: { buffer: new Buffer('This is a second file in english'), filename: 'english_c_file_2.bin' }
        }]
      }).locale('en_US').execute()

      org.objects.c_ctxapi_501_localized_file.updateOne({ _id }, {
        $set: {
          c_file: {
            content: { buffer: new Buffer('Este texto es en español'), filename: 'spanish_c_file.bin' }
          },
          c_file_more_facets: {
            content: { buffer: new Buffer('Este es otro texto en español'), filename: 'spanish_facet_1.bin' },
            c_second_facet: { buffer: new Buffer('Este es otro texto no el mismo en español'), filename: 'spanish_facet_2.bin' }
          },
          c_file_array: [{
            content: { buffer: new Buffer('Este texto es en español'), filename: 'spanish_c_file.bin' }
          }, {
            content: { buffer: new Buffer('Este es un segundo archivo en español'), filename: 'spanish_c_file_2.bin' }
          }]
        }
      }).locale('es_AR').execute()
    }))

    await waitUntilWorkerEnds()

    const results = await getObjects(),
          { locales, es, en, fallback } = results
    // check locales structure
    should.equal(locales.locales.c_file.length, 2)
    should.equal(locales.locales.c_file_array.length, 2)
    should.equal(locales.locales.c_file_array[0].locale, 'en_US')
    should.equal(locales.locales.c_file_array[0].value.length, 2)
    should.equal(locales.locales.c_file_array[1].locale, 'es_AR')
    should.equal(locales.locales.c_file_array[1].value.length, 2)
    should.equal(locales.locales.c_file_more_facets.length, 2)
    should.equal(locales.locales.c_file_more_facets[0].locale, 'en_US')
    should.equal(locales.locales.c_file_more_facets[1].locale, 'es_AR')
    should.equal(locales.locales.c_file_more_facets[0].value.facets.length, 1)
    should.equal(locales.locales.c_file_more_facets[1].value.facets.length, 1)

    // check facets with corresponding locales
    should.equal(es.c_file.locale, 'es_AR')
    should.equal(en.c_file.locale, 'en_US')
    should.equal(fallback.c_file.locale, 'en_US')
    should.equal(es.c_file.filename, 'spanish_c_file.bin')
    should.equal(en.c_file.filename, 'english_c_file.bin')
    should.equal(fallback.c_file.filename, 'english_c_file.bin')

    should.equal(en.c_file_array.length, 2)
    should.equal(en.c_file_array[0].locale, 'en_US')
    should.equal(en.c_file_array[1].locale, 'en_US')
    should.equal(en.c_file_array[0].filename, 'english_c_file.bin')
    should.equal(en.c_file_array[1].filename, 'english_c_file_2.bin')
    should.equal(es.c_file_array.length, 2)
    should.equal(es.c_file_array[0].locale, 'es_AR')
    should.equal(es.c_file_array[1].locale, 'es_AR')
    should.equal(es.c_file_array[0].filename, 'spanish_c_file.bin')
    should.equal(es.c_file_array[1].filename, 'spanish_c_file_2.bin')
    should.equal(fallback.c_file_array.length, 2)
    should.equal(fallback.c_file_array[0].locale, 'en_US')
    should.equal(fallback.c_file_array[1].locale, 'en_US')
    should.equal(fallback.c_file_array[0].filename, 'english_c_file.bin')
    should.equal(fallback.c_file_array[1].filename, 'english_c_file_2.bin')

    should.equal(en.c_file_more_facets.facets.length, 1)
    should.equal(en.c_file_more_facets.locale, 'en_US')
    should.equal(en.c_file_more_facets.filename, 'english_facet_1.bin')
    should.equal(en.c_file_more_facets.facets[0].filename, 'english_facet_2.bin')
    should.equal(es.c_file_more_facets.facets.length, 1)
    should.equal(es.c_file_more_facets.locale, 'es_AR')
    should.equal(es.c_file_more_facets.filename, 'spanish_facet_1.bin')
    should.equal(es.c_file_more_facets.facets[0].filename, 'spanish_facet_2.bin')
    should.equal(fallback.c_file_more_facets.facets.length, 1)
    should.equal(fallback.c_file_more_facets.locale, 'en_US')
    should.equal(fallback.c_file_more_facets.filename, 'english_facet_1.bin')
    should.equal(fallback.c_file_more_facets.facets[0].filename, 'english_facet_2.bin')

  })

  it('should export/import localized files', async() => {
    let exp, instance, insertedInstance

    insertedInstance = await promised(null, sandboxed(function() {
      /* global org, consts, script */
      /* eslint-disable node/no-deprecated-api */

      script.locale = 'en_US'
      return org.objects.c_ctxapi_501_localized_file.insertOne({
        c_file: {
          content: { buffer: new Buffer('This is text in english'), filename: 'english_c_file.bin' }
        },
        c_file_more_facets: {
          content: { buffer: new Buffer('This is another english text'), filename: 'english_facet_1.bin' },
          c_second_facet: { buffer: new Buffer('This is another english text'), filename: 'english_facet_2.bin' }
        },
        c_file_array: [{
          content: { buffer: new Buffer('This is text in english'), filename: 'english_c_file.bin' }
        }, {
          content: { buffer: new Buffer('This is a second file in english'), filename: 'english_c_file_2.bin' }
        }]
      }).execute()
    }))

    await waitUntilWorkerEnds()

    instance = await promised(null, sandboxed(function() {

      script.locale = 'es_AR'

      return org.objects.c_ctxapi_501_localized_file.updateOne({ _id: script.arguments.instanceId }, {
        $set: {
          c_file: {
            content: { buffer: new Buffer('Este texto es en español'), filename: 'spanish_c_file.bin' }
          },
          c_file_more_facets: {
            content: { buffer: new Buffer('Este es otro texto en español'), filename: 'spanish_facet_1.bin' },
            c_second_facet: { buffer: new Buffer('Este es otro texto no el mismo en español'), filename: 'spanish_facet_2.bin' }
          },
          c_file_array: [{
            content: { buffer: new Buffer('Este texto es en español'), filename: 'spanish_c_file.bin' }
          }, {
            content: { buffer: new Buffer('Este es un segundo archivo en español'), filename: 'spanish_c_file_2.bin' }
          }]
        }
      }).lean(false).execute()
    }, {
      runtimeArguments: {
        instanceId: insertedInstance
      }
    }))

    await waitUntilWorkerEnds()

    // This is awful, but I didn't find a clean way to wait for the files to be ready
    await promised(null, sandboxed(function() {
      let ready = false
      const debug = require('debug'),
            { c_ctxapi_501_localized_file: Model } = org.objects,
            locales = ['en_US', 'es_AR'],
            _id = script.arguments.insertedInstance

      locales.forEach(l => {
        script.locale = l

        while (1) {
          ready = Model.find().pathRead(`${_id}/c_file/state`) === 2 &&
            Model.find().pathRead(`${_id}/c_file_more_facets/state`) === 2 &&
            Model.find().pathRead(`${_id}/c_file_more_facets/facets/0/state`) === 2 &&
            Model.find().pathRead(`${_id}/c_file_array/0/state`) === 2 &&
            Model.find().pathRead(`${_id}/c_file_array/1/state`) === 2

          if (ready) {
            break
          }
          debug.sleep(250)
        }
      })

      return ready
    }, {
      runtimeArguments: {
        insertedInstance
      }
    }))

    exp = await promised(null, sandboxed(function() {
      const { environment } = require('developer'),
            { c_key: key } = script.arguments.instance,
            manifest = {
              manifest: {
                c_ctxapi_501_localized_file: {
                  includes: [ key ]
                }
              }
            }

      return environment.export(manifest).toArray()
    }, {
      runtimeArguments: {
        instance
      }
    }))

    should.exist(exp)
    should.equal(exp.length, 14)

    should.equal(exp[0].object, 'c_ctxapi_501_localized_file')
    should.equal(exp[0].locales.c_file.length, 2)

    should.equal(exp[0].locales.c_file[0].locale, 'en_US')
    should.equal(exp[0].locales.c_file[0].value.length, 1)
    should.equal(exp[0].locales.c_file[0].value[0].filename, 'english_c_file.bin')
    should.equal(exp[0].locales.c_file[0].value[0].name, 'content')

    should.equal(exp[0].locales.c_file[1].locale, 'es_AR')
    should.equal(exp[0].locales.c_file[1].value.length, 1)
    should.equal(exp[0].locales.c_file[1].value[0].filename, 'spanish_c_file.bin')
    should.equal(exp[0].locales.c_file[1].value[0].name, 'content')

    should.equal(exp[0].locales.c_file_array.length, 2)
    should.equal(exp[0].locales.c_file_array[0].locale, 'en_US')
    should.equal(exp[0].locales.c_file_array[0].value.length, 2)
    should.equal(exp[0].locales.c_file_array[0].value[0].length, 1)
    should.equal(exp[0].locales.c_file_array[0].value[0][0].filename, 'english_c_file.bin')
    should.equal(exp[0].locales.c_file_array[0].value[0][0].name, 'content')
    should.equal(exp[0].locales.c_file_array[0].value[1].length, 1)
    should.equal(exp[0].locales.c_file_array[0].value[1][0].filename, 'english_c_file_2.bin')
    should.equal(exp[0].locales.c_file_array[0].value[1][0].name, 'content')

    should.equal(exp[0].locales.c_file_array[1].locale, 'es_AR')
    should.equal(exp[0].locales.c_file_array[1].value.length, 2)
    should.equal(exp[0].locales.c_file_array[1].value[0].length, 1)
    should.equal(exp[0].locales.c_file_array[1].value[0][0].filename, 'spanish_c_file.bin')
    should.equal(exp[0].locales.c_file_array[1].value[0][0].name, 'content')
    should.equal(exp[0].locales.c_file_array[1].value[1].length, 1)
    should.equal(exp[0].locales.c_file_array[1].value[1][0].filename, 'spanish_c_file_2.bin')
    should.equal(exp[0].locales.c_file_array[1].value[1][0].name, 'content')

    should.equal(exp[0].locales.c_file_more_facets.length, 2)

    should.equal(exp[0].locales.c_file_more_facets[0].locale, 'en_US')
    should.equal(exp[0].locales.c_file_more_facets[0].value.length, 2)
    should.equal(exp[0].locales.c_file_more_facets[0].value[0].filename, 'english_facet_2.bin')
    should.equal(exp[0].locales.c_file_more_facets[0].value[0].name, 'c_second_facet')
    should.equal(exp[0].locales.c_file_more_facets[0].value[1].filename, 'english_facet_1.bin')
    should.equal(exp[0].locales.c_file_more_facets[0].value[1].name, 'content')

    should.equal(exp[0].locales.c_file_more_facets[1].locale, 'es_AR')
    should.equal(exp[0].locales.c_file_more_facets[1].value.length, 2)
    should.equal(exp[0].locales.c_file_more_facets[1].value[0].filename, 'spanish_facet_2.bin')
    should.equal(exp[0].locales.c_file_more_facets[1].value[0].name, 'c_second_facet')
    should.equal(exp[0].locales.c_file_more_facets[1].value[1].filename, 'spanish_facet_1.bin')
    should.equal(exp[0].locales.c_file_more_facets[1].value[1].name, 'content')
  })
})
