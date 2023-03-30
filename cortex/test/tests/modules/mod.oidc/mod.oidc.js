/* eslint-disable one-var */
'use strict'

const assert = require('assert'),
      { promised, sleep } = require('../../../../lib/utils'),
      modules = require('../../../../lib/modules'),
      server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      wellKnown = require('./fixtures/well-known.json'),
      nock = require('nock'),
      { generateKeyPairSync } = require('crypto'),
      jose = require('jose'),
      sinon = require('sinon').createSandbox(),
      supertest = require('supertest'),
      jwt = require('jsonwebtoken'),
      testUtils = require('../../../lib/utils')()

describe('Modules', function() {
  describe('OIDC', async function() {

    let issuer = wellKnown.issuer,
        options = {
          issuer,
          clientId: 'some-id',
          clientSecret: 'some-secret'
        },

        defaults = {
          tokenEndpoint: {
            attributes: {
              access_token: 'SlAV32hkKG',
              token_type: 'Bearer',
              expires_in: 3600
            },
            payload: {
              email: 'ala.hawash@medable.com',
              email_verified: true,
              preferred_username: 'ala.hawash',
              iss: wellKnown.issuer,
              sub: 'example-oauth2|948727201843',
              aud: options.clientId,
              exp: Date.now() + 3600,
              iat: Date.now()
            },
            body: {
              grant_type: 'authorization_code',
              code: 'SplxlOBeZQQYbYS6WxSbIA',
              redirect_uri: 'https://api.local.medable.com/medable/v2/sso/oidc/cb',
              code_verifier: 'randomCode'
            }
          }
        },
        { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 4096 })

    function assertAuthorizationUrl(value, extraAssertions = {}, authorizeEndpoint = wellKnown.authorization_endpoint) {
      const url = new URL(value),
            parameters = url.searchParams,
            expectedParams = ['response_type', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'scope', 'state']

      assert.strictEqual(url.origin + url.pathname, authorizeEndpoint)

      expectedParams.forEach(p => {
        assert(parameters.has(p), `Missing parameter '${p}' in authorizatuion url, ${parameters}`)
      })

      assert.strictEqual(parameters.get('response_type'), 'code')
      assert.strictEqual(parameters.get('code_challenge_method'), 'S256')

      for (let [param, expectedValue] of Object.entries(extraAssertions)) {
        assert.strictEqual(parameters.get(param), expectedValue)
      }
    }

    async function nockTokenEndpoint(payload = {}, body = {}, wellKnownConfig = wellKnown) {
      let jwk = await jose.exportJWK(publicKey)

      // mock token endpoint to return the id_token with the given payload. The token is signed using the a private key.
      nock(wellKnownConfig.token_endpoint).post('', Object.assign({}, defaults.tokenEndpoint.body, body)).reply(200, {
        ...defaults.tokenEndpoint.attributes,
        id_token: jwt.sign(Object.assign({}, defaults.tokenEndpoint.payload, payload), privateKey, { algorithm: 'RS256' })
      })

      // mock the jwk_uri to return the public key in jwk format
      nock(wellKnownConfig.jwks_uri).get('').reply(200, {
        keys: [jwk]
      })
    }

    before(() => {
      nock(issuer).persist().get('/.well-known/openid-configuration').reply(200, wellKnown)
    })

    after(() => {
      nock.cleanAll()
    })

    describe('findIdp', () => {
      before(async() => {
        await promised(modules.db.models.idp, 'aclCreate', server.principals.admin, {
          name: 'okta-test',
          label: 'OKTA Test',
          type: 'oidc',
          ...options
        })
        await promised(modules.db.models.idp, 'aclCreate', server.principals.admin, {
          name: 'another-idp',
          label: 'And Another One',
          type: 'oidc',
          ...options
        })
      })

      after(async() => {
        await promised(modules.db.models.idp, 'aclDeleteMany', server.principals.admin, {
          type: 'oidc'
        })
      })

      it('should fetch IDP config by name', async() => {
        const idp = await modules.oidc.findIdp(server.org, 'okta-test')

        assert.strictEqual(idp.name, 'okta-test')
      })

      it('should fetch IDP config by uuid', async() => {
        const { uuid } = await promised(modules.db.models.idp, 'aclReadOne', server.principals.admin, null, { where: { name: 'okta-test' }, override: true, allowNullSubject: true }),
              idp = await modules.oidc.findIdp(server.org, uuid)

        assert.strictEqual(idp.name, 'okta-test')
      })

      it('should fetch the first entry if no identifier provided', async() => {
        const idp = await modules.oidc.findIdp(server.org)

        assert.strictEqual(idp.name, 'okta-test')
      })

      it('should throw an error if not found', async() => {
        await assert.rejects(
          modules.oidc.findIdp(server.org, 'not-a-real-idp'),
          {
            name: 'db',
            errCode: 'cortex.notFound.instance'
          }
        )
      })
    })

    describe('getAuthorizationUrl', () => {

      let defaults = {
        req: {
          orgCode: 'test-org',
          session: {},
          query: {
            idp: 'idp-name'
          }
        }
      }

      it('Should throw an error for invalid issuers', async() => {
        const invalidIssuer = 'https://invalid-issuer.com'

        nock(invalidIssuer).get('/.well-known/openid-configuration').reply(404)

        await assert.rejects(
          modules.oidc.getAuthorizationUrl({}, {
            issuer: invalidIssuer,
            clientId: 'clientId',
            clientSecret: 'secret'
          }),
          Error
        )

      })

      it('Should throw an error for missing client_id', async() => {
        await assert.rejects(
          modules.oidc.getAuthorizationUrl({}, {
            issuer
          }),
          {
            name: 'TypeError',
            message: `client_id is required`
          }
        )
      })

      it('Should save verification parameters in the current session', async() => {
        const req = Object.assign({}, defaults.req, { query: { return_to: 'https://www.example.com' } }),
              authorizationParams = [{
                key: 'max_age',
                value: 900
              }],
              url = await modules.oidc.getAuthorizationUrl(req, { authorizationParams, ...options }),
              checks = ['maxAge', 'codeVerifier', 'state', 'returnTo']

        for (let param of checks) {
          assert(req.session.oidc[param], `${param} is not set`)

        }
        assertAuthorizationUrl(url)

      })

      it('Should successfully return authorization url', async() => {
        const req = Object.assign({}, defaults.req),
              url = await modules.oidc.getAuthorizationUrl(req, options)

        assertAuthorizationUrl(url)
      })

      it('Should allow adding extra authroization parameters', async() => {
        const req = Object.assign({}, defaults.req),
              extraParams = [{
                key: 'custom_param',
                value: 'abc'
              }, {
                key: 'param2',
                value: 'efg'
              }],
              url = await modules.oidc.getAuthorizationUrl(req, Object.assign({}, options, { authorizationParams: extraParams }))

        assertAuthorizationUrl(url, { custom_param: 'abc', param2: 'efg' })
      })

      it('Should add prompt=login on forceAuthn', async() => {
        const req = Object.assign({}, defaults.req),
              url = await modules.oidc.getAuthorizationUrl(req, Object.assign({}, options, { forceAuthn: true }))

        assertAuthorizationUrl(url, { prompt: 'login' })
      })

      it('Should add prompt=login if max_age is 0', async() => {
        const req = Object.assign({}, defaults.req),
              url = await modules.oidc.getAuthorizationUrl(req, Object.assign({}, options, { authorizationParams: [{ key: 'max_age', value: '0' }] }))

        assertAuthorizationUrl(url, { prompt: 'login' })
      })
    })

    describe('callback', () => {
      // mock express request object
      function getMockRequest(input = '', options = {}) {
        let url = new URL(input),
            defaults = {
              orgCode: 'test-org',
              session: {},
              method: 'GET',
              params: {
                idp: 'idp-name'
              },
              query: Object.fromEntries(url.searchParams),
              url: url.toString()
            }
        return Object.assign({}, defaults, options)
      }

      it('Should throw an error for invalid issuers', async() => {
        const invalidIssuer = 'https://invalid-issuer.com'

        nock(invalidIssuer).get('/.well-known/openid-configuration').reply(404)

        await assert.rejects(
          modules.oidc.callback({}, {
            issuer: invalidIssuer,
            client_id: 'client_id',
            client_secret: 'secret'
          }),
          Error
        )

      })

      it('Should throw an error for missing client_id', async() => {
        await assert.rejects(
          modules.oidc.callback({}, {
            issuer
          }),
          {
            name: 'TypeError',
            message: `client_id is required`
          }
        )
      })

      it('Should always check for state', async() => {
        const state = '1234',
              req = getMockRequest(`https://api.medable.com/callback?code=456`),
              promise = modules.oidc.callback(req, { ...options, state })

        await assert.rejects(promise, {
          name: 'fault',
          message: 'state missing from the response'
        })
      })

      it('Should throw an error on error response during authorization', async() => {
        const state = '1234',
              error = 'oauth_error',
              errorDescription = 'An error occured',
              req = getMockRequest(`https://api.medable.com/callback?error=${error}&error_description=${errorDescription}&state=${state}`),
              promise = modules.oidc.callback(req, { ...options, state })

        await assert.rejects(promise, {
          name: 'fault',
          errCode: `cortex.oidc.${error}`
        })
      })

      it('Should successfully do a callback with proper checks', async() => {
        nockTokenEndpoint()

        const { code, code_verifier } = defaults.tokenEndpoint.body,
              state = 'af0ifjsldkj',
              req = getMockRequest(`https://api.medable.com/callback?state=${state}&code=${code}`),
              identity = await modules.oidc.callback(req, { ...options, state, codeVerifier: code_verifier })

        assert.strictEqual(identity.email, 'ala.hawash@medable.com')

      })

      it('Should throw an error if access token does not include email or username claim', async() => {
        nockTokenEndpoint({ email: undefined, preferred_username: undefined })

        const { code, code_verifier } = defaults.tokenEndpoint.body,
              state = 'af0ifjsldkj',
              req = getMockRequest(`https://api.medable.com/callback?state=${state}&code=${code}`),
              promsie = modules.oidc.callback(req, { ...options, state, codeVerifier: code_verifier })

        await assert.rejects(promsie, {
          name: 'fault',
          errCode: `cortex.oidc.missing_claims`
        })
      })
    })

    describe('API', async function() {

      describe('Web', async function() {

        const idpConfig = {
          'name': 'auth0-test',
          'label': 'Auth0',
          'type': 'oidc',
          'issuer': 'https://dev-0vx2tz4s.us.auth0.com',
          'clientId': '0NJPzTWkWIBQWtnhn74kKvqZMBhoDA21',
          'clientSecret': 'lsd6zB62g4qm9TL9d66WBO_dvUPsxLRpP_plVOJOZIk6HDX_Vv_CSkjoa-CCRe19',
          'authorizationParams': [
            {
              'key': 'scope',
              'value': 'openid email'
            },
            {
              'key': 'organization',
              'value': 'org_qt08OIs7MhsO6BP0'
            }
          ]
        }

        async function mockSsoLogin(claims, { agent, params = {} } = {}) {
          agent = agent || supertest.agent(server.api.expressApp)
          let searchParams = new URLSearchParams(params)

          // mock identity token
          sinon.stub(modules.oidc, 'callback').resolves(claims)

          // get state for callback
          let response = await agent.get(server.makeEndpoint(`/sso/oidc/login?${searchParams.toString()}`))
                .expect(302),
              authorizationUrl = new URL(response.headers.location),
              state = authorizationUrl.searchParams.get('state'),

              // load and log in account from identity token
              result = await agent.get(server.makeEndpoint(`/sso/oidc/callback?state=${state}`))

          sinon.restore()

          return result
        }

        before(sandboxed(function() {
          /* global script, org */
          org.objects.idps.insertOne(script.arguments.idpConfig).execute()
          org.update('configuration.loginMethods', ['sso', 'credentials'])
        }, {
          runtimeArguments: {
            idpConfig
          }
        }))

        after(sandboxed(function() {
          org.objects.idps.deleteMany().skipAcl().grant(8).execute()
          org.update('configuration.loginMethods', ['credentials'])
        }))

        it('Should successfully redirect to Authorization server', async function() {
          const agent = supertest.agent(server.api.expressApp)
          return agent.get(server.makeEndpoint('/sso/oidc/login'))
            .expect(302)
            .then(response => {
              assertAuthorizationUrl(response.headers.location, {}, 'https://dev-0vx2tz4s.us.auth0.com/authorize')
            })
        })

        it('Should return 403 when SSO is not enabled', async function() {
          const agent = supertest.agent(server.api.expressApp)

          await promised(null, sandboxed(function() {
            org.update('configuration.loginMethods', ['credentials'])
          }))

          await agent.get(server.makeEndpoint('/sso/oidc/login')).expect(403)
          await agent.get(server.makeEndpoint('/sso/oidc/callback')).expect(403)
          await agent.get(server.makeEndpoint('/sso/oidc/native/callback')).expect(403)

          // set org's loginMethods back to default
          await promised(null, sandboxed(function() {
            org.update('configuration.loginMethods', ['sso', 'credentials'])
          }))
        })

        it('Should add error details to return urls on callback error', async function() {
          sinon.stub(modules.oidc, 'callback').rejects(new Error('Callback error occured'))

          const agent = supertest.agent(server.api.expressApp),
                response = await agent.get(server.makeEndpoint('/sso/oidc/login?return_to=https://www.example.com'))
                  .expect(302)
                  .then(response => {
                    assertAuthorizationUrl(response.headers.location, {}, 'https://dev-0vx2tz4s.us.auth0.com/authorize')
                    return response
                  }),
                authorizationUrl = new URL(response.headers.location),
                state = authorizationUrl.searchParams.get('state')

          let callbackResponse = await agent.get(server.makeEndpoint(`/sso/oidc/callback?state=${state}`))
                .expect(302),
              searchParams = new URL(callbackResponse.headers.location).searchParams

          assert.strictEqual(searchParams.get('error'), 'cortex.error')
          assert.strictEqual(searchParams.get('error_description'), 'Callback error occured')

          sinon.restore()
        })

        it('Should return idp configuration except clientSecret for native app routes', async function() {
          const agent = supertest.agent(server.api.expressApp),
                response = await agent.get(server.makeEndpoint('/sso/oidc/native/params?idp=auth0-test'))
                  .expect(200),
                actual = Object.keys(response.body?.data),
                expected = ['name', 'label', 'uuid', 'type', 'clientId', 'issuer', 'authorizationParams']

          assert.deepStrictEqual(actual, expected)
        })

        it('Should not allow access when account is locked', async function() {
          const agent = supertest.agent(server.api.expressApp),
                accountInTest = server.principals.provider

          sinon.stub(modules.oidc, 'callback').resolves({ email: accountInTest.email })

          // lock the account in test
          await promised(null, sandboxed(function() {
            const accounts = require('accounts')

            accounts.admin.update(script.arguments.accountId, { locked: true })
          }, {
            runtimeArguments: {
              accountId: accountInTest._id
            }
          }))

          // authorize
          let response = await agent.get(server.makeEndpoint('/sso/oidc/login?return_to=https://www.example.com'))
                .expect(302),
              authorizationUrl = new URL(response.headers.location),
              state = authorizationUrl.searchParams.get('state'),

              // callback
              callbackResponse = await agent.get(server.makeEndpoint(`/sso/oidc/callback?state=${state}`))
                .expect(302),
              searchParams = new URL(callbackResponse.headers.location).searchParams

          assert.strictEqual(searchParams.get('error'), 'cortex.accessDenied.accountLocked')
          assert.strictEqual(searchParams.get('error_description'), 'Account access has been disabled.')

          // unlock the account in test
          await promised(null, sandboxed(function() {
            const accounts = require('accounts')

            accounts.admin.update(script.arguments.accountId, { locked: false })
          }, {
            runtimeArguments: {
              accountId: accountInTest._id
            }
          }))

          sinon.restore()
        })

        it('Should record login event in audit logs', async function() {
          const accountInTest = server.principals.provider

          const callbackResponse = await mockSsoLogin({ email: accountInTest.email })

          let searchParams = new URLSearchParams({
                sort: '{"req":-1}',
                limit: 1,
                where: '{"cat":"authentication","sub":"login"}'
              }),
              auditRecord = await server.sessions.admin
                .get(server.makeEndpoint('/audit?' + searchParams.toString()))
                .set(server.getSessionHeaders())
                .then(response => {
                  return response.body?.data[0]
                })

          // should have same request id of callback
          assert.strictEqual(auditRecord?.req, callbackResponse.headers['medable-request-id'])

          assert.strictEqual(auditRecord?.cat, 'authentication')
          assert.strictEqual(auditRecord?.sub, 'login')
          assert.strictEqual(auditRecord?.metadata?.email, accountInTest.email)
          assert.strictEqual(auditRecord?.metadata?.sso, true)
        })

        it('Should load account with username claim', async function() {
          await testUtils.updateOrg('configuration.accounts.enableUsername', true)

          const account = await testUtils.createAccount({ username: 'testaccount' }),
                claims = { username: 'testaccount' },
                response = await mockSsoLogin(claims)

          assert.strictEqual(response.body.object, 'account')
          assert.strictEqual(response.body.username, 'testaccount')

          await testUtils.updateOrg('configuration.accounts.enableUsername', false)
          await testUtils.deleteInstance('accounts', account._id)
        })

        it('Should accept email in username claim', async function() {
          await testUtils.updateOrg('configuration.accounts.enableUsername', true)

          const account = await testUtils.createAccount({ username: 'testaccount' }),
                claims = { email: 'invalid.email@medable.com', username: 'test.account@medable.com' },
                response = await mockSsoLogin(claims)

          assert.strictEqual(response.body.object, 'account')
          assert.strictEqual(response.body.username, 'testaccount')

          await testUtils.updateOrg('configuration.accounts.enableUsername', false)
          await testUtils.deleteInstance('accounts', account._id)
        })

        it('Should not destory session on error if already loggedIn', async function() {
          const agent = supertest.agent(server.api.expressApp),
                account = await testUtils.createAccount()

          await mockSsoLogin({ email: account.email }, { agent })

          // login using same agent but with a non-existent account
          await mockSsoLogin({ email: 'non-existent@medable.com' }, { agent })

          // wait for session to be persisted
          await sleep(250)

          const response = await agent.get(server.makeEndpoint('/accounts/status')).set(server.getSessionHeaders())

          assert.ok(response.body?.data?.loggedin)

          await testUtils.deleteInstance('accounts', account._id)
        })

        it('Should relogin again if relogin parameter passed', async function() {
          const agent = supertest.agent(server.api.expressApp),
                account = await testUtils.createAccount()

          // first login
          const res1 = await mockSsoLogin({ email: account.email }, { agent })

          assert.ok((res1.headers['set-cookie'] || []).some(h => h.indexOf('md.sid') !== -1))

          // wait for session to be persisted
          await sleep(250)

          // second login
          const res2 = await mockSsoLogin({ email: account.email }, { agent, params: { relogin: 1 } })

          assert.ok((res2.headers['set-cookie'] || []).some(h => h.indexOf('md.sid') !== -1))

          await testUtils.deleteInstance('accounts', account._id)
        })

        it('Should not throw an error if current session is expired', async function() {
          const agent = server.sessions.provider,
                { email } = server.principals.provider,
                clock = sinon.useFakeTimers({ now: new Date(), toFake: ['Date'] })

          // mock identity token
          sinon.stub(modules.oidc, 'callback').resolves({ email })

          // advance 24 hours to expire session
          clock.tick(60 * 60 * 24 * 1000)

          // get state for callback
          let response = await agent.get(server.makeEndpoint(`/sso/oidc/login`))
                .expect(302),
              authorizationUrl = new URL(response.headers.location),
              state = authorizationUrl.searchParams.get('state'),

              // load and log in account from identity token
              cbResponse = await agent.get(server.makeEndpoint(`/sso/oidc/callback?state=${state}`))

          assert.strictEqual(cbResponse.body.object, 'account')
          assert.strictEqual(cbResponse.body.email, email)

          sinon.restore()
        })

      })

      describe('Native', async function() {
        const idpConfig = {
          'name': 'native',
          'label': 'native',
          'type': 'oidc',
          'issuer': 'https://login.example.com',
          'clientId': 'some-id',
          'clientSecret': 'some-secret',
          'authorizationParams': [
            {
              'key': 'scope',
              'value': 'openid email'
            },
            {
              'key': 'organization',
              'value': 'org_qt08OIs7MhsO6BP0'
            }
          ]
        }

        let account,
            idpConfigId

        before(async function() {
          account = await testUtils.createAccount({username: 'testaccount'})
          idpConfigId = await testUtils.insertInstance('idps', idpConfig)
          await testUtils.updateOrg('configuration.loginMethods', ['sso', 'credentials'])
        })

        after(async function() {
          await testUtils.deleteInstance('accounts', account._id)
          await testUtils.deleteManyInstances('idps')
          await testUtils.updateOrg('configuration.loginMethods', ['credentials'])
        })

        it('should accept code_verifier and code passed in query string', async() => {
          const agent = supertest.agent(server.api.expressApp)

          nockTokenEndpoint({ email: 'test.account@medable.com' })

          await agent.get(server.makeEndpoint(`/sso/oidc/native/callback?idp=${idpConfig.name}&code_verifier=${defaults.tokenEndpoint.body.code_verifier}&code=${defaults.tokenEndpoint.body.code}`))
            .expect(200)
        })

        it('should fail if code is missing from query string', async() => {
          const agent = supertest.agent(server.api.expressApp)

          nockTokenEndpoint({ email: 'test.account@medable.com' })

          let callbackResponse = await agent.get(server.makeEndpoint(`/sso/oidc/native/callback?idp=${idpConfig.name}&code_verifier=${defaults.tokenEndpoint.body.code_verifier}`))
            .expect(400)

          assert.strictEqual(callbackResponse.body.message, 'code missing from response')
        })

        it('should get redirectUri from config', async() => {
          const agent = supertest.agent(server.api.expressApp),
                update = { $set: { redirectUri: 'com.medable://callback' } }

          await testUtils.updateInstance('idps', idpConfigId, update)
          nockTokenEndpoint({ email: 'test.account@medable.com' }, { redirect_uri: 'com.medable://callback' })

          await agent.get(server.makeEndpoint(`/sso/oidc/native/callback?idp=${idpConfig.name}&code_verifier=${defaults.tokenEndpoint.body.code_verifier}&code=${defaults.tokenEndpoint.body.code}`))
            .expect(200)
        })
      })
    })
  })
})
