const should = require('should'),
      async = require('async'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      sandboxed = require('../../lib/sandboxed'),
      ap = require('../../../lib/access-principal'),
      utils = require('../../../lib/utils'),
      { promised } = require('../../../lib/utils')

describe('Features', function() {

  describe('CTXAPI-140 Env Provision/Teardown', function() {

    let baseData = {}


    before(function(callback) {

      async.parallel({
        normal: callback => modules.authentication.createToken(
          new acl.AccessContext(server.principals.admin),
          server.principals.admin.email,
          server.sessionsClient.key, {
            scope: ['*']
          }, callback),

        privileged: callback => {
          modules.db.models.org.loadOrg(acl.BaseOrg, {}, (err, org) => {
            if (err) {
              return callback(err)
            }

            modules.authentication.createToken(new acl.AccessContext(ap.synthesizeOrgAdmin(org), null, { req: utils.createId() }),
              org.serviceAccounts[0]._id,
              org.apps[2].clients[0].key, {
                scope: 'admin',
                permanent: true,
                policy: [
                  { method: 'POST', path: '/sys/env' },
                  { method: 'DELETE', route: '/sys/env/(.*)' }
                ]
              }
              , (err, response) => callback(err, response))
          })
        },
        baseOrgAdmin: callback => {
          modules.db.models.org.loadOrg(acl.BaseOrg, {}, (err, org) => {
            callback(err, ap.synthesizeOrgAdmin(org, acl.SystemAdmin))
          })
        }

      }, (err, t) => {
        baseData = t
        callback(err)
      })

    })

    it('request should provision a new org', function(callback) {
      supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          'Authorization': `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: {
            code: 'test-gast-test3'
          },
          account: {
            email: 'gaston+15@medable.com',
            password: 'testMyPa$$word'
          }
        })
        .done(function(err, response) {
          should.not.exist(err)
          const keys = Object.keys(response.data)
          should.deepEqual(keys.sort(), ['account', 'org', 'token'])

          modules.db.models.org.findOne({ _id: response.data.org._id }, (err, org) => {
            should.not.exist(err)
            should.ok(org.configuration.ephemeral)
            callback()
          })
        })
    })

    it('request should teardown org', async() => {
      const provisionedOrg = await promised(null, sandboxed(function() {
        const env = require('env'),
              result = env.provision({
                org: {
                  code: 'test-gast-test4'
                },
                account: {
                  email: 'gaston+15@medable.com',
                  password: 'testMyPa$$word'
                }
              })
        return result.org
      }, baseData.baseOrgAdmin))

      await new Promise((resolve, reject) => {
        supertest(server.api.expressApp)
          .delete(`/medable/sys/env/${provisionedOrg.code}`)
          .set({
            'Authorization': `Bearer ${baseData.privileged.token}`
          })
          .done((err, response) => {
            try {
              should.not.exist(err)
              should.exist(response.data)

              const handler = (message, err) => {
                if (err) {
                  return reject(err)
                }
                if (message.worker === 'org-refresher') {
                  modules.db.models.org.findOne({ code: provisionedOrg.code }, (error, org) => {
                    should.not.exist(org)
                    should.not.exist(error)
                    server.events.removeListener('worker.done', handler)
                    return resolve()
                  })
                }
              }
              server.events.on('worker.done', handler)

            } catch (e) {
              reject(e)
            }
          })
      })
    })

    it('Org must be teardown by instance-reaper worker', function(callback) {
      supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          'Authorization': `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: {
            code: 'test-ephemeral-org',
            ttl: 300
          },
          account: {
            email: 'gaston+15@medable.com',
            password: 'testMyPa$$word'
          }
        })
        .done(function(err, response) {
          try {
            should.not.exist(err)
            should.exist(response.data)
            const handler = function(message, err, result) {
              if (message.worker === 'org-refresher') {
                modules.db.models.org.findOne({ _id: response.data.org._id }, (error, org) => {
                  should.not.exist(org)
                  should.not.exist(error)
                  server.events.removeListener('worker.done', handler)
                  return callback(err)
                })
              }
            }
            modules.workers.runNow('instance-reaper', () => {
              server.events.on('worker.done', handler)
            })

          } catch (e) {
            callback(e)
          }
        })
    })

    it('sandbox provision', function(done) {
      sandboxed(function() {
        require('should')
        const env = require('env'),
              result = env.provision({
                org: {
                  code: 'test-my-ephemeral-org'
                },
                account: {
                  email: 'gaston+15@medable.com',
                  password: 'testMyPa$$word'
                }
              })
        return result.org
      }, baseData.baseOrgAdmin)((err, org) => {
        if (err) {
          return done(err)
        }
        should.equal(org.code, 'test-my-ephemeral-org')
        should.equal(org.configuration.ephemeral, true)
        done()
      })
    })

    it('sandbox teardown', function(done) {
      sandboxed(function() {
        const env = require('env')
        env.provision({
          org: {
            code: 'test-my-ephemeral-org2'
          },
          account: {
            email: 'gaston+15@medable.com',
            password: 'testMyPa$$word'
          }
        })

        return env.teardown('test-my-ephemeral-org2')
      }, baseData.baseOrgAdmin)((err, result) => {
        if (err) {
          return done(err)
        }
        should.exist(result)
        const handler = function(message, err, result) {
          if (message.worker === 'org-refresher') {
            modules.db.models.org.findOne({ code: 'test-my-ephemeral-org2' }, (error, org) => {
              should.not.exist(org)
              should.not.exist(error)
              server.events.removeListener('worker.done', handler)
              return done(err)
            })
          }
        }
        server.events.on('worker.done', handler)
      })
    })

  })

})
