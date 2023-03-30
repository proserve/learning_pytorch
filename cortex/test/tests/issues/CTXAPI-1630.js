'use strict'

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      AccessPrincipal = require('../../../lib/access-principal'),
      config = require('cortex-service/lib/config')

describe('Issues - CTXAPI-1630 - provisioning ', function() {

  let originalDomain

  function setDomain(domain) {
    config('app').domain = domain
    config.flush()
  }

  beforeEach(() => {
    originalDomain = config('app.domain')
  })

  afterEach(() => {
    setDomain(originalDomain)
  })

  it('should be able to create ephemeral env in non-market domain', async() => {

    setDomain('medable')

    const medable = await modules.db.models.org.loadOrg('medable'),
          principal = await AccessPrincipal.synthesizeOrgAdmin(medable)

    await sandboxed(function() {

      const should = require('should'),
            { provision, teardown } = require('env'),
            provisioned = provision({
              org: {
                code: 'ctxapi1630m3dable',
                name: 'ctxapi1630m3dable',
                ephemeral: false // sanity check. this should be forced to true.
              },
              account: {
                name: {
                  first: 'john',
                  last: 'stamos'
                },
                email: 'john.stamos@example.com',
                password: 'i do karate in the garage!~'
              }
            }
            )

      should.exist(provisioned.token)
      should.equal(true, provisioned.org.configuration.ephemeral)

      teardown('ctxapi1630m3dable')

    }, {
      principal
    })()

  })

  it('should not be able to create ephemeral envs in market domains.', async() => {

    setDomain('market')

    const medable = await modules.db.models.org.loadOrg('medable'),
          principal = await AccessPrincipal.synthesizeOrgAdmin(medable)

    await sandboxed(function() {

      let err

      const should = require('should'),
            { provision, teardown } = require('env'),
            provisioned = provision({
              org: {
                code: 'ctxapi1630market',
                name: 'ctxapi1630market',
                ephemeral: true // sanity check. this should be forced to false.
              },
              account: {
                name: {
                  first: 'john',
                  last: 'stamos'
                },
                email: 'john.stamos@example.com',
                password: 'i do karate in the garage!~'
              }
            }
            )

      should.exist(provisioned.token)
      should.equal(false, provisioned.org.configuration.ephemeral)

      try {
        teardown('ctxapi1630market')
      } catch (e) {
        err = e
      }

      should.exist(err)

    }, {
      principal
    })()

  })

})
