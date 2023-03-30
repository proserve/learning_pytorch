'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      sandboxed = require('../../lib/sandboxed')

describe('Features', function() {

  describe('CTXAPI-162', function() {

    // --------------------------------

    before(sandboxed(function() {

      /* global org, consts */

      org.objects.objects.insertOne({
        label: 'CTXAPI-162',
        name: 'c_ctxapi_162',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [{
          label: 'Request',
          name: 'c_request',
          type: 'Document',
          properties: [{
            label: 'c_script_before',
            name: 'c_script_before',
            type: 'String'
          }, {
            label: 'c_trigger_before',
            name: 'c_trigger_before',
            type: 'String'
          }, {
            label: 'c_trigger_after',
            name: 'c_trigger_after',
            type: 'String'
          }, {
            label: 'c_script_after',
            name: 'c_script_after',
            type: 'String'
          }]
        }, {
          label: 'Script',
          name: 'c_script',
          type: 'Document',
          properties: [{
            label: 'c_script_before',
            name: 'c_script_before',
            type: 'String'
          }, {
            label: 'c_trigger_before',
            name: 'c_trigger_before',
            type: 'String'
          }, {
            label: 'c_trigger_after',
            name: 'c_trigger_after',
            type: 'String'
          }, {
            label: 'c_script_after',
            name: 'c_script_after',
            type: 'String'
          }]
        }]
      }).execute()

      org.objects.script.insertOne({
        label: 'Script',
        name: 'c_ctxapi_162_trigger',
        type: 'trigger',
        script: `
          const request = require('request')
          script.context.update({
            c_request: {
              c_trigger_before: request.locale,
              c_trigger_after: request.locale = 'fr_CA'                        
            },            
            c_script: {
              c_trigger_before: script.locale,
              c_trigger_after: script.locale = 'fr_CA'                        
            }                       
          })          
        `,
        configuration: {
          object: 'c_ctxapi_162',
          event: 'create.before'
        }
      }).execute()

    }))

    after(sandboxed(function() {
      /* global org */
      org.objects.scripts.deleteOne({ name: 'c_ctxapi_162_trigger' }).execute()
      org.objects.objects.deleteOne({ name: 'c_ctxapi_162' }).execute()
    }))

    it('request should be global and script should only cascade to children.', function(callback) {

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set({
          ...server.getSessionHeaders(),
          'Accept-Language': 'en-GB'
        })
        .send({
          script: `
            const should = require('should'),
                  request = require('request'),
                  original = {
                    script: script.locale,
                    request: request.locale
                  },
                  _id = org.objects.c_ctxapi_162.insertOne({
                    c_request: {
                      c_script_before: request.locale = 'en_CA'
                    },
                    c_script: {
                      c_script_before: script.locale = 'en_CA'
                    }
                  }).execute(),
                  doc = org.objects.c_ctxapi_162.updateOne({
                    _id
                  }, {
                    $set: {
                      c_request: {
                        c_script_after: request.locale
                      },
                      c_script: {
                        c_script_after: script.locale
                      }
                    }
                  }).lean(false).execute()
            
            
            doc.c_request.c_script_before.should.equal('en_CA')
            doc.c_request.c_trigger_before.should.equal('en_CA')
            doc.c_request.c_trigger_after.should.equal('fr_CA')
            doc.c_request.c_script_after.should.equal('fr_CA')
            
            doc.c_script.c_script_before.should.equal('en_CA')
            doc.c_script.c_trigger_before.should.equal('en_CA')
            doc.c_script.c_trigger_after.should.equal('fr_CA')
            doc.c_script.c_script_after.should.equal('en_CA')                   
            
            original.request.should.equal('en_GB')
            original.script.should.equal('en_GB')
            
            request.locale.should.equal('fr_CA')
            script.locale.should.equal('en_CA')
              
          `
        })
        .done(function(err) {
          callback(err)
        })
    })

    it('script without a request should be okay', sandboxed(function() {

      const request = require('request'),
            locale = request.locale

      require('should')

      locale.should.be.a.String()
      request.locale = 'en_gb'
      request.locale.should.equal(locale)
      request.locale = 'fr_ca'
      request.locale.should.equal(locale)

    }))

    it('locales should be case-tolerant', sandboxed(function() {

      /* global script */

      require('should')
      script.locale = 'en_gb'
      script.locale.should.equal('en_GB')
      script.locale = 'fr_ca'
      script.locale.should.equal('fr_CA')

    }))

    it('Invalid locales should be ignored', sandboxed(function() {

      /* global script */

      require('should')

      script.locale = 'en_gb'
      script.locale.should.equal('en_GB')

      script.locale = 'not a thing'
      script.locale.should.equal('en_GB')
      script.locale = null
      script.locale.should.equal('en_GB')

    }))

  })

})
