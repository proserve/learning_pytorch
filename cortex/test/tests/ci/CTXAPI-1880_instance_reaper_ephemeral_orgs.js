'use strict'

const modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      ap = require('../../../lib/access-principal'),
      { promised } = require('../../../lib/utils'),
      server = require('../../lib/server'),
      sandboxed = require('../../lib/sandboxed'),
      { waitForWorker } = require('../../lib/utils')(),
      should = require('should')

describe('Issues - CTXAPI-1880 - instance reaper : Ephemeral Orgs ', function() {

  it('should remove expired ephemeral org', async() => {

    const baseOrg = await promised(modules.db.models.org, 'loadOrg', acl.BaseOrg, {}),
          baseAdmin = ap.synthesizeOrgAdmin(baseOrg, acl.SystemAdmin)
    await promised(null, sandboxed(function() {
      require('env').provision({
        account: {
          email: 'gaston@medable.com',
          password: 'qpal1010'
        },
        org: {
          code: 'should-be-removed',
          ttl: 1
        }
      })
    }, baseAdmin))

    modules.workers.runNow('instance-reaper')
    await waitForWorker(server, 'org-refresher', null)

    try {
      // Org with reap: true should not be found because should be deleted by reaper/org-refresher.
      const result = await promised(modules.db.models.org, 'loadOrg', 'should-be-removed', { reap: true })
      should.not.exists(result)
    } catch (e) {
      should(e.message).equal('Org not found.')
    }
  })

})
