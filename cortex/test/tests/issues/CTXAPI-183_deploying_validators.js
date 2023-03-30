'use strict'

/* global before, after */

const config = require('cortex-service/lib/config'),
      supertest = require('supertest'),
      sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      ap = require('../../../lib/access-principal'),
      { promised, sleep } = require('../../../lib/utils')

describe('Issues', function() {

  describe('CTXAPI-183 - deploying validators', function() {

    let medable = null, source = null, target = null, apiHost = null

    // trick deployment module into local requests
    before(async() => {

      apiHost = config('server.apiHost')

      modules.deployment._ctxapi1183_httpRequest = modules.deployment._httpRequest

      modules.deployment._httpRequest = function(requestUrl, requestOptions, reqCB) {

        let end = apiHost.length + requestUrl.search(apiHost),
            path = requestUrl.substring(end)

        supertest(server.api.expressApp)
          .post(path)
          .set(requestOptions.headers)
          .send(requestOptions.body)
          .done((err, body, response) => {
            reqCB(err, response, body)
          })
      }
    })

    after(async() => {
      modules.deployment._httpRequest = modules.deployment._ctxapi1183_httpRequest
      delete modules.deployment._ctxapi1183_httpRequest
    })

    // --------------------------------------------------
    // provision source and target org, and enable deployments

    before(async() => {

      let org = (await promised(modules.db.models.org, 'createObject', 'org', 'medable')).org
      medable = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      await promised(null, sandboxed(function() {

        const { provisionOrg, updateOrg } = require('system')

        provisionOrg({
          name: 'ctxapi183-source',
          code: 'ctxapi183-source'
        }, {
          email: 'ctxapi183-source@medable.com',
          name: {
            first: 'ctxapi183-source',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi183-source', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

        provisionOrg({
          name: 'ctxapi183-target',
          code: 'ctxapi183-target'
        }, {
          email: 'ctxapi183-target@medable.com',
          name: {
            first: 'ctxapi183-target',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi183-target', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

      }, {
        principal: medable.principal
      }))

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi183-source')).org
      source = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi183-target')).org
      target = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      await promised(null, sandboxed(function() {

        /* global org, script */

        org.push('deployment.targets', script.arguments.target)

        org.objects.objects.insertOne({
          label: 'c_ctxapi_183',
          name: 'c_ctxapi_183',
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String',
            indexed: true,
            unique: true,
            validators: [{ name: 'string', definition: { min: 1, max: 1 } }]
          }]
        }).execute()

      }, {
        principal: source.principal,
        runtimeArguments: {
          target: { server: apiHost, code: target.org.code }
        }
      }))

      await promised(null, sandboxed(function() {

        const source = org.read('deployment.sources').find(v => v.code === 'ctxapi183-source')
        org.update(`deployment.sources.${source._id}/state`, 'Active')

        org.push('apps', {
          name: 'c_ctxapi_183',
          label: 'c_ctxapi_183',
          enabled: true,
          clients: [{
            label: 'c_ctxapi_183',
            enabled: true,
            readOnly: false,
            sessions: true,
            rsa: {
              regenerate: true
            }
          }]
        })

      }, {
        principal: target.principal
      }))

      // update principals with target states
      source.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi183-source')).org
      )

      target.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi183-target')).org
      )

    })

    // --------------------------------------------------
    // deploy and test

    it('successful deployment of object definition', async() => {

      let done = false, err = null

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                done = true
                err = e
              }
            },
            authToken = await promised(null, sandboxed(function() {
              return org.objects.accounts.createAuthToken(
                org.read('apps').find(app => app.name === 'c_ctxapi_183').clients[0].key,
                'ctxapi183-target@medable.com',
                {
                  scope: [
                    'deployment.execute'
                  ]
                })
            }, {
              principal: target.principal
            }))

      server.events.on('worker.done', handler)

      await promised(null, sandboxed(function() {
        const Deployment = org.objects.deployment
        let deployment, deploymentToken

        deployment = new Deployment(Deployment.insertOne({
          label: 'c_ctxapi_183',
          description: 'c_ctxapi_183',
          target: org.read('deployment.targets').find(v => v.code === 'ctxapi183-target')._id,
          configuration: {
            obj: { select: 2, ids: [ org.objects.objects.find({ name: 'c_ctxapi_183' }).pathRead('_id') ] },
            cfg: { select: 1, ids: [] },
            scr: { select: 1, ids: [] },
            viw: { select: 1, ids: [] },
            sva: { select: 1, ids: [] },
            tpl: { select: 1, ids: [] },
            ntf: { select: 1, ids: [] },
            rle: { select: 1, ids: [] },
            pol: { select: 1, ids: [] },
            sms: { select: 1, ids: [] },
            app: { select: 1, ids: [], preserveCerts: false }
          }
        }).execute())
        deploymentToken = deployment.authenticate({ token: script.arguments.authToken })
        deployment.guessMappings(deploymentToken, { force: true })
        return deployment.deploy(deploymentToken)
      }, {
        principal: source.principal,
        runtimeArguments: {
          authToken
        }
      }))

      while (!done) { // eslint-disable-line no-unmodified-loop-condition
        await sleep(250)
      }
      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      server.events.on('worker.done', handler)
      done = false

      // add another validator to an existing property and fire up another deployment.
      await promised(null, sandboxed(function() {

        /* global org, script */

        org.objects.objects.updateOne({
          name: 'c_ctxapi_183'
        }, {
          $push: {
            properties: [{
              name: 'c_string',
              validators: [{ name: 'customName' }]
            }]
          }
        }).execute()

        const Deployment = org.objects.deployment
        let deployment, deploymentToken

        deployment = new Deployment(Deployment.insertOne({
          label: 'c_ctxapi_183',
          description: 'c_ctxapi_183',
          target: org.read('deployment.targets').find(v => v.code === 'ctxapi183-target')._id,
          configuration: {
            obj: { select: 2, ids: [ org.objects.objects.find({ name: 'c_ctxapi_183' }).pathRead('_id') ] },
            cfg: { select: 1, ids: [] },
            scr: { select: 1, ids: [] },
            viw: { select: 1, ids: [] },
            sva: { select: 1, ids: [] },
            tpl: { select: 1, ids: [] },
            ntf: { select: 1, ids: [] },
            rle: { select: 1, ids: [] },
            pol: { select: 1, ids: [] },
            sms: { select: 1, ids: [] },
            app: { select: 1, ids: [], preserveCerts: false }
          }
        }).execute())
        deploymentToken = deployment.authenticate({ token: script.arguments.authToken })
        deployment.guessMappings(deploymentToken, { force: true })
        return deployment.deploy(deploymentToken)

      }, {
        principal: source.principal,
        runtimeArguments: {
          authToken
        }
      }))

      target.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi183-target')).org
      )

      while (!done) { // eslint-disable-line no-unmodified-loop-condition
        await sleep(250)
      }
      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      await promised(null, sandboxed(function() {

        /* global org, script */

        require('should')

        const object = org.objects.objects.find({ name: 'c_ctxapi_183' }).next()
        object.properties.find(v => v.name === 'c_string').validators.length.should.equal(2)

      }, {
        principal: target.principal
      }))

    })

  })

})
