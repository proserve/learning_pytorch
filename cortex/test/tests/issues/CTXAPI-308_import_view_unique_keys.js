'use strict'

/* global before, after */

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-308 - Import view with unique keys.', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.objects.insertOne({
      label: 'CTXAPI-308',
      name: 'c_ctxapi_308',
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
        }
      ]
    }).execute()

  }))

  afterEach(sandboxed(function() {
    org.objects.View.deleteOne({ name: 'c_ctxapi_308' }).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_308' }).execute()
  }))

  it('Export with query property, then import a view multiple times.', sandboxed(function() {

    require('should')

    const { environment: { import: importEnvironment, export: exportEnvironment } } = require('developer'),
          viewName = 'c_ctxapi_308',
          manifest = {
            object: 'manifest',
            views: {
              includes: [
                viewName
              ]
            }
          }

    org.objects.View.insertOne({
      label: 'CTXAPI-308',
      name: viewName,
      sourceObject: 'c_ctxapi_308',
      query: [{
        name: 'sort',
        value: JSON.stringify({
          created: -1
        })
      }]
    }).execute()

    let array = exportEnvironment({ manifest }).toArray()

    importEnvironment(array, { manifest, backup: false }).toArray()
    importEnvironment(array, { manifest, backup: false }).toArray()

  }))

  it('should merge an imported view with a similar query to the existing one', sandboxed(function() {

    /* global script */

    let array, view, exportedView
    const { environment: { import: importEnvironment, export: exportEnvironment } } = require('developer'),
          should = require('should'),
          viewName = 'c_ctxapi_308',
          manifest = {
            object: 'manifest',
            views: {
              includes: [
                viewName
              ]
            }
          }

    org.objects.View.insertOne({
      label: 'CTXAPI-308',
      name: viewName,
      sourceObject: 'c_ctxapi_308',
      query: [{
        name: 'sort',
        value: JSON.stringify({
          created: -1
        })
      }]
    }).execute()

    array = exportEnvironment({ manifest }).toArray()

    should.equal(array.filter(exp => exp.object === 'view').length, 1)
    exportedView = array.filter(exp => exp.object === 'view')[0]

    exportedView.query[0].name = 'where'
    exportedView.query[0].value = {
      'creator._id': script.principal._id
    }

    importEnvironment(array, { manifest, backup: false }).toArray()

    view = org.objects.views.find({ name: viewName }).next()
    should.exist(view.query)
    view.query.length.should.equal(2)

    view.query[0].name.should.equal('sort')
    view.query[0].value.should.equal(JSON.stringify({ created: -1 }))
    view.query[1].name.should.equal('where')
    view.query[1].value.should.equal(JSON.stringify({
      'creator._id': script.principal._id
    }))
  }))
})
