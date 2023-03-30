'use strict'

const wrapper = require('../../lib/wrapped_sandbox'),
      assert = require('assert'),
      { promised, sleep } = require('../../../lib/utils'),
      server = require('../../lib/server'),
      testUtils = require('../../lib/utils')(),
      sandboxed = require('../../lib/sandboxed'),
      { ObjectID } = require('cortex-service/lib/utils/ids'),
      config = require('cortex-service/lib/config')

module.exports = {

  main: function() {

    /* global script */

    require('should')

    script.as(
      script.principal.email,
      {
        principal: {
          scope: 'object.read.account.' + script.principal._id + '.name.first'
        }
      },
      function() {
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name', true).should.equal(true)
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name', false).should.equal(false)
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name.first', true).should.equal(true)
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name.first', false).should.equal(true)
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name.last', true).should.equal(false)
        script.principal.inAuthScope('object.read.account.' + script.principal._id + '.name.last', false).should.equal(false)
      }
    )

    return true

  }

}

describe('Scripting', function() {

  describe('Account', function() {

    it(...wrapper.wrap(__filename, module.exports))

    describe('provision', async function() {
      const accountIds = []

      function generateCredentials() {
        return {
          name: {
            first: 'Test',
            last: 'Account'
          },
          email: `test.account+${new ObjectID()}@medable.com`,
          mobile: '15055555555'
        }
      }

      async function provisionAccount(payload) {
        payload = Object.assign(generateCredentials(), payload)

        const account = await promised(null, sandboxed(function() {
          /* global org script */
          const Accounts = org.objects.Accounts
          return Accounts.provision(script.arguments.payload)
        }, {
          runtimeArguments: {
            payload
          }
        }))

        accountIds.push(account._id)

        return account
      }

      async function getEmailNotification(fn, payload) {
        let done = false,
            result,
            returnValue

        function handler(error, body, message, notification) {
          result = { error, body, message, notification }
          result.returnValue = returnValue
          server.events.removeListener('worker.emailer', handler)
          done = true
        }

        server.events.on('worker.emailer', handler)

        returnValue = await fn(payload)

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }

        return result
      }

      before(async function() {
        await testUtils.updateOrg('configuration.loginMethods', ['sso', 'credentials'])
      })

      after(async function() {
        await testUtils.updateOrg('configuration.loginMethods', ['credentials'])
        accountIds.forEach(id => testUtils.deleteInstance('accounts', id))
      })

      it('should set loginMethods on account object', async function() {
        let account = await provisionAccount({ loginMethods: ['credentials', 'sso'] })

        account = await testUtils.getInstance('accounts', account._id)
        assert.deepStrictEqual(['credentials', 'sso'], account.loginMethods)
      })

      it('should not throw error when provisioning passwordless account if new login experience is disabled', async function() {
        await assert.doesNotReject(provisionAccount({ loginMethods: ['sso'] }))
      })

      it('should skip activation for sso only account', async function() {
        await testUtils.updateOrg('registration.activationRequired', true)

        let account = await provisionAccount({ loginMethods: ['sso'] })
        account = await testUtils.getInstance('accounts', account._id)

        assert.strictEqual(account.activationRequired, undefined)

        await testUtils.updateOrg('registration.activationRequired', false)
      })

      describe('newLoginExperience', function() {

        const callbackTokenLength = new RegExp(`\\/\\w{${config('callbacks.tokenLength')}}`)

        before(async function() {
          await testUtils.updateOrg('configuration.newLoginExperience', true)
        })

        after(async function() {
          await testUtils.updateOrg('configuration.newLoginExperience', false)
        })

        it('should send create-password account-welcome notification for org configured with new login experience and credentials loginMethod', async function() {
          const { message, notification, body } = await getEmailNotification(provisionAccount)

          assert.strictEqual(message.worker, 'notification')
          assert.strictEqual(notification.template, 'account-welcome')
          assert.match(body.content[0].value, /apps-dashboard/)
          assert.match(body.content[0].value, /create-password/)
          assert.match(body.content[0].value, callbackTokenLength, 'url mismatch: password reset token ')
          assert.match(body.content[0].value, new RegExp(`org=${server.org.code}`), 'url mismatch: org in query string')
        })

        it('should send account-welcome notification for sso only account in org configured with new login experience', async function() {

          const { message, notification, body } = await getEmailNotification(provisionAccount, { loginMethods: ['sso'] })

          assert.strictEqual(message.worker, 'notification')
          assert.strictEqual(notification.template, 'account-welcome')
          assert.match(body.content[0].value, /apps-dashboard/, 'url mismatch')
          assert.doesNotMatch(body.content[0].value, /create-password/, 'url mismatch')
          assert.match(body.content[0].value, new RegExp(`org=${server.org.code}`), 'url mismatch: org in query string')
        })

        it('should send create password link for sso-only admin accounts', async function() {

          const { message, notification, body } = await getEmailNotification(provisionAccount, { loginMethods: ['sso'], roles: ['000000000000000000000004'] })
          assert.strictEqual(message.worker, 'notification')
          assert.strictEqual(notification.template, 'account-welcome')
          assert.match(body.content[0].value, /apps-dashboard/, 'url mismatch')
          assert.match(body.content[0].value, /create-password/, 'url mismatch')
          assert.match(body.content[0].value, callbackTokenLength, 'url mismatch: password reset token ')
          assert.match(body.content[0].value, new RegExp(`org=${server.org.code}`), 'url mismatch: org in query string')
        })
      })
    })
  })
})
