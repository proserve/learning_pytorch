'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should')

describe('Issues - CTXAPI-1522 - core object rerouting', function() {

    before(sandboxed(function(){

        /* global org */

        org.objects.scripts.insertOne({
            label: 'c_ctxapi_1522',
            name: 'c_ctxapi_1522',
            type: 'library',
            configuration: {
              export: 'c_ctxapi_1522'
            },
            script: `
                const { route } = require('decorators')

                class Patch {

                    @route('GET /orgs', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /accounts', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /audits', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /scripts', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /objects', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /views', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /deployments', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /exports', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /history', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /signatures', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /packages', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /rooms', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /roomevents', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /compositions', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                    @route('GET /events', {
                        system: true
                    })
                    static get() {
                        return true
                    }

                }

                module.exports = Patch
            `
        }).execute()
    }))

    after(sandboxed(function() {
        org.objects.scripts.deleteOne({ name: 'c_ctxapi_1522' }).execute()
    }))

    it('should return the modified /orgs route payload', function(done) {

        server.sessions.admin
            .get('/test-org/orgs')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /accounts route payload', function(done) {

        server.sessions.admin
            .get('/test-org/accounts')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /audits route payload', function(done) {

        server.sessions.admin
            .get('/test-org/audits')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /scripts route payload', function(done) {

        server.sessions.admin
            .get('/test-org/scripts')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /objects route payload', function(done) {

        server.sessions.admin
            .get('/test-org/objects')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /views route payload', function(done) {

        server.sessions.admin
            .get('/test-org/views')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /deployments route payload', function(done) {

        server.sessions.admin
            .get('/test-org/deployments')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /exports route payload', function(done) {

        server.sessions.admin
            .get('/test-org/exports')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /history route payload', function(done) {

        server.sessions.admin
            .get('/test-org/history')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /signatures route payload', function(done) {

        server.sessions.admin
            .get('/test-org/signatures')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /packages route payload', function(done) {

        server.sessions.admin
            .get('/test-org/packages')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /rooms route payload', function(done) {

        server.sessions.admin
            .get('/test-org/rooms')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /roomevents route payload', function(done) {

        server.sessions.admin
            .get('/test-org/roomevents')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /compositions route payload', function(done) {

        server.sessions.admin
            .get('/test-org/compositions')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

    it('should return the modified /events route payload', function(done) {

        server.sessions.admin
            .get('/test-org/events')
            .set({ 'Medable-Client-Key': server.sessionsClient.key })
            .done(function(err, result) {
                should.not.exist(err)
                should.exist(result)
                should.equal(result.data, true)
                done()
            })

    })

})
