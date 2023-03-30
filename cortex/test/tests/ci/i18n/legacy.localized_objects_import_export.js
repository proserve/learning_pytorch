const config = require('cortex-service/lib/config'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils')

describe('Features - CTXAPI-460 Localized Objects Import/Export', function() {

  before(async() => {
    config('debug')._instantReaping = config('debug').instantReaping
    config('debug').instantReaping = true
    config.flush()
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        localized: true, // has to be first
        label: 'CTXAPI-460',
        name: 'c_ctxapi_460',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [{
          label: 'My Label',
          name: 'c_my_label',
          type: 'String',
          indexed: true
        }],
        objectTypes: [
          { label: 'Type A',
            name: 'c_type_a',
            properties: [
              { label: 'Type A Prop', name: 'c_type_a', type: 'String' } // this will be indexed.
            ]
          },
          { label: 'Type B',
            name: 'c_type_b',
            properties: [
              { label: 'Type B Prop', name: 'c_type_a', type: 'Number' }
            ]
          }
        ]
      }).execute()

      org.objects.objects.updateOne({ name: 'c_ctxapi_460' }, {
        $set: {
          properties: [{
            name: 'c_my_label', label: 'Mi Etiqueta'
          }],
          objectTypes: [
            { label: 'Tipo A',
              name: 'c_type_a',
              properties: [
                { label: 'Tipo A Prop', name: 'c_type_a' }
              ]
            },
            { label: 'Tipo B',
              name: 'c_type_b',
              properties: [
                { label: 'Tipo B Prop', name: 'c_type_a' }
              ]
            }
          ]
        }
      }).locale('es_AR').execute()
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.objects.deleteOne({ name: 'c_ctxapi_460' }).execute()
    }))
    config('debug').instantReaping = config('debug')._instantReaping
    config.flush()
  })

  it('import / export objects and check locales', async() => {
    await promised(null, sandboxed(function() {
      const should = require('should'),
            docs = require('developer').environment.export({
              manifest: {
                objects: [{
                  name: 'c_ctxapi_460',
                  includes: ['*']
                }]
              }
            }).toArray()

      let doc = docs[0]

      should.exist(doc)
      should.exist(doc.locales)
      should.equal(doc.locales.properties.length, 1)
      should.equal(doc.locales.objectTypes.length, 2)
      should.equal(doc.locales.label[0].value, doc.label)
      should.equal(doc.locales.properties[0].label.length, 2)
      should.equal(doc.locales.properties[0].label[0].locale, 'en_US')
      should.equal(doc.locales.properties[0].label[0].value, 'My Label')
      should.equal(doc.locales.properties[0].label[1].locale, 'es_AR')
      should.equal(doc.locales.properties[0].label[1].value, 'Mi Etiqueta')
      should.equal(doc.locales.objectTypes[0].label[0].value, 'Type A')
      should.equal(doc.locales.objectTypes[0].label[1].value, 'Tipo A')
      should.equal(doc.locales.objectTypes[1].label[0].value, 'Type B')
      should.equal(doc.locales.objectTypes[1].label[1].value, 'Tipo B')

      // delete the object and wait a bit for reaping.
      org.objects.object.deleteOne({ name: 'c_ctxapi_460' }).execute()

      require('debug').sleep(1000)
      require('developer').environment.import(docs, { backup: false }).toArray()

      doc = org.objects.objects.find({ name: 'c_ctxapi_460' }).include('locales').next()

      should.exist(doc)
      should.exist(doc.locales)
      should.equal(doc.locales.properties.length, 1)
      should.equal(doc.locales.objectTypes.length, 2)
      should.equal(doc.locales.label[0].value, doc.label)
      should.equal(doc.locales.properties[0].label.length, 2)
      should.equal(doc.locales.properties[0].label[0].locale, 'en_US')
      should.equal(doc.locales.properties[0].label[0].value, 'My Label')
      should.equal(doc.locales.properties[0].label[1].locale, 'es_AR')
      should.equal(doc.locales.properties[0].label[1].value, 'Mi Etiqueta')
      should.equal(doc.locales.objectTypes[0].label[0].value, 'Type A')
      should.equal(doc.locales.objectTypes[0].label[1].value, 'Tipo A')
      should.equal(doc.locales.objectTypes[1].label[0].value, 'Type B')
      should.equal(doc.locales.objectTypes[1].label[1].value, 'Tipo B')

    }))

  })

})
