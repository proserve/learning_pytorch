'use strict'

const assert = require('assert'),
      modules = require('../../../lib/modules'),
      testUtils = require('../../lib/utils'),
      { createAccount, updateInstance, deleteInstance, updateOrg } = testUtils(),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      consts = require('../../../lib/consts')

describe('Modules', function() {

  describe('Account', function() {

    describe('requestPasswordReset', function() {

      it('throws an error if account is sso only', async function() {
        await updateOrg('configuration.loginMethods', ['sso', 'credentials'])

        const { email, username, _id, locale } = await createAccount(),
              expected = {
                errCode: 'cortex.accessDenied.unspecified',
                reason: 'Can not request password reset for passwordless account. Login methods must include credentials.'
              }

        await updateInstance('account', _id, { $set: { loginMethods: ['sso'] } })
        await assert.rejects(promised(modules.accounts, 'requestPasswordReset', server.org, email, username, _id, locale), expected)
        await deleteInstance('accounts', _id)
      })

      it('does not throw error if account is sso only and an admin', async function() {
        await updateOrg('configuration.loginMethods', ['sso', 'credentials'])

        const { email, username, _id, locale } = await createAccount()

        await updateInstance('account', _id, { $set: { loginMethods: ['sso'], roles: consts.roles.admin } })
        await assert.doesNotReject(promised(modules.accounts, 'requestPasswordReset', server.org, email, username, _id, locale))
        await deleteInstance('accounts', _id)
      })

    })

  })

})
