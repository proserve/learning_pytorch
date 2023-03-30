'use strict'

const OrgRefresherWorker = require('../../../lib/modules/workers/workers/org-refresher'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      assert = require('assert'),
      testUtils = require('../../lib/utils')(),
      sinon = require('sinon').createSandbox()

describe('Org Refresh #CTXAPI-1955 ', function() {
  let stub

  before(async() => {
    stub = sinon.stub(OrgRefresherWorker.prototype, '_process').yields()
  })

  afterEach(async() => {
    stub.resetHistory()
  })

  after(async() => {
    stub.reset()
  })

  it('should be able to refresh org through sandbox', async() => {
    promised(null, sandboxed(function() {
      /* global sys */
      return sys.refreshOrg()
    }))

    await testUtils.waitForWorker(server, 'org-refresher')

    assert(stub.calledOnce)
  })

  it('should be able to refresh org through API', async() => {
    server.sessions.admin
      .post(server.makeEndpoint('/org/refresh'))
      .expect(200)
      .set(server.getSessionHeaders())
      .send({
        preserve: false,
        accountPassword: server.password
      })
      .then()

    await testUtils.waitForWorker(server, 'org-refresher')

    assert(stub.calledOnce)
  })
})
