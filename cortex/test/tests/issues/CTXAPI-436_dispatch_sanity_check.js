'use strict'

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      ap = require('../../../lib/access-principal')

describe('Issues - CTXAPI-436 - dispatcher sanity check', function() {

  it('should dispatch workers appropriately', async() => {

    const org = await modules.db.models.Org.loadOrg('medable'),
          principal = ap.synthesizeOrgAdmin(org)

    await (sandboxed(

      function() {

        /* global sys */

        require('should')

        let log

        const payload = 'testing',
              master = sys.getEndpoints().find(v => v.isMaster).name,
              cursor = sys.tail()

        for (let i = 0; i < 100; i++) {

          sys.q(payload)

          log = cursor.next()
          log.level.should.equal('debug')
          log.message.payload.should.equal(payload)

          if (master === 'localhost') {
            log.message.endpoint.should.equal(master)
          } else {
            log.message.endpoint.should.not.equal(master)
          }

        }

      },
      {
        principal
      }
    )())

  })

})
