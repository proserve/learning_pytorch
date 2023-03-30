const should = require('should'),
      modules = require('../../../lib/modules')

describe('Issues - CTXAPI-1280 - Server Crash if request org does not exist', () => {
  it('Given org does not exist, Server should return 404 instead of crashing', async() => {
    try {
      await modules.db.models.org.loadOrg('fake_org_code')
    } catch (e) {
      should(e.message).be.equal('Org not found.')
      should(e.statusCode).be.equal(404)
    }
  })

  it('Given org does exist, Server should return proper response', async() => {
    let resp = await modules.db.models.org.loadOrg('test-org')
    should(resp).be.an.Object()
    should(resp.objectsMap).be.an.Object()
    should(resp.inlinedRoles).be.an.Object()
  })
})
