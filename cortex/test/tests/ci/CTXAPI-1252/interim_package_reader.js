'use strict'

/* global before */

const server = require('../../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      { version: cortexVersion } = require('../../../../package.json'),
      async = require('async'),
      modules = require('../../../../lib/modules'),
      _ = require('underscore'),
      utils = require('../../../../lib/utils'),
      acl = require('../../../../lib/acl'),
      ap = require('../../../../lib/access-principal'),
      { promised } = require('../../../../lib/utils'),
      sandboxed = require('../../../lib/sandboxed'),
      orgConfiguration = {
        deployment: {
          enabled: true,
          availability: 2,
          supportOnly: false,
          allowEdits: true
        },
        configuration: {
          accounts: {
            enableEmail: true,
            enableUsername: false,
            requireEmail: true,
            requireMobile: true,
            requireUsername: false
          },
          maxAccounts: 500000,
          maxApps: 20,
          allowAccountDeletion: true,
          allowWsJwtScopes: true,
          allowBufferSources: true,
          allowStreamingUploads: true,
          televisit: {
            availableRegions: [
              'gll',
              'au1',
              'br1',
              'de1',
              'ie1',
              'in1',
              'jp1',
              'sg1',
              'us1',
              'us2'
            ],
            defaultRegion: 'gll',
            enableRecording: true,
            maxConcurrentRooms: 1000,
            roomsEnabled: true
          },
          scripting: {
            configurationTriggers: true,
            allowBytecodeExecution: true,
            enableNonAccountNotifications: true,
            enableValidators: true,
            enableApiPolicies: true,
            enableViewTransforms: true,
            enableCustomSms: true,
            enableTimers: true,
            scriptsEnabled: true,
            types: {
              route: {
                timeoutMs: '90000'
              },
              trigger: {
                timeoutMs: '90000'
              },
              transform: {
                timeoutMs: '80000'
              }
            }
          },
          sms: {
            internalOverCustom: true,
            customOverInternal: true
          },
          axon: {
            enabled: true,
            exports: true,
            trials: true,
            apps: [
              { name: 'c_frontend_app', version: '1.0.0' },
              { name: 'c_another_frontend_app', version: '1.1.0', default: true }
            ]
          },
          researchEnabled: true,
          scriptablePasswordValidation: true,
          notification: {
            APNsConfig: {
              useToken: true
            }
          },
          reporting: {
            enabled: true
          }
        },
        registration: {
          bypassAccountVerification: true
        }
      }

let baseOrg = null,
    baseAdmin = null,
    baseOrgSessionClient = null,
    baseOrgAdminSession = null,
    ephemeralOrg = null

describe('CTXAPI-1252 - Interim package reader', function() {

  before(function(done) {
    async.waterfall([
      // get medable org session app client
      callback => {

        modules.db.models.org.findOne({ _id: acl.BaseOrg }, (err, org) => {
          if (err) return callback(err)
          baseOrg = org
          baseOrgSessionClient = org.apps[1].clients[0]
          baseAdmin = {
            email: 'fiachra+admin@medable.com',
            password: server.password,
            name: { first: 'System', last: 'Admin' },
            mobile: '+353868044914',
            roles: [acl.OrgAdminRole]
          }
          callback()
        })
      },
      // provision a new account for logging into medable
      callback => modules.accounts.provisionAccount(
        null,
        baseAdmin,
        baseOrg,
        'en_US',
        'verified',
        null,
        {
          skipSelfRegistrationCheck: true,
          skipActivation: true,
          isProvisioned: true,
          sendWelcomeEmail: false,
          allowDirectRoles: true
        }, err => {
          if (err) {
            if (err.code === 'kDuplicateKey' ||
              (err.code === 'kExists' && err.path === 'account.email') ||
              (err.code === 'kValidationError' && utils.array(err.faults).length === 1 && _.find(err.faults, f => f.path === 'account.email' && f.code === 'kExists'))
            ) {
              err = null
            }
          }
          callback(err)
        }
      ),
      // login the account
      callback => {
        const login = { email: baseAdmin.email, password: server.password },
              agent = supertest.agent(server.api.expressApp)
        agent
          .post('/medable/accounts/login')
          .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
          .send(login)
          .done((err) => {
            if (!err) {
              baseOrgAdminSession = agent
              callback()
            } else {
              modules.db.models.Callback.findOne({ handler: 'ver-location', target: baseAdmin.email }).lean().select({ token: 1 }).exec((err, ver) => {
                if (err) return callback(err)
                agent
                  .post('/medable/accounts/login')
                  .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
                  .send({ email: baseAdmin.email, password: server.password, location: { verificationToken: ver.token } })
                  .done((err) => {
                    baseOrgAdminSession = agent
                    callback(err)

                  })
              })
            }
          })
      }
    ], done)
  })

  before(async function() {
    const baseOrg = await modules.db.models.Org.loadOrg('medable'),
          principal = ap.synthesizeOrgAdmin(baseOrg)

    ephemeralOrg = await promised(null, sandboxed(function() {
      const env = require('env')

      return env.provision({
        org: {
          code: 'ctxapi_1252',
          name: 'ctxapi_1252',
          ttl: 1000 * 60 * 60 // one hour
        },
        account: {
          email: 'joaquin@medable.com',
          name: {
            first: 'Joaquin',
            last: 'Admin'
          }
        }
      })

    },
    {
      principal
    }))

    // Configure the new ephemeral org
    await baseOrgAdminSession
      .put(`/medable/sys/orgs/${ephemeralOrg.org._id}`)
      .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
      .send(orgConfiguration)
      .then()
  })

  // Create config keys for axon, ec, and tv. Create a study object and instance.
  before(async function() {
    const newOrg = await modules.db.models.Org.loadOrg('ctxapi_1252'),
          principal = ap.synthesizeOrgAdmin(newOrg)

    await promised(null, sandboxed(function() {
      const config = require('config'),
            { objects: { Objects, c_study: Study } } = global.org

      Objects.insertOne({
        name: 'c_study',
        label: 'Study',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        hasOwner: false,
        properties: [{
          name: 'c_name',
          label: 'Name',
          type: 'String',
          indexed: true,
          validators: [{
            name: 'required'
          }, {
            definition: {
              min: 0,
              max: 512
            },
            name: 'string'
          }]
        }]
      }).execute()

      Study.insertOne({
        c_name: 'CTXAPI-1252 Test Study'
      }).execute()

      config.set('axon__version', { version: '4.16.0' })
      config.set('ec__version', { version: '1.5.0' })
      config.set('tv__config', { version: '1.2.0' })
    },
    {
      principal
    }))
  })

  // Teardown the ephemeral org
  after(async function() {
    const baseOrg = await modules.db.models.Org.loadOrg('medable'),
          principal = ap.synthesizeOrgAdmin(baseOrg)

    ephemeralOrg = await promised(null, sandboxed(function() {
      const env = require('env')

      return env.teardown('ctxapi_1252')
    },
    {
      principal
    }))

  })

  it('should run interim package reader command', async function() {

    const result = await baseOrgAdminSession
      .post('/medable/sys/orgs/' + ephemeralOrg.org._id + '/commands/Interim Package Reader')
      .set({ 'Medable-Client-Key': baseOrgSessionClient.key })
      .then()

    should.exist(result)
    should.equal(result.status, 200)
    should.exist(result.body)
    result.body.should.be.eql({
      object: 'result',
      data: {
        name: 'ctxapi_1252',
        version: '-',
        dependencies: {
          axon: '1.5.0',
          c_another_frontend_app: '1.1.0',
          c_frontend_app: '1.0.0',
          cortex: utils.version(),
          study: '-',
          tv: '1.2.0'
        },
        packages: [
          {
            name: 'axon',
            description: 'Medable Axon',
            version: '4.16.0',
            configuration: {
              enabled: true,
              exports: true,
              trials: true,
              researchEnabled: true
            }
          },
          {
            name: 'axon-study',
            description: 'CTXAPI-1252 Test Study',
            version: '-'
          },
          {
            name: 'c_another_frontend_app',
            version: '1.1.0'
          },
          {
            name: 'c_frontend_app',
            version: '1.0.0'
          },
          {
            name: 'cortex',
            description: 'Medable Cortex',
            version: utils.version(),
            configuration: {
              state: 'enabled',
              deployment: {
                enabled: true,
                availability: 2,
                supportOnly: false
              },
              accounts: {
                enableEmail: true,
                enableUsername: false,
                requireEmail: true,
                requireMobile: true,
                requireUsername: false
              },
              allowWsJwtScopes: true,
              maxAccounts: 500000,
              maxApps: 20,
              reporting: {
                enabled: true
              },
              scripting: {
                scriptsEnabled: true,
                types: {
                  job: {
                    maxOps: 1000000000,
                    timeoutMs: 60000
                  },
                  route: {
                    maxOps: 1000000000,
                    timeoutMs: 90000
                  },
                  trigger: {
                    maxOps: 1000000000,
                    timeoutMs: 90000
                  },
                  deployment: {
                    maxOps: 1000000000,
                    timeoutMs: 60000
                  },
                  export: {
                    maxOps: 1000000000,
                    timeoutMs: 60000
                  },
                  policy: {
                    maxOps: 10000000,
                    timeoutMs: 1000
                  },
                  transform: {
                    maxOps: 10000000,
                    timeoutMs: 80000
                  }
                }
              },
              televisit: {
                availableRegions: [
                  'gll',
                  'au1',
                  'br1',
                  'de1',
                  'ie1',
                  'in1',
                  'jp1',
                  'sg1',
                  'us1',
                  'us2'
                ],
                defaultRegion: 'gll',
                enableRecording: true,
                maxConcurrentRooms: 1000,
                roomsEnabled: true
              },
              administrators: [
                {
                  locked: false,
                  roles: [
                    'administrator',
                    'developer',
                    'support'
                  ],
                  email: 'joaquin@medable.com'
                }
              ],
              apps: [
                'c_default_app'
              ],
              serviceAccounts: []
            }
          },
          {
            name: 'ec',
            description: 'Medable eConsent',
            version: '1.5.0'
          },
          {
            name: 'tv',
            description: 'Medable Televisit',
            version: '1.2.0'
          }
        ]
      }
    })

  })

})
