'use strict'

const server = require('../../lib/server'),
      should = require('should')

describe('Rest Api', function() {

  describe('Templates', function() {

    describe('POST /templates/:type', function() {

      it('should create a custom email template', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/email'))
          .set(server.getSessionHeaders())
          .send({ name: 'custom', summary: 'custom', label: 'custom', partial: false })
          .done(callback)

      })

      it('should create a custom sms template', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/sms'))
          .set(server.getSessionHeaders())
          .send({ name: 'custom', summary: 'custom', label: 'custom', partial: false })
          .done(callback)

      })

      it('should create a custom push template', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/push'))
          .set(server.getSessionHeaders())
          .send({ name: 'custom', summary: 'custom', label: 'custom', partial: false })
          .done(callback)

      })

      it('should fail to create a custom invalid template', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/invalid'))
          .set(server.getSessionHeaders())
          .send({ name: 'custom', summary: 'custom', label: 'custom', partial: false })
          .done(function(err) {
            should.exist(err)
            should.equal(err.code, 'kInvalidArgument')
            callback()
          })

      })

    })

    describe('PUT /templates/:locale/:type/:name', function() {

      it('should update template content', function(callback) {

        server.sessions.admin
          .put(server.makeEndpoint('/templates/en_US/email/c_custom'))
          .set(server.getSessionHeaders())
          .send([{ 'name': 'subject', 'data': 'Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
          .done(callback)

      })

      it('should create a localization', function(callback) {

        server.sessions.admin
          .put(server.makeEndpoint('/templates/en_GB/email/c_custom'))
          .set(server.getSessionHeaders())
          .send([{ 'name': 'subject', 'data': 'GB Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
          .done(callback)

      })

      it('should fail to update a missing template', function(callback) {

        server.sessions.admin
          .put(server.makeEndpoint('/templates/en_US/email/c_not_a_template'))
          .set(server.getSessionHeaders())
          .send([{ 'name': 'subject', 'data': 'Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
          .done(function(err) {
            should.exist(err)
            should.equal(err.code, 'kNotFound')
            callback()
          })

      })
    })

    describe('GET /templates/:type?/:name?', function() {

      it('should list templates', function(callback) {

        server.sessions.admin
          .get(server.makeEndpoint('/templates/email/c_custom'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.exist(result.data.localizations)
            should.equal(result.data.localizations.length, 2)
            should.equal(result.data.name, 'c_custom')
            callback()
          })

      })
    })

    describe('GET /templates/:locale/:type/:name', function() {

      it('should load template content at version 0', function(callback) {

        server.sessions.admin
          .get(server.makeEndpoint('/templates/fr_CA/email/c_custom?fallback=true&version=0'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data.name, 'c_custom')
            should.equal(result.data.content[0].data, '') // empty active version 0 subject.
            callback()
          })

      })

      it('should load template content at version 1', function(callback) {

        server.sessions.admin
          .get(server.makeEndpoint('/templates/fr_CA/email/c_custom?fallback=true&version=1'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data.name, 'c_custom')
            should.equal(result.data.content[0].data, 'Subject') // empty version 0 subject.
            callback()
          })

      })
    })

    describe('POST /templates/:locale/:type/:name/:version', function() {

      it('should activate version 0', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/en_US/email/c_custom/0'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.exist(result.data)
            should.equal(result.data.activeVersion, 0)
            callback()
          })

      })

      it('should fail to activate missing version 2', function(callback) {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/en_US/email/c_custom/2'))
          .set(server.getSessionHeaders())
          .done(function(err) {
            should.exist(err)
            should.equal(err.code, 'kNotFound')
            callback()
          })

      })

    })

    describe('DELETE /templates/:locale/:type/:name/:version', function() {

      it('should delete the localization', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/templates/en_GB/email/c_custom'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.equal(result.data, true)
            callback()
          })

      })

      it('should delete version 1 of custom base locale template', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/templates/en_US/email/c_custom/1'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.equal(result.data, true)
            callback()
          })

      })

    })

    describe('DELETE /templates/:type/:name', function() {

      it('should delete the custom push template', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/templates/push/c_custom'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.equal(result.data, true)
            callback()
          })

      })

    })

  })

})
