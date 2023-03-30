'use strict'

const config = require('cortex-service/lib/config'),
      async = require('async'),
      utils = require('../../lib/utils'),
      EventEmitter = require('events').EventEmitter,
      modules = require('../../lib/modules'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      ap = require('../../lib/access-principal'),
      acl = require('../../lib/acl'),
      uuid = require('uuid'),
      supertest = require('supertest'),
      consts = require('../../lib/consts')

// extend supertest
;(function() {
  const end = supertest.Test.prototype.end
  supertest.Test.prototype.done = function(callback) {
    end.call(this, function(err, result) {
      callback(Fault.from(err || utils.path(result, 'body')), utils.path(result, 'body'), result)
    })
  }
}())

class TestServer {

  constructor() {

    this.__mocha_test_uuid__ = uuid.v1()

    this.events = new EventEmitter()
    this.api = null
    this.signingClient = null
    this.sessionsClient = null
    this.org = null
    this.principals = {
      admin: null,
      provider: null,
      patient: null
    }
    this.password = 'one two three four five six'
    this.sessions = {
      admin: null,
      provider: null,
      patient: null
    }

  }

  get usingMedia() {
    return this.__media
  }

  set usingMedia(v) {
    this.__media = Boolean(v)
  }

  makeEndpoint(path) {
    return '/' + this.org.code + path
  }

  getSessionHeaders(options) {
    options = utils.extend({
      key: this.sessionsClient.key,
      csrf: null
    }, options)
    let headers = {
      'Medable-Client-Key': options.key
    }
    if (options.csrf) {
      headers['Medable-Csrf-Token'] = options.csrf
    }
    return headers
  }

  getSignedHeaders(command, method, options) {

    options = utils.extend({
      timestamp: Date.now(),
      nonce: modules.authentication.genAlphaNumString(16),
      key: this.signingClient.key,
      secret: this.signingClient.secret,
      principal: null
    }, options)

    options.signature = options.signature || modules.authentication.signRequest(command, (method || 'GET').toUpperCase(), options.key + options.secret, options.timestamp)

    let headers = {
      'Medable-Client-Key': options.key,
      'Medable-Client-Signature': options.signature,
      'Medable-Client-Timestamp': options.timestamp,
      'Medable-Client-Nonce': options.nonce
    }

    if (options.principal) {
      headers['Medable-Client-Account'] = options.principal
    }

    return headers
  }

  /**
     * @param callback
     */
  setup() {

    let api

    return new Promise((resolve, reject) => {
      async.waterfall([

        // run application, starting fresh with a new db.
        callback => {

          const ServiceClass = require('../../lib/classes/api-service'),
                dbStart = modules.db.start

          api = this.api = new ServiceClass()

          process.on('SIGINT', () => {
            logger.info('initiating exit from SIGINT')
            api.exit()
          })
          process.on('SIGTERM', () => {
            logger.info('initiating exit from SIGTERM')
            api.exit()
          })
          modules.db.start = callback => {
            dbStart.call(modules.db, err => {
              if (err) return callback(err)
              this.clean()
                .then(() => callback())
                .catch(callback)
            })
          }

          api.expressApp = api.svc.httpApp
          api.expressApp.use((req, res, next) => {
            this.events.emit('request', req, res)
            next()
          })
          api.start(err => {
            if (err) {
              logger.error(`${config('name')} service startup error.`, utils.toJSON(err, { stack: true }))
              return callback(err)
            }
            logger.info(`${config('name')} service started.`)
            callback()
          })

        },

        // create the org provisioning app in the base org, so that we can provision the test org through the api.
        (callback) => {

          modules.db.models.org.findOne({ _id: acl.BaseOrg }, (err, org) => {
            void err
            let principal = ap.synthesizeOrgAdmin(org, acl.SystemAdmin),
                payload = {
                  serviceAccounts: [
                    {
                      'label': 'Provisioning SA',
                      'name': 'c_provisioning_sa',
                      'locked': false,
                      'roles': [
                        consts.roles.admin
                      ]
                    }
                  ],
                  apps: [{
                    label: 'Org Provisioner',
                    enabled: true,
                    clients: [{
                      label: 'Org Provisioner',
                      allowUnsigned: false,
                      enabled: true,
                      readOnly: false,
                      sessions: false
                    }]
                  }, {
                    label: 'Org Session App',
                    enabled: true,
                    clients: [{
                      label: 'Org Session App',
                      enabled: true,
                      readOnly: false,
                      sessions: true,
                      csrf: false
                    }]
                  }, {
                    label: 'Token App',
                    enabled: true,
                    clients: [{
                      label: 'Token App',
                      enabled: true,
                      readOnly: false,
                      sessions: false,
                      csrf: false,
                      rsa: {
                        regenerate: true
                      }
                    }]
                  }]
                },
                options = {
                  method: 'post'
                }

            modules.db.models.org.aclUpdate(principal, acl.BaseOrg, payload, options, (err, { ac }) => {

              callback(err, utils.path(ac, 'subject.apps.0.clients.0'))

            })
          })

        },

        // create initial org and user account
        (provisioner, callback) => {

          let payload = {
                org: {
                  code: 'test-org',
                  name: 'Test Unit Organization',
                  state: 'enabled'
                },
                account: {
                  name: {
                    first: 'Test',
                    last: 'Administrator'
                  },
                  email: 'james+admin@medable.com',
                  mobile: '16049892489'
                }
              },
              timestamp = Date.now()

          supertest(api.expressApp)
            .post('/medable/sys/orgs/provision')
            .set({
              'Medable-Client-Key': provisioner.key,
              'Medable-Client-Signature': modules.authentication.signRequest('/sys/orgs/provision', 'POST', provisioner.key + provisioner.secret, timestamp),
              'Medable-Client-Timestamp': timestamp,
              'Medable-Client-Nonce': modules.authentication.genAlphaNumString(16),
              'Accept': 'application/json'
            })
            .send(payload)
            .done(callback)

        },

        // ensure scripts are enabled, registration is active, etc.
        (result, response, callback) => {

          modules.db.models.Org.updateOne({ _id: result.data.org._id }, {
            $inc: {
              sequence: 1
            },
            $set: {
              'configuration.scripting.scriptsEnabled': true,
              'configuration.scripting.enableTimers': true,
              'configuration.scripting.enableApiPolicies': true,
              'configuration.scripting.maxJobRunsPerDay': 1000,
              'configuration.legacyObjects': true,
              'configuration.allowAccountDeletion': true,
              'configuration.allowOrgRefresh': true,
              'configuration.allowBufferSources': true,
              'configuration.allowStreamingUploads': true,
              'registration.allow': true,
              'registration.invitationRequired': false,
              'registration.activationRequired': false,
              'deployment.enabled': true,
              'deployment.supportOnly': false,
              'deployment.availability': 2
            }
          }, err => {
            callback(err, result, response)
          })
        },

        // ensure admin account is verified.
        (result, response, callback) => {

          modules.db.models.Account.updateOne({ _id: result.data.account._id }, {
            $set: {
              state: 'verified'
            }
          }, err => {
            callback(err, result, response)
          })
        },

        // load the org and account.
        (result, response, callback) => {

          modules.db.models.Org.findOne({ _id: result.data.org._id }, (err, model) => {
            if (err) {
              return callback(err)
            }
            this.org = model

            ap.create(this.org, result.data.account._id, (err, principal) => {
              if (!err) {
                this.principals.admin = principal
              }
              callback(err)
            })
          })

        },

        // create apps in the new org.
        (callback) => {

          let payload = [{
            label: 'Test Unit Signed App',
            name: 'c_test_unit_signed_app',
            enabled: true,
            clients: [{
              label: 'Test Unit Signed App',
              allowUnsigned: false,
              enabled: true,
              principalId: '000000000000000000000001',
              principalOverride: true,
              readOnly: false,
              sessions: false
            }]
          }, {
            label: 'Test Unit Session App',
            name: 'c_test_unit_session_app',
            enabled: true,
            clients: [{
              label: 'Test Unit Session App',
              enabled: true,
              readOnly: false,
              sessions: true,
              csrf: false,
              rsa: {
                regenerate: true
              }
            }]
          }]

          modules.db.models.Org.aclUpdatePath(this.principals.admin, this.org._id, 'apps', payload, { method: 'post' }, (err, { ac }) => {

            if (!err) {
              this.signingClient = ac.subject.apps[0].clients[0]
              this.sessionsClient = ac.subject.apps[1].clients[0]
            }
            callback(err)

          })

        },

        // reset the password using the password token.
        (callback) => {

          modules.db.models.Callback.findOne({ targetId: this.principals.admin._id, org: this.org._id }).exec((err, cb) => {

            if (!err && !cb) {
              err = Fault.create('kNotFound', { reason: 'pass-reset token not found.' })
            }
            if (err) {
              return callback(err)
            }

            supertest(api.expressApp)
              .post(this.makeEndpoint('/accounts/reset-password'))
              .set(this.getSessionHeaders())
              .send({
                password: this.password,
                token: cb.token
              })
              .done(callback)

          })

        },

        // attempt to login as the administrator.
        (result, response, callback) => {

          let agent = supertest.agent(api.expressApp)
          agent
            .post(this.makeEndpoint('/accounts/login'))
            .set(this.getSessionHeaders())
            .send({ email: this.principals.admin.email, password: this.password })
            .done((err) => {
              if (!err) {
                this.sessions.admin = agent
                return callback()
              }
              modules.db.models.Callback.findOne({ handler: 'ver-location', target: this.principals.admin.email }).lean().select({ token: 1 }).exec((err, ver) => {
                void err
                agent
                  .post(this.makeEndpoint('/accounts/login'))
                  .set(this.getSessionHeaders())
                  .send({ email: this.principals.admin.email, password: this.password, location: { verificationToken: ver.token } })
                  .done((err) => {
                    this.sessions.admin = agent
                    callback(err)

                  })
              })
            })
        },

        // provision and login a provider account.
        (callback) => {

          let payload = {
                name: {
                  first: 'Test',
                  last: 'Provider'
                },
                email: 'james+provider@medable.com',
                mobile: '16049892489',
                password: this.password,
                roles: [acl.OrgProviderRole]
              },
              options = {
                skipActivation: true,
                sendWelcomeEmail: false
              }

          modules.accounts.provisionAccount(this.principals.admin, payload, this.principals.admin.org, 'en_US', 'verified', null, options, (err) => {
            if (err) callback(err)
            else {
              let agent = supertest.agent(api.expressApp)
              agent.post(this.makeEndpoint('/accounts/login'))
                .set(this.getSessionHeaders())
                .send({ email: 'james+provider@medable.com', password: this.password })
                .done((err) => {
                  if (!err) {
                    this.sessions.provider = agent
                    ap.create(this.org, 'james+provider@medable.com', (err, principal) => {
                      this.principals.provider = principal
                      callback(err)
                    })
                    return
                  }
                  modules.db.models.Callback.findOne({ handler: 'ver-location', target: 'james+provider@medable.com' }).lean().select({ token: 1 }).exec((err, ver) => {
                    void err
                    agent
                      .post(this.makeEndpoint('/accounts/login'))
                      .set(this.getSessionHeaders())
                      .send({ email: 'james+provider@medable.com', password: this.password, location: { verificationToken: ver.token } })
                      .done((err) => {
                        if (err) callback(err)
                        else {
                          this.sessions.provider = agent
                          ap.create(this.org, 'james+provider@medable.com', (err, principal) => {
                            this.principals.provider = principal
                            callback(err)
                          })
                        }
                      })
                  })
                })
            }
          })

        },

        // provision and login a patient account
        (callback) => {

          let payload = {
                name: {
                  first: 'Test',
                  last: 'patient'
                },
                email: 'james+patient@medable.com',
                mobile: '16049892489',
                password: this.password
              },
              options = {
                skipActivation: true,
                sendWelcomeEmail: false
              }

          modules.accounts.provisionAccount(this.principals.admin, payload, this.principals.admin.org, 'en_US', 'verified', null, options, (err) => {
            if (err) callback(err)
            else {
              let agent = supertest.agent(api.expressApp)
              agent.post(this.makeEndpoint('/accounts/login'))
                .set(this.getSessionHeaders())
                .send({ email: 'james+patient@medable.com', password: this.password })
                .done((err) => {
                  if (!err) {
                    this.sessions.patient = agent
                    ap.create(this.org, 'james+patient@medable.com', (err, principal) => {
                      this.principals.patient = principal
                      callback(err)
                    })
                    return
                  }
                  modules.db.models.Callback.findOne({ handler: 'ver-location', target: 'james+patient@medable.com' }).lean().select({ token: 1 }).exec((err, ver) => {
                    void err
                    agent
                      .post(this.makeEndpoint('/accounts/login'))
                      .set(this.getSessionHeaders())
                      .send({ email: 'james+patient@medable.com', password: this.password, location: { verificationToken: ver.token } })
                      .done((err) => {
                        if (err) callback(err)
                        else {
                          this.sessions.patient = agent
                          ap.create(this.org, 'james+patient@medable.com', (err, principal) => {
                            this.principals.patient = principal
                            callback(err)
                          })
                        }
                      })
                  })
                })
            }
          })

        },

        // provision and login an unverified account
        (callback) => {

          let payload = {
                name: {
                  first: 'Test',
                  last: 'Unverified'
                },
                email: 'james+unverified@medable.com',
                mobile: '16049892489',
                password: this.password
              },
              options = {
                skipActivation: true,
                sendWelcomeEmail: false
              }

          modules.accounts.provisionAccount(this.principals.admin, payload, this.principals.admin.org, 'en_US', 'unverified', null, options, (err) => {
            if (err) callback(err)
            else {
              let agent = supertest.agent(api.expressApp)
              agent.post(this.makeEndpoint('/accounts/login'))
                .set(this.getSessionHeaders())
                .send({ email: 'james+unverified@medable.com', password: this.password })
                .done((err) => {
                  if (!err) {
                    this.sessions.unverified = agent
                    ap.create(this.org, 'james+unverified@medable.com', (err, principal) => {
                      this.principals.unverified = principal
                      callback(err)
                    })
                    return
                  }
                  modules.db.models.Callback.findOne({ handler: 'ver-location', target: 'james+unverified@medable.com' }).lean().select({ token: 1 }).exec((err, ver) => {
                    void err
                    agent
                      .post(this.makeEndpoint('/accounts/login'))
                      .set(this.getSessionHeaders())
                      .send({ email: 'james+unverified@medable.com', password: this.password, location: { verificationToken: ver.token } })
                      .done((err) => {
                        if (err) callback(err)
                        else {
                          this.sessions.unverified = agent
                          ap.create(this.org, 'james+unverified@medable.com', (err, principal) => {
                            this.principals.unverified = principal
                            callback(err)
                          })
                        }
                      })
                  })
                })
            }
          })

        },

        (callback) => {
          this.updateOrg(callback)
        },

        (callback) => {
          if (!this.usingMedia) {
            return callback()
          }
          require('./create.streamable.js')(new acl.AccessContext(this.principals.admin), err => callback(err))
        },

        (callback) => {
          if (this.usingMedia) {
            require('./create.postable')(new acl.AccessContext(this.principals.admin))
              .catch(e => {
                void e
              })
              .then(result => {
                void result
              })
          }
          callback()

        },

        (callback) => {
          require('./sandboxed')(function() {
            return 'ready!'
          })(callback)
        }

      ], err => {
        if (err) {
          console.log('startup error', utils.toJSON(err))
          reject(err)
        } else {
          resolve('Test server is up!')
        }
      })
    })

  }

  updateOrg(callback) {
    if (!(this.org && this.principals.admin && this.principals.provider && this.principals.patient && this.principals.unverified)) {
      return callback()
    }
    const Org = modules.db.models.Org
    Org.loadOrg(this.org._id, { cached: true }, (err, org) => {
      if (!err) {
        this.org = org
        this.principals.admin._org =
                    this.principals.provider._org =
                        this.principals.patient._org =
                            this.principals.unverified._org = org
      }
      callback(err)
    })
  }

  teardown() {

    return new Promise((resolve, reject) => {
      if (this.api) {
        logger.info('initiating exit from teardown')
        this.api.exit(err => {
          logger.error('Error on test server teardown', err)
        })
        this.api = null
        resolve('Test server teared down successfully')
      } else {
        reject(new Error('Test server teardown: No API instance was found'))
      }
    })
  }

  async clean() {

    if (!this.api) throw new Error('No Application!')
    let models = modules.db.mongoose.models

    for (const key of Object.keys(models)) {
      const collection = models[key].collection

      let isCapped = false
      try {
        isCapped = await collection.isCapped()
      } catch (e) {
        void e
      }
      if (!isCapped) {
        await collection.deleteMany({})
      }
    }

  }

}

exports = module.exports = new TestServer()
