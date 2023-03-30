const assert = require('assert'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      testUtils = require('../../lib/utils')()

describe('Human readable codes #CTXAPI-1942', function() {

  it('Should return accessRoles as strings when stringAccessRoles is enabled', async function() {
    await testUtils.updateOrg('configuration.stringAccessRoles', true)

    const account = await promised(null, sandboxed(function() {
      /* global org */
      const accounts = org.objects.accounts.find({ email: 'james+admin@medable.com' }).paths('accessRoles').toArray()
      return accounts && accounts[0]
    }))

    assert.ok((account.accessRoles || []).includes('administrator'))

    await testUtils.updateOrg('configuration.stringAccessRoles', false)
  })

  it('Should have roleCodes added to access principal', async function() {

    const principalRoles = await promised(null, sandboxed(function() {
      /* global script */
      return script.principal
    }))

    assert.ok((principalRoles.roleCodes || []).includes('administrator'))

  })

})
