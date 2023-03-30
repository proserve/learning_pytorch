'use strict'

/* global before, after */

const config = require('cortex-service/lib/config'),
      supertest = require('supertest'),
      sandboxed = require('../../../lib/sandboxed'),
      modules = require('../../../../lib/modules'),
      server = require('../../../lib/server'),
      ap = require('../../../../lib/access-principal'),
      { promised, sleep } = require('../../../../lib/utils')

describe('Features - Localization', function() {

  describe('CTXAPI-165 - deployment support', function() {

    let medable = null, source = null, target = null, apiHost = null

    // trick deployment module into local requests
    before(async() => {

      apiHost = config('server.apiHost')

      modules.deployment._ctxapi165_httpRequest = modules.deployment._httpRequest

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
      modules.deployment._httpRequest = modules.deployment._ctxapi165_httpRequest
      delete modules.deployment._ctxapi165_httpRequest
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
          name: 'ctxapi165-source',
          code: 'ctxapi165-source'
        }, {
          email: 'ctxapi165-source@medable.com',
          name: {
            first: 'ctxapi165-source',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi165-source', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

        provisionOrg({
          name: 'ctxapi165-target',
          code: 'ctxapi165-target'
        }, {
          email: 'ctxapi165-target@medable.com',
          name: {
            first: 'ctxapi165-target',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi165-target', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

      }, {
        principal: medable.principal
      }))

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi165-source')).org
      source = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi165-target')).org
      target = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      await promised(null, sandboxed(function() {

        /* global org, script */

        org.push('deployment.targets', script.arguments.target)

        org.push('roles', [{
          name: 'c_ctxapi_165_top',
          code: 'c_ctxapi_165_top'
        }, {
          name: 'c_ctxapi_165_docs',
          code: 'c_ctxapi_165_docs'
        }, {
          name: 'c_ctxapi_165_typed_top',
          code: 'c_ctxapi_165_typed_top'
        }, {
          name: 'c_ctxapi_165_typed_docs',
          code: 'c_ctxapi_165_typed_docs'
        }])

        org.objects.objects.insertOne({
          label: 'c_ctxapi_165',
          name: 'c_ctxapi_165',
          defaultAcl: 'owner.delete',
          createAcl: 'account.public',
          uniqueKey: 'c_key',
          properties: [{
            name: 'c_key',
            label: 'Key',
            type: 'String',
            indexed: true,
            unique: true,
            validators: [{ name: 'customName' }]
          }, {
            name: 'c_string',
            label: 'String',
            type: 'String',
            localization: {
              enabled: true,
              strict: false,
              fallback: true,
              acl: ['role.c_ctxapi_165_top.update'],
              fixed: 'en_US',
              valid: []
            }
          }, {
            name: 'c_doc',
            label: 'Doc',
            type: 'Document',
            properties: [{
              name: 'c_string',
              label: 'String',
              type: 'String',
              localization: {
                enabled: true,
                strict: false,
                fallback: true,
                acl: ['role.c_ctxapi_165_docs.update'],
                fixed: '',
                valid: ['fr_CA', 'en_US']
              }
            }]
          }, {
            name: 'c_docs',
            label: 'Docs',
            type: 'Document',
            array: true,
            properties: [{
              name: 'c_string',
              label: 'String',
              type: 'String',
              localization: {
                enabled: true,
                strict: true,
                fallback: true,
                acl: [],
                fixed: '',
                valid: []
              }
            }]
          }],
          objectTypes: [{
            label: 'a',
            name: 'c_a',
            properties: [{
              name: 'c_type_string',
              label: 'String',
              type: 'String',
              localization: {
                enabled: true,
                strict: false,
                fallback: true,
                acl: ['role.c_ctxapi_165_typed_top.update'],
                fixed: 'en_US',
                valid: []
              }
            }, {
              name: 'c_type_doc',
              label: 'Doc',
              type: 'Document',
              properties: [{
                name: 'c_type_string',
                label: 'String',
                type: 'String',
                localization: {
                  enabled: true,
                  strict: false,
                  fallback: true,
                  acl: [],
                  fixed: '',
                  valid: ['fr_CA', 'en_US']
                }
              }]
            }, {
              name: 'c_type_docs',
              label: 'Docs',
              type: 'Document',
              array: true,
              uniqueKey: 'c_key',
              properties: [{
                name: 'c_key',
                label: 'Key',
                type: 'String',
                validators: [{ name: 'customName' }, { name: 'uniqueInArray' }]
              }, {
                name: 'c_type_strings',
                label: 'Strings',
                type: 'String',
                array: true,
                localization: {
                  enabled: true,
                  fallback: false,
                  acl: ['role.c_ctxapi_165_typed_docs.c_ctxapi_165_typed_top'],
                  fixed: '',
                  valid: []
                }
              }]
            }]
          }]
        }).execute()

      }, {
        principal: source.principal,
        runtimeArguments: {
          target: { server: apiHost, code: target.org.code }
        }
      }))

      await promised(null, sandboxed(function() {

        const source = org.read('deployment.sources').find(v => v.code === 'ctxapi165-source')
        org.update(`deployment.sources.${source._id}/state`, 'Active')

        org.push('apps', {
          name: 'c_ctxapi_165',
          label: 'c_ctxapi_165',
          enabled: true,
          clients: [{
            label: 'c_ctxapi_165',
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
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi165-source')).org
      )

      target.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi165-target')).org
      )

    })

    // --------------------------------------------------
    // deploy and test

    it('successful deployment of localized string object definition', async() => {

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
                org.read('apps').find(app => app.name === 'c_ctxapi_165').clients[0].key,
                'ctxapi165-target@medable.com',
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
          label: 'c_ctxapi_165',
          description: 'c_ctxapi_165',
          target: org.read('deployment.targets').find(v => v.code === 'ctxapi165-target')._id,
          configuration: {
            obj: { select: 2, ids: [ org.objects.objects.find({ name: 'c_ctxapi_165' }).pathRead('_id') ] },
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

      target.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi165-target')).org
      )

      await promised(null, sandboxed(function() {

        /* global org, script, consts */

        require('should')

        const roles = org.read('roles'),
              object = org.objects.objects.find({ name: 'c_ctxapi_165' }).next(),
              ctxapi165Top = roles.find(role => role.code === 'c_ctxapi_165_top'),
              ctxapi165Docs = roles.find(role => role.code === 'c_ctxapi_165_docs'),
              ctxapi165TypedTop = roles.find(role => role.code === 'c_ctxapi_165_typed_top'),
              ctxapi165TypedDocs = roles.find(role => role.code === 'c_ctxapi_165_typed_docs')

        let Undefined

        ;(ctxapi165Top === Undefined).should.be.false()
        ;(ctxapi165Docs === Undefined).should.be.false()
        ;(ctxapi165TypedTop === Undefined).should.be.false()
        ;(ctxapi165TypedDocs === Undefined).should.be.false()

        object.uniqueKey.should.equal('c_key')

        function testLocalization(source, target) {
          source.enabled.should.equal(target.enabled)
          source.strict.should.equal(target.strict)
          source.fallback.should.equal(target.fallback)
          source.fixed.should.equal(target.fixed)
          source.valid.should.deepEqual(target.valid)
          source.acl.length.should.equal(target.acl.length)
          if (source.acl.length) {
            source.acl[0].type.should.equal(target.acl[0].type)
            source.acl[0].target.toString().should.equal(target.acl[0].target.toString())
            source.acl[0].allow.toString().should.equal(target.acl[0].allow.toString())
          }
        }

        testLocalization(object.properties.find(v => v.name === 'c_string').localization, {
          enabled: true,
          strict: false,
          fallback: true,
          acl: [{ type: consts.accessTargets.role, target: ctxapi165Top._id, allow: consts.accessLevels.update }],
          fixed: 'en_US',
          valid: []
        })

        testLocalization(object.properties.find(v => v.name === 'c_doc').properties.find(v => v.name === 'c_string').localization, {
          enabled: true,
          strict: false,
          fallback: true,
          acl: [{ type: consts.accessTargets.role, target: ctxapi165Docs._id, allow: consts.accessLevels.update }],
          fixed: '',
          valid: ['fr_CA', 'en_US']
        })

        testLocalization(object.properties.find(v => v.name === 'c_docs').properties.find(v => v.name === 'c_string').localization, {
          enabled: true,
          strict: true,
          fallback: true,
          acl: [],
          fixed: '',
          valid: []
        })

        testLocalization(object.objectTypes.find(v => v.name === 'c_a').properties.find(v => v.name === 'c_type_string').localization, {
          enabled: true,
          strict: false,
          fallback: true,
          acl: [{ type: consts.accessTargets.role, target: ctxapi165TypedTop._id, allow: consts.accessLevels.update }],
          fixed: 'en_US',
          valid: []
        })

        testLocalization(object.objectTypes.find(v => v.name === 'c_a').properties.find(v => v.name === 'c_type_doc').properties.find(v => v.name === 'c_type_string').localization, {
          enabled: true,
          strict: false,
          fallback: true,
          acl: [],
          fixed: '',
          valid: ['fr_CA', 'en_US']
        })

        object.objectTypes.find(v => v.name === 'c_a').properties.find(v => v.name === 'c_type_docs').uniqueKey.should.equal('c_key')
        object.objectTypes.find(v => v.name === 'c_a').properties.find(v => v.name === 'c_type_docs').properties.find(v => v.name === 'c_key').validators.length.should.equal(2)

        testLocalization(object.objectTypes.find(v => v.name === 'c_a').properties.find(v => v.name === 'c_type_docs').properties.find(v => v.name === 'c_type_strings').localization, {
          enabled: true,
          strict: true,
          fallback: false,
          acl: [{ type: consts.accessTargets.role, target: ctxapi165TypedDocs._id, allow: ctxapi165TypedTop._id }],
          fixed: '',
          valid: []
        })

      }, {
        principal: target.principal
      }))

    })

  })

})
