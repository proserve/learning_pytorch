'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-452 - Object runtime dependencies', function() {

  it('should not be able to create an @object runtime with a missing object.', sandboxed(function() {

    /* global org */

    const { tryCatch } = require('util.values'),
          pathTo = require('util.paths.to')

    tryCatch(
      () => org.objects.scripts.insertOne({
        label: 'c_ctxapi_452',
        name: 'c_ctxapi_452',
        type: 'library',
        configuration: {
          export: 'c_ctxapi_452'
        },
        script: `
          const { object } = require('decorators')        
          @object('c_ctxapi_452')
          class c_ctxapi_353 extends CortexObject {
            findOne(match) {
              return this.find(match).limit(1).next()
            }
          }
        `
      }).execute(),
      err => {
        if (!(pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
          pathTo(err, 'faults.0.errCode') === 'cortex.invalidArgument.object' &&
          pathTo(err, 'faults.0.resource') === 'script#type(library).name(c_ctxapi_452).@object 2:10.resources')) {
          throw new Error('expecting validation error for missing object')
        }
      }
    )

  }))

})
