'use strict'

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      ap = require('../../../lib/access-principal')

describe('Metrics', function() {

  it('should return metrics', async() => {

    const org = await modules.db.models.Org.loadOrg('medable'),
          principal = ap.synthesizeOrgAdmin(org)

    await (sandboxed(

      function() {

        require('should')

        /* global sys */
        const metrics = sys.getMetrics()

        metrics.should.exist // eslint-disable-line no-unused-expressions
        metrics.should.have.property('localhost')
        metrics.localhost.should.have.property('api')
        metrics.localhost.should.have.property('caches')
        metrics.localhost.should.have.property('db')
        metrics.localhost.should.have.property('reader')
        metrics.localhost.should.have.property('sandbox')
        metrics.localhost.should.have.property('service')
        metrics.localhost.should.have.property('v8')
        metrics.localhost.should.have.property('workers')

      },
      {
        principal
      }
    )())

  })

})
