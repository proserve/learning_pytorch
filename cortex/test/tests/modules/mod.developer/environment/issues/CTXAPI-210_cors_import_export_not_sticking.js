'use strict'

/* global before, after */

const { sandboxed } = require('../setup')

describe('Modules.Developer - CTXAPI-210 - App CORS import/export setting not maintained', function() {

  before(sandboxed(function() {

    const { import: importEnvironment } = require('developer').environment

    importEnvironment([
      {
        'authDuration': 900,
        'blacklist': [],
        'cors': ['*', 'https://api.test.medable.com/'],
        'csrf': false,
        'enabled': true,
        'expires': null,
        'expose': false,
        'label': 'App with CORS',
        'maxTokensPerPrincipal': 10,
        'name': 'c_ctxapi_210',
        'object': 'app',
        'readOnly': false,
        'sessions': true,
        'whitelist': []
      },
      {
        object: 'manifest',
        apps: {
          includes: ['c_ctxapi_210']
        }
      }
    ], {
      backup: false
    }).toArray() // exhaust cursor

  }))

  after(sandboxed(function() {

    /* global org */

    org.objects.org.updateOne(
      {},
      {
        $pull: {
          apps: ['c_ctxapi_210']
        }
      }).execute()

  }))

  it('Exported app has correct CORS entries', sandboxed(function() {

    const should = require('should'),
          { export: exportEnvironment } = require('developer').environment,
          app = exportEnvironment({
            manifest: {
              apps: {
                includes: ['c_ctxapi_210']
              }
            }
          }).filter(v => v.name === 'c_ctxapi_210')[0]

    should.equal(
      JSON.stringify(['*', 'https://api.test.medable.com/'].sort()),
      JSON.stringify(app.cors.sort())
    )

  }))

  it('Imported app has correct cors entries', sandboxed(function() {

    /* global org */

    const should = require('should'),
          app = org.read('apps').filter(v => v.name === 'c_ctxapi_210')[0]

    should.equal(
      JSON.stringify(['*', 'https://api.test.medable.com/'].sort()),
      JSON.stringify(app.clients[0].CORS.origins.sort())
    )

  }))

})
