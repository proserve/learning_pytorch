'use strict'

const sandboxed = require('../../lib/sandboxed'),
  server = require('../../lib/server'),
  should = require('should'),
  { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-1324 - App environment URLs', function() {

  before(async() => {

    // create app
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1324',
            label: 'c_ctxapi_1324',
            enabled: true,
            clients: [{
              label: 'c_ctxapi_1324',
              enabled: true,
              readOnly: false,
              sessions: true,
              allowNameMapping: true,
              urls: {
                connection: 'https://www.example.org/connection/$token',
                resetPassword: 'https://www.example.org/resetPassword/$token',
                createPassword: 'https://www.example.org/createPassword/$token',
                activateAccount: 'https://www.example.org/activateAccount/$token',
                verifyAccount: 'https://www.example.org/verifyAccount/$token'
              },
            }]
          }, {
            name: 'c_ctxapi_1324_defaults',
            label: 'c_ctxapi_1324_defaults',
            enabled: true,
            clients: [{
              label: 'c_ctxapi_1324_defaults',
              enabled: true,
              readOnly: false,
              sessions: true,
              allowNameMapping: true
            }]
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

  })

  after(async() => {

    // remove app
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $pull: {
          apps: ['c_ctxapi_1324', 'c_ctxapi_1324_defaults']
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

  })

  it('should produce/redirect to the correct app urls', async function() {
    const { org } = server,
          token = 'token',
          names = ['connection', 'resetPassword', 'createPassword', 'activateAccount', 'verifyAccount']
    
    for (const name of names) {
      org.generateEmailUrl(name, token, 'c_ctxapi_1324').should.equal(`https://www.example.org/${name}/${token}`)
    }

  })

  it('should produce/redirect to the correct default app urls', async function() {
    const { org } = server,
    token = 'token',
    names = ['connection', 'resetPassword', 'createPassword', 'activateAccount', 'verifyAccount']
    
    for (const name of names) {
        org.generateEmailUrl(name, token).should.not.equal(`https://www.example.org/${name}/${token}`, 'c_ctxapi_1324')
    }
  })

})