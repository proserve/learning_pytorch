'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      modules = require('../../../../lib/modules'),
      { isId, isValidDate, OBJECT_ID_REGEXP, createId, sleep } = require('../../../../lib/utils'),
      consts = require('../../../../lib/consts'),
      acl = require('../../../../lib/acl'),
      server = require('../../../lib/server'),
      ap = require('../../../../lib/access-principal'),
      async = require('async'),
      should = require('should'),
      supertest = require('supertest'),
      orgData = require('./orgData.json')

describe('Issues - CTXAPI-1275 - Env provision - TTL', function() {

  describe('Sandbox interface', function() {

    it('should provision an ephemeral org if TTL > 0', async() => {
      let result

      const medable = await modules.db.models.org.loadOrg('medable'),
            principal = await ap.synthesizeOrgAdmin(medable)

      result = await sandboxed(function() {
        /* global org */
        const { provision, teardown } = require('env'),
              provisionResult = provision({
                org: {
                  code: 'ctxapi1275m3dable',
                  name: 'ctxapi1275m3dable',
                  ttl: 1 // one ms
                },
                account: {
                  email: 'ephemeral.admin@example.com'
                }
              }),
              decodedToken = org.objects.accounts.decodeAuthToken(provisionResult.token),
              teardownResult = teardown('ctxapi1275m3dable')

        return { provisionResult, teardownResult, decodedToken }

      }, {
        principal
      })()

      should.exist(result)
      should.exist(result.decodedToken)
      result.decodedToken.should.containDeep({
        aud: 'https://api.local.medable.com/ctxapi1275m3dable/v2',
        'cortex/scp': [
          '*'
        ],
        'cortex/eml': 'principal@ctxapi1275m3dable'
      })
      isValidDate(result.provisionResult.org.configuration.ephemeralExpireAt).should.be.true()
      result.provisionResult.org.configuration.ephemeral.should.be.true()
      result.provisionResult.org.code.should.equal('ctxapi1275m3dable')
      result.provisionResult.org.name.should.equal('ctxapi1275m3dable')
      result.provisionResult.org.website.should.equal('https://app.local.medable.com/ctxapi1275m3dable/')
      result.provisionResult.org.runtime.build.org.should.equal('ctxapi1275m3dable')
      result.provisionResult.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })
      isId(result.teardownResult).should.be.true()

    })

    it('should provision a non ephemeral org when TTL is null', async() => {
      let result, teardownResult, fault

      const medable = await modules.db.models.org.loadOrg('medable'),
            principal = await ap.synthesizeOrgAdmin(medable)

      result = await sandboxed(function() {
        /* global org */
        const { provision } = require('env'),
              provisionResult = provision({
                org: {
                  ttl: null
                },
                account: {
                  email: 'ephemeral.admin@example.com'
                }
              }),
              decodedToken = org.objects.accounts.decodeAuthToken(provisionResult.token)

        return { provisionResult, decodedToken }

      }, {
        principal
      })()

      should.exist(result)
      should.exist(result.decodedToken)
      result.decodedToken.should.containDeep({
        aud: `https://api.local.medable.com/${result.provisionResult.org.code}/v2`,
        'cortex/scp': [
          '*'
        ],
        'cortex/eml': `principal@${result.provisionResult.org.code}`
      })
      should.not.exist(result.provisionResult.org.configuration.ephemeralExpireAt)
      result.provisionResult.org.configuration.ephemeral.should.be.false()
      result.provisionResult.org.website.should.equal(`https://app.local.medable.com/${result.provisionResult.org.code}/`)
      result.provisionResult.org.runtime.build.org.should.equal(result.provisionResult.org.code)
      result.provisionResult.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })

      try {
        teardownResult = await sandboxed(function() {
          /* global script */
          const { teardown } = require('env')

          return teardown(script.arguments.orgCode)

        }, {
          principal,
          runtimeArguments: {
            orgCode: result.provisionResult.org.code
          }
        })()
      } catch (e) {
        fault = e
      }

      should.not.exist(teardownResult)
      fault.should.containDeep({
        object: 'fault',
        name: 'api',
        code: 'kAccessDenied',
        errCode: 'cortex.accessDenied.feature',
        statusCode: 403,
        reason: 'This feature can be used to teardown ephemeral environments.',
        message: 'Feature not available.',
        trace: 'Error\n\tmain Script:4'
      })
    })

    it('should provision a non ephemeral org when TTL is not set', async() => {
      let result, teardownResult, fault

      const medable = await modules.db.models.org.loadOrg('medable'),
            principal = await ap.synthesizeOrgAdmin(medable)

      result = await sandboxed(function() {
        /* global org */
        const { provision } = require('env'),
              provisionResult = provision({
                org: { },
                account: {
                  email: 'ephemeral.admin@example.com'
                }
              }),
              decodedToken = org.objects.accounts.decodeAuthToken(provisionResult.token)

        return { provisionResult, decodedToken }

      }, {
        principal
      })()

      should.exist(result)
      should.exist(result.decodedToken)
      result.decodedToken.should.containDeep({
        aud: `https://api.local.medable.com/${result.provisionResult.org.code}/v2`,
        'cortex/scp': [
          '*'
        ],
        'cortex/eml': `principal@${result.provisionResult.org.code}`
      })
      should.not.exist(result.provisionResult.org.configuration.ephemeralExpireAt)
      result.provisionResult.org.configuration.ephemeral.should.be.false()
      result.provisionResult.org.website.should.equal(`https://app.local.medable.com/${result.provisionResult.org.code}/`)
      result.provisionResult.org.runtime.build.org.should.equal(result.provisionResult.org.code)
      result.provisionResult.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })

      try {
        teardownResult = await sandboxed(function() {
          /* global script */
          const { teardown } = require('env')

          return teardown(script.arguments.orgCode)

        }, {
          principal,
          runtimeArguments: {
            orgCode: result.provisionResult.org.code
          }
        })()
      } catch (e) {
        fault = e
      }

      should.not.exist(teardownResult)
      fault.should.containDeep({
        object: 'fault',
        name: 'api',
        code: 'kAccessDenied',
        errCode: 'cortex.accessDenied.feature',
        statusCode: 403,
        reason: 'This feature can be used to teardown ephemeral environments.',
        message: 'Feature not available.',
        trace: 'Error\n\tmain Script:4'
      })
    })

    it('should throw a validation error if TTL is not a number', async() => {
      let result, fault

      const medable = await modules.db.models.org.loadOrg('medable'),
            principal = await ap.synthesizeOrgAdmin(medable)

      try {
        result = await sandboxed(function() {
          /* global org */
          const { provision } = require('env'),
                provisionResult = provision({
                  org: {
                    ttl: 'tomorrow'
                  },
                  account: {
                    email: 'ephemeral.admin@example.com'
                  }
                }),
                decodedToken = org.objects.accounts.decodeAuthToken(provisionResult.token)

          return { provisionResult, decodedToken }

        }, {
          principal
        })()
      } catch (e) {
        fault = e
      }

      should.not.exist(result)
      fault.should.containDeep({
        object: 'fault',
        name: 'validation',
        code: 'kInvalidNumber',
        errCode: 'cortex.invalidArgument.invalidNumber',
        statusCode: 400,
        reason: 'TTL argument must be a number',
        message: 'Invalid number.',
        trace: 'Error\n\tmain Script:8'
      })
    })

  })

  describe('REST interface', function() {

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

            modules.authentication.createToken(new acl.AccessContext(ap.synthesizeOrgAdmin(org), null, { req: createId() }),
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

    it('should provision an ephemeral org if TTL > 0', async function() {
      let provision,
          teardown,
          organization = true,
          error = true,
          done = false

      provision = await supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          'Authorization': `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: {
            ttl: 1000 * 60 * 45 // 45 minutes
          },
          account: {
            email: 'ephemeral.admin@example.com'
          }
        })

      should.exist(provision)
      should.exist(provision.body.data.org.configuration.ephemeralExpireAt)
      provision.body.data.org.configuration.ephemeralExpireAt.should.be.String()
      Date.parse(provision.body.data.org.configuration.ephemeralExpireAt).should.be.greaterThan(Date.now())
      provision.body.data.org.configuration.ephemeral.should.be.true()
      provision.body.data.org.website.should.equal(`https://app.local.medable.com/${provision.body.data.org.code}/`)
      provision.body.data.org.runtime.build.org.should.equal(provision.body.data.org.code)
      provision.body.data.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })

      teardown = await new Promise((resolve, reject) => {
        supertest(server.api.expressApp)
          .delete(`/medable/sys/env/${provision.body.data.org.code}`)
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
                  modules.db.models.org.findOne({ code: provision.body.data.org.code }, (err, org) => {
                    organization = org
                    error = err
                    done = true
                    server.events.removeListener('worker.done', handler)
                    return resolve(response)
                  })
                }
              }
              server.events.on('worker.done', handler)

            } catch (e) {
              reject(e)
            }
          })
      })

      for (let i = 0; i < 30; i++) {
        await sleep(200)
        if (done) break
      }

      should.exist(teardown)
      should.not.exist(error)
      should.not.exist(organization)
      should.not.exist(teardown.errCode)
      should.equal(teardown.object, 'result')
      should.exist(teardown.data)
      OBJECT_ID_REGEXP.test(teardown.data).should.be.true()
    })

    it('should provision a non ephemeral org if TTL is null', async function() {
      let provision, teardown

      provision = await supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          Authorization: `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: {
            ttl: null
          },
          account: {
            email: 'ephemeral.admin@example.com'
          }
        })

      should.exist(provision)
      should.not.exist(provision.body.data.org.configuration.ephemeralExpireAt)
      provision.body.data.org.configuration.ephemeral.should.be.false()
      provision.body.data.org.website.should.equal(`https://app.local.medable.com/${provision.body.data.org.code}/`)
      provision.body.data.org.runtime.build.org.should.equal(provision.body.data.org.code)
      provision.body.data.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })

      teardown = await supertest(server.api.expressApp)
        .delete(`/medable/sys/env/${provision.body.data.org.code}`)
        .set({
          Authorization: `Bearer ${baseData.privileged.token}`
        })

      should.exist(teardown)
      should.exist(teardown.body)
      teardown.body.should.containDeep({
        object: 'fault',
        name: 'api',
        code: 'kAccessDenied',
        errCode: 'cortex.accessDenied.feature',
        status: 403,
        reason: 'This feature can be used to teardown ephemeral environments.',
        message: 'Feature not available.'
      })

    })

    it('should provision a non ephemeral org if TTL is not set', async function() {
      let provision, teardown

      provision = await supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          Authorization: `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: { },
          account: {
            email: 'ephemeral.admin@example.com'
          }
        })

      should.exist(provision)
      should.not.exist(provision.body.data.org.configuration.ephemeralExpireAt)
      provision.body.data.org.configuration.ephemeral.should.be.false()
      provision.body.data.org.website.should.equal(`https://app.local.medable.com/${provision.body.data.org.code}/`)
      provision.body.data.org.runtime.build.org.should.equal(provision.body.data.org.code)
      provision.body.data.should.containDeep({
        org: orgData,
        account: {
          object: 'account',
          access: 6,
          accessRoles: [
            consts.roles.admin,
            consts.roles.developer,
            consts.roles.support
          ],
          favorite: false,
          email: 'ephemeral.admin@example.com',
          name: {
            first: 'Environment',
            last: 'Administrator',
            additional: []
          },
          locale: 'en_US',
          state: 'unverified',
          locked: false,
          roles: [
            consts.roles.admin
          ],
          inherited_roles: [
            consts.roles.developer,
            consts.roles.support
          ],
          shared: false
        }
      })

      teardown = await supertest(server.api.expressApp)
        .delete(`/medable/sys/env/${provision.body.data.org.code}`)
        .set({
          Authorization: `Bearer ${baseData.privileged.token}`
        })

      should.exist(teardown)
      should.exist(teardown.body)
      teardown.body.should.containDeep({
        object: 'fault',
        name: 'api',
        code: 'kAccessDenied',
        errCode: 'cortex.accessDenied.feature',
        status: 403,
        reason: 'This feature can be used to teardown ephemeral environments.',
        message: 'Feature not available.'
      })

    })

    it('should throw a validation error if TTL is not a number', async function() {
      let provision

      provision = await supertest(server.api.expressApp)
        .post('/medable/sys/env')
        .set({
          Authorization: `Bearer ${baseData.privileged.token}`
        })
        .send({
          org: {
            ttl: 'tomorrow'
          },
          account: {
            email: 'ephemeral.admin@example.com'
          }
        })

      should.exist(provision)
      should.exist(provision.body)
      provision.body.should.containDeep({
        object: 'fault',
        name: 'validation',
        code: 'kInvalidNumber',
        errCode: 'cortex.invalidArgument.invalidNumber',
        status: 400,
        reason: 'TTL argument must be a number',
        message: 'Invalid number.'
      })

    })

  })

})
