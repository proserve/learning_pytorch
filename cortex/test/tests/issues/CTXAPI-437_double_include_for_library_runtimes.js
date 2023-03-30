'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should')

describe('Issues - CTXAPI-437 - double library includes', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.scripts.insertOne({
      label: 'c_ctxapi_437_a',
      name: 'c_ctxapi_437_a',
      type: 'library',
      configuration: {
        export: 'c_ctxapi_437_a'
      },
      script: `                  
          const { route } = require('decorators'),
                b = require('c_ctxapi_437_b')
          
          class LibraryA {
            
            @route('GET c_ctxapi_437_a')
            static route() {
              return b.test( LibraryA )
            }
          }
          module.exports = LibraryA
        `
    }).execute()

    org.objects.scripts.insertOne({
      label: 'c_ctxapi_437_b',
      name: 'c_ctxapi_437_b',
      type: 'library',
      configuration: {
        export: 'c_ctxapi_437_b'
      },
      script: `                  
        module.exports = {
          test( other ) {
            return other === require('c_ctxapi_437_a')
          }
      }
      `
    }).execute()

  }))

  it('should return the same instance when a runtime library is loaded and then require()\'d', function(callback) {

    server.sessions.admin
      .get('/test-org/routes/c_ctxapi_437_a')
      .set({ 'Medable-Client-Key': server.sessionsClient.key })
      .done(function(err, result) {
        should.not.exist(err)
        result.object.should.equal('result')
        result.data.should.be.true()
        callback()
      })

  })

})
