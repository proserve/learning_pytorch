'use strict'

/* global before */

const should = require('should'),
      async = require('async'),
      sandboxed = require('../../lib/sandboxed')

let baseOrgData = null,
    newOrg = null

describe('Modules', function() {

  describe('Migration', function() {

    before(function(done) {
      async.series([
        callback => {
          require('../../lib/create.medable.admin')('fiachra+migrator@medable.com', (err, result) => {
            if (!err) {
              baseOrgData = result
            }
            callback(err)
          })

        },
        callback => {
          // create a new org to deploy to
          require('../../lib/create.org')('New Deployment Org', 'newish-deployment-org', (err, result) => {
            if (!err) {
              newOrg = result
            }
            callback(err)
          })

        },
        callback => {
          require('../../lib/create.deployment.items')(newOrg, err => {
            callback(err)
          })
        }
      ], done)

    })

    it('should list migration commands', function(done) {

      sandboxed(function() {

        require('should')

        const migration = require('migration'),
              commands = migration.listCommands()

        commands.length.should.be.above(9)

        return true

      }, baseOrgData.admin)((err) => {
        done(err)
      })
    })

    it('should create a migration for all objects', function(done) {

      const code = function() {
              const migration = require('migration')
              return migration.moveAll('<ORGID>', 0)
            },
            codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}{([\s\S]*)}$/, '$1').trim().replace('<ORGID>', newOrg.org._id),
            script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      baseOrgData.session
        .post('/medable/sys/script_runner')
        .set(baseOrgData.getHeaders())
        .send(script)
        .done(function(err) {

          should.not.exist(err)
          done()
        })

    })

    it('should start Migration', function(done) {

      sandboxed(function() {

        require('should')

        const migration = require('migration'),
              result = migration.start()

        result.should.be.ok()

        return true

      }, baseOrgData.admin)((err) => {
        done(err)
      })
    })

    it('should list migrations', function(done) {

      sandboxed(function() {
        const migration = require('migration')
        return migration.status()
      }, baseOrgData.admin)((err) => {
        done(err)
      })
    })

    it('should cancel all migrations', function(done) {

      const code = function() {
              const migration = require('migration')
              return migration.cancelAll('<ORGID>')
            }, codeStr = code.toString()
              .replace(/^function[\s]{0,}\(\)[\s]{0,}{([\s\S]*)}$/, '$1').trim()
              .replace('<ORGID>', newOrg.org._id),
            script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

      baseOrgData.session
        .post('/medable/sys/script_runner')
        .set(baseOrgData.getHeaders())
        .send(script)
        .done(function(err) {
          should.not.exist(err)
          done()
        })

    })

    it('should clear all migration history', function(done) {

      sandboxed(function() {
        const migration = require('migration')
        return migration.clearHistory()
      }, baseOrgData.admin)((err) => {
        done(err)
      })
    })

  })
})
