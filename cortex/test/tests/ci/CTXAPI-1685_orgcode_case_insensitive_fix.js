/* eslint-disable one-var */
const should = require('should'),
      modules = require('../../../lib/modules'),
      assert = require('assert')

describe('Issues - CTXAPI-1685 - Patch orgcode case insensitive match in mongoose findOne', function() {

  before(async function() {

    await modules.db.models.Org.collection.remove({ code: 'v2-test-org' })
    await modules.db.models.Org.collection.insert({
      'type': null,
      'reap': false,
      'state': 'enabled',
      'maintenance': false,
      'maintenanceMessage': '',
      'locale': 'en_US',
      'object': 'org',
      'code': 'v2-test-org',
      'name': 'V2 Test Unit Organization',
      'runtime': {
        'objects': [],
        'libraries': [],
        'triggers': [],
        'jobs': [],
        'routes': [],
        'transforms': [],
        'envs': [],
        'events': [],
        'expressions': [],
        'pipelines': [],
        'policies': []
      }
    })
  })

  after(async function() {
    await modules.db.models.Org.collection.remove({ code: 'v2-test-org' })
  })

  it('should fail loading an org if the code does not match exactly', async function() {
    const codesToTest = ['v2',
      'v2-test',
      'v2-tesT',
      'V2-tesT',
      'V2-tesT-org',
      'v2-Test-Org',
      'Medable',
      '*edable',
      'medAble',
      'med*ble']

    for (const code of codesToTest) {
      await assert.rejects(async() => {
        await modules.db.models.Org.loadOrg(code)
      }, {
        errCode: 'cortex.notFound.org'
      })
    }
  })

  it('should not fail when looking up by _id', async function() {
    const [medable] = await modules.db.models.Org.collection.find({ code: 'medable' }).limit(1).project({ _id: 1, code: 1 }).toArray()
    const [testOrg] = await modules.db.models.Org.collection.find({ code: 'test-org' }).limit(1).project({ _id: 1, code: 1 }).toArray()
    const [v2TestOrg] = await modules.db.models.Org.collection.find({ code: 'v2-test-org' }).limit(1).project({ _id: 1, code: 1 }).toArray()

    should.exist(medable)
    should.exist(testOrg)
    should.exist(v2TestOrg)

    const medableById = await modules.db.models.Org.loadOrg(medable._id)
    const testOrgById = await modules.db.models.Org.loadOrg(testOrg._id)
    const v2TestOrgById = await modules.db.models.Org.loadOrg(v2TestOrg._id)

    should.exist(medableById)
    should.exist(testOrgById)
    should.exist(v2TestOrgById)

    should.equal(medable.code, medableById.code)
    should.equal(testOrg.code, testOrgById.code)
    should.equal(v2TestOrg.code, v2TestOrgById.code)
  })

  it('should not fail for exact org code match', async function() {
    const existingOrgCodes = ['medable', 'test-org', 'v2-test-org']
    for (const code of existingOrgCodes) {
      const org = await modules.db.models.Org.loadOrg(code)
      should.exist(org)
      should.equal(org.code, code)
    }
  })

  it('should not fail for org documents', async function() {
    const medable = await modules.db.models.Org.loadOrg('medable')
    const testOrg = await modules.db.models.Org.loadOrg('test-org')
    const v2TestOrg = await modules.db.models.Org.loadOrg('v2-test-org')

    should.exist(medable)
    should.exist(testOrg)
    should.exist(v2TestOrg)
    const existingOrgs = [medable, testOrg, v2TestOrg]

    for (const org of existingOrgs) {
      const loadedOrg = await modules.db.models.Org.loadOrg(org)
      should.exist(loadedOrg)
      should.equal(org.code, loadedOrg.code)
    }
  })

})
