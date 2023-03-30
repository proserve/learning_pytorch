const should = require('should'),
      modules = require('../../../../lib/modules'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      acl = require('../../../../lib/acl'),
      ap = require('../../../../lib/access-principal')

describe('Issue - CTXAPI-1261 - Env provision token creation error', function() {
  let baseData
  before(async() => {
    const org = await promised(modules.db.models.org, 'loadOrg', acl.BaseOrg, {})
    baseData = ap.synthesizeOrgAdmin(org, acl.SystemAdmin)
  })

  it('create a token for provision', async() => {
    const result = await promised(null, sandboxed(function() {
      global.org.push('serviceAccounts', { name: 'myProvisioningServiceAccount', label: 'Provisioning Service Account', roles: [global.consts.roles.admin] })
      const env = require('env'),
            token = env.createProvisioningToken(global.org.read('apps.clients.0').key, 'c_myProvisioningServiceAccount')
      return { key: global.org.read('apps.clients.0').key, token }
    }, baseData))
    should.exist(result)
    const decoded = modules.authentication.decodeToken(result.token)
    should(decoded['cortex/eml']).equal('c_myProvisioningServiceAccount@medable-iam.serviceaccount.medable.com')
    should(decoded.iss).equal(result.key)
    should(decoded['cortex/scp']).deepEqual(['admin'])
  })
})
