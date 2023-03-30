const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      loadScript = require('../../lib/script.loader'),
      should = require('should')

describe('All modified paths are passed to trigger update.before', function() {
  let modifiedPaths

  before(async() => {
    /* global org, script */

    const triggerScript = loadScript('CTXAPI-1653_trigger_script.js')

    modifiedPaths = await promised(null, sandboxed(function() {
      const cache = require('cache')
      let instance

      org.objects.objects.insertOne({
        label: 'c_ctxapi_1653',
        name: 'c_ctxapi_1653',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [
          { name: 'c_string', label: 'A string', type: 'String', indexed: true },
          { name: 'c_number', label: 'Number', type: 'Number', indexed: true },
          { name: 'c_doc',
            label: 'Document',
            type: 'Document',
            properties: [
              {
                name: 'c_string',
                label: 'String',
                type: 'String'
              },
              {
                name: 'c_boolean',
                label: 'Boolean',
                type: 'Boolean'
              }
            ]
          },
          { name: 'c_doc_array',
            label: 'Document Array',
            type: 'Document',
            array: true,
            properties: [{
              name: 'c_string',
              label: 'String',
              type: 'String'
            }]
          }]
      }).execute()

      instance = org.objects.c_ctxapi_1653.insertOne({
        c_number: 4,
        c_string: 'stringA',
        c_doc: {
          c_string: 'string in doc',
          c_boolean: true
        },
        c_doc_array: [{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }]
      })
        .bypassCreateAcl()
        .grant('create')
        .lean(false)
        .execute()

      org.objects.scripts.insertOne({
        label: 'c_ctxapi_1653_trigger_lib',
        name: 'c_ctxapi_1653_trigger_lib',
        type: 'library',
        configuration: {
          export: 'c_ctxapi_1653_trigger_lib'
        },
        script: script.arguments.triggerScript
      }).execute()

      org.objects.c_ctxapi_1653.updateOne(
        { _id: instance._id },
        {
          $set: {
            c_number: 42,
            c_string: 'updated string',
            c_doc: {
              c_string: 'updated string',
              c_boolean: false
            },
            c_doc_array: [{
              _id: instance.c_doc_array[1]._id,
              c_string: 'second doc has been updated'
            }]
          }
        })
        .skipAcl()
        .grant('update')
        .lean(false)
        .execute()

      return cache.get('modifiedPaths')
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1653_trigger_lib' }).execute()
    org.objects.c_ctxapi_1653.deleteMany({}).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_1653' }).execute()
  }))

  it('includes paths to updated document arrays', async function() {
    modifiedPaths.should.have.property('c_doc_array')
    modifiedPaths.c_doc_array[0].c_string.should.equal('first_doc')
    modifiedPaths.c_doc_array[1].c_string.should.equal('second doc has been updated')
  })

  it('includes paths to other updated properties', async() => {
    modifiedPaths.c_string.should.equal('updated string')
    modifiedPaths.c_number.should.equal(42)
    modifiedPaths.c_doc.c_string.should.equal('updated string')
    modifiedPaths.c_doc.c_boolean.should.equal(false)
  })
})
