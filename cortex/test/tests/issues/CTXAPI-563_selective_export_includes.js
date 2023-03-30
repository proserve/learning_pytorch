'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-563 - Exporting objects should limit includes to selected properties', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.objects.insertOne({
      label: 'CTXAPI-563',
      name: 'c_ctxapi_563',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          label: 'ctx__prop',
          name: 'ctx__prop',
          type: 'String'
        },
        {
          label: 'c_prop',
          name: 'c_prop',
          type: 'String'
        }
      ]
    }).execute()

  }))

  it('Exporting object definition should only contain selected includes.', sandboxed(function() {

    /* global org */

    require('should')

    const { environment: { export: exportEnvironment } } = require('developer'),
          manifest = {
            object: 'manifest',
            objects: [{
              name: 'c_ctxapi_563',
              includes: ['label', '/^properties.ctx__/']
            }]
          },
          resource = exportEnvironment({ manifest }).toArray().find(v => v.resource === 'object.c_ctxapi_563')

    resource.properties.length.should.equal(1)
    resource.label.should.equal('CTXAPI-563')
    resource.object.should.equal('object')
    Object.keys(resource).length.should.equal(5) // resource, object, label, name (uniqueKey), properties

  }))

})
