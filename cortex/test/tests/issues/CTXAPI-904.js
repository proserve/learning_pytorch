'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      medableAdmin = require('../../lib/create.medable.admin')

describe('Issues - CTXAPI-904 enable/disable policy from base org should re-sync runtime', function() {

  let baseOrgAdmin
  before(async() => {

    baseOrgAdmin = await promised(null, medableAdmin, 'gaston+test_904@medable.com')
    await promised(null, sandboxed(function() {
      org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          'policies': [{
            name: 'c_ctxapi_904_allow',
            label: 'c_ctxapi_904_allow',
            priority: 100,
            active: true,
            condition: 'and',
            action: 'Allow',
            methods: ['get'],
            paths: ['/routes/c_ctxapi_904_allow'],
            halt: true
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.org.updateOne({ code: script.org.code }, {
        $pull: {
          policies: ['c_ctxapi_904_allow']
        }
      }).execute()

    }))

    await promised(server, 'updateOrg')
  })

  it('activate/deactivate from baseOrg should re-sync runtime ', async function() {
    const policy = await promised(null, sandboxed(function() {
            return org.read('policies')[0]
          })),
          result = await baseOrgAdmin.session
            .patch('/medable/sys/orgs/' + server.org._id)
            .set(baseOrgAdmin.getHeaders())
            .send([
              { op: 'set', path: `policies/${policy._id}/active`, value: false }
            ])

    should(result.body.policies[0].active).equal(false)

    should((await promised(null, sandboxed(function() {
      return org.read('runtime').policies
    }))).length).equal(0)

    // eslint-disable-next-line one-var
    const result2 = await baseOrgAdmin.session
      .patch('/medable/sys/orgs/' + server.org._id)
      .set(baseOrgAdmin.getHeaders())
      .send([
        { op: 'set', path: `policies/${policy._id}/active`, value: true }
      ])

    should(result2.body.policies[0].active).equal(true)
    should((await promised(null, sandboxed(function() {
      return org.read('runtime').policies
    }))).length).equal(1)

  })

})
