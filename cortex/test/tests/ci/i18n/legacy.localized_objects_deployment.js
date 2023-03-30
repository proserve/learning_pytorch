'use strict'

/* global before, after */

const config = require('cortex-service/lib/config'),
      supertest = require('supertest'),
      sandboxed = require('../../../lib/sandboxed'),
      modules = require('../../../../lib/modules'),
      server = require('../../../lib/server'),
      ap = require('../../../../lib/access-principal'),
      { promised, sleep } = require('../../../../lib/utils')

describe('Features - Objects Localization', function() {

  describe('CTXAPI-459 - localized objects deployment support', function() {

    let medable = null, source = null, target = null, apiHost = null

    // trick deployment module into local requests
    before(async() => {

      apiHost = config('server.apiHost')

      modules.deployment._ctxapi459_httpRequest = modules.deployment._httpRequest

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
      modules.deployment._httpRequest = modules.deployment._ctxapi459_httpRequest
      delete modules.deployment._ctxapi459_httpRequest
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
          name: 'ctxapi459-source',
          code: 'ctxapi459-source'
        }, {
          email: 'ctxapi459-source@medable.com',
          name: {
            first: 'ctxapi459-source',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi459-source', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

        provisionOrg({
          name: 'ctxapi459-target',
          code: 'ctxapi459-target'
        }, {
          email: 'ctxapi459-target@medable.com',
          name: {
            first: 'ctxapi459-target',
            last: 'test'
          },
          mobile: '+15055555555'
        })

        updateOrg('ctxapi459-target', {
          deployment: {
            supportOnly: false,
            enabled: true,
            availability: 2
          }
        })

      }, {
        principal: medable.principal
      }))

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi459-source')).org
      source = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      org = (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi459-target')).org
      target = {
        org,
        principal: ap.synthesizeOrgAdmin(org)
      }

      await promised(null, sandboxed(function() {

        /* global org, script */
        org.push('deployment.targets', script.arguments.target)

        org.objects.objects.insertOne({
          label: 'CTXAPI-459-Source',
          name: 'c_ctxapi_459_source',
          defaultAcl: ['owner.delete'],
          createAcl: ['account.public']
        }).execute()

        org.objects.objects.insertOne({
          localized: true, // has to be first
          label: 'CTXAPI-459-EN',
          name: 'c_ctxapi_459',
          description: 'CTXAPI-459 description',
          defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
          createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
          properties: [
            {
              label: 'String Prop',
              name: 'c_string_label',
              type: 'String'
            }, {
              label: 'Any Prop',
              name: 'c_any_label',
              type: 'Any'
            }, {
              label: 'Bool Prop',
              name: 'c_bool_label',
              type: 'Boolean'
            }, {
              label: 'Date Prop',
              name: 'c_date_label',
              type: 'Date'
            }, {
              label: 'Document Prop',
              name: 'c_document_label',
              type: 'Document',
              properties: [{
                label: 'Sub String Prop',
                name: 'c_sub_string_label',
                type: 'String'
              }]
            }, {
              label: 'Geometry Prop',
              name: 'c_geo_label',
              type: 'Geometry'
            }, {
              label: 'List Prop',
              name: 'c_list_label',
              type: 'List',
              sourceObject: 'c_ctxapi_459_source'
            }, {
              label: 'Number Prop',
              name: 'c_number_label',
              type: 'Number'
            }, {
              label: 'ObjectId Prop',
              name: 'c_objectid_label',
              type: 'ObjectId'
            }, {
              label: 'Reference Prop',
              name: 'c_reference_label',
              type: 'Reference',
              sourceObject: 'c_ctxapi_459_source'
            }, {
              label: 'Set Prop',
              name: 'c_set_label',
              type: 'Set'
            }, {
              label: 'Binary Prop',
              name: 'c_binary_label',
              type: 'Binary'
            }, {
              label: 'UUID Prop',
              name: 'c_uuid_label',
              type: 'UUID'
            }],
          objectTypes: [
            { label: 'Type A',
              name: 'c_type_a',
              properties: [
                { label: 'Type A Prop', name: 'c_type_a', type: 'String' }
              ]
            },
            { label: 'Type B',
              name: 'c_type_b',
              properties: [
                { label: 'Type B Prop', name: 'c_type_a', type: 'Number' }
              ]
            }
          ]
        }).locale('en_US').execute()

        org.objects.objects.updateOne({ name: 'c_ctxapi_459' }, {
          $set: {
            label: 'CTXAPI-459-ES',
            description: 'CTXAPI-459 descripcion',
            properties: [
              {
                name: 'c_string_label',
                label: 'Prop Texto'
              }, {
                name: 'c_any_label',
                label: 'Prop Cualquiera'
              }, {
                name: 'c_bool_label',
                label: 'Prop Boleana'
              }, {
                name: 'c_date_label',
                label: 'Prop Fecha'
              }, {
                name: 'c_date_label',
                label: 'Prop Fecha'
              }, {
                label: 'Prop Documento',
                name: 'c_document_label',
                properties: [{
                  label: 'Prop Sub Texto',
                  name: 'c_sub_string_label'
                }]
              }, {
                label: 'Prop Geometria',
                name: 'c_geo_label'
              }, {
                label: 'Prop Lista',
                name: 'c_list_label'
              }, {
                label: 'Prop Numero',
                name: 'c_number_label'
              }, {
                label: 'Prop Id Objeto',
                name: 'c_objectid_label'
              }, {
                label: 'Prop Referencia',
                name: 'c_reference_label'
              }, {
                label: 'Prop Set',
                name: 'c_set_label'
              }, {
                label: 'Prop Binaria',
                name: 'c_binary_label'
              }, {
                label: 'Prop ID Unico',
                name: 'c_uuid_label'
              }],
            objectTypes: [
              { label: 'Tipo A',
                name: 'c_type_a',
                properties: [
                  { label: 'Tipo Prop A', name: 'c_type_a', type: 'String' }
                ]
              },
              { label: 'Tipo B',
                name: 'c_type_b',
                properties: [
                  { label: 'Tipo Prop B', name: 'c_type_a', type: 'Number' }
                ]
              }
            ]
          }
        }).locale('es_AR').execute()

      }, {
        principal: source.principal,
        runtimeArguments: {
          target: { server: apiHost, code: target.org.code }
        }
      }))

      await promised(null, sandboxed(function() {

        const source = org.read('deployment.sources').find(v => v.code === 'ctxapi459-source')
        org.update(`deployment.sources.${source._id}/state`, 'Active')

        org.push('apps', {
          name: 'c_ctxapi_459',
          label: 'c_ctxapi_459',
          enabled: true,
          clients: [{
            label: 'c_ctxapi_459',
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
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi459-source')).org
      )

      target.principal.updateOrg(
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi459-target')).org
      )

    })

    // --------------------------------------------------
    // deploy and test

    it('successful deployment of localized object definition', async() => {

      let done = false, err = null

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.worker === 'deployer' && message.mochaCurrentTestUuid === testId) {
                done = true
                err = e
              }
            },
            authToken = await promised(null, sandboxed(function() {
              return org.objects.accounts.createAuthToken(
                org.read('apps').find(app => app.name === 'c_ctxapi_459').clients[0].key,
                'ctxapi459-target@medable.com',
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
          label: 'c_ctxapi_459',
          description: 'c_ctxapi_459',
          target: org.read('deployment.targets').find(v => v.code === 'ctxapi459-target')._id,
          configuration: {
            obj: { select: 2, ids: [ org.objects.objects.find({ name: 'c_ctxapi_459' }).pathRead('_id') ] },
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
        return [deployment.deploy(deploymentToken), deployment]
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
        (await promised(modules.db.models.org, 'createObject', 'org', 'ctxapi459-target')).org
      )

      const should = require('should'),
            result = await promised(null, sandboxed(function() {

              /* global org, script, consts */

              const objectEnUs = org.objects.objects.find({ name: 'c_ctxapi_459' }).include('locales').paths('label', 'description', 'properties', 'objectTypes', 'locales').locale('en_US').next(),
                    objectEsAr = org.objects.objects.find({ name: 'c_ctxapi_459' }).include('locales').paths('label', 'description', 'properties', 'objectTypes', 'locales').locale('es_AR').next()

              return { objectEnUs, objectEsAr }
            }, {
              principal: target.principal
            })),
            mapProps = (props) => {
              return props.map(p => {
                const item = {
                  label: p.label,
                  name: p.name
                }
                if (p.properties) {
                  item.properties = mapProps(p.properties)
                }
                return item
              })
            }

      should.equal(result.objectEnUs.label, 'CTXAPI-459-EN')
      should.equal(result.objectEsAr.label, 'CTXAPI-459-ES')
      should.equal(result.objectEnUs.description, 'CTXAPI-459 description')
      should.equal(result.objectEsAr.description, 'CTXAPI-459 descripcion')
      // check properties
      should.deepEqual(mapProps(result.objectEnUs.properties), [
        {
          'label': 'String Prop',
          'name': 'c_string_label'
        },
        {
          'label': 'Any Prop',
          'name': 'c_any_label'
        },
        {
          'label': 'Bool Prop',
          'name': 'c_bool_label'
        },
        {
          'label': 'Date Prop',
          'name': 'c_date_label'
        },
        {
          'label': 'Document Prop',
          'name': 'c_document_label',
          'properties': [{
            'label': 'Sub String Prop',
            'name': 'c_sub_string_label'
          }]
        },
        {
          'label': 'Geometry Prop',
          'name': 'c_geo_label'
        },
        {
          'label': 'List Prop',
          'name': 'c_list_label'
        },
        {
          'label': 'Number Prop',
          'name': 'c_number_label'
        },
        {
          'label': 'ObjectId Prop',
          'name': 'c_objectid_label'
        },
        {
          'label': 'Reference Prop',
          'name': 'c_reference_label'
        },
        {
          'label': 'Set Prop',
          'name': 'c_set_label'
        },
        {
          'label': 'Binary Prop',
          'name': 'c_binary_label'
        },
        {
          'label': 'UUID Prop',
          'name': 'c_uuid_label'
        }
      ])
      should.deepEqual(mapProps(result.objectEnUs.objectTypes), [
        { label: 'Type A',
          name: 'c_type_a',
          properties: [
            { label: 'Type A Prop', name: 'c_type_a' }
          ]
        },
        { label: 'Type B',
          name: 'c_type_b',
          properties: [
            { label: 'Type B Prop', name: 'c_type_a' }
          ]
        }
      ])
      should.deepEqual(mapProps(result.objectEsAr.properties), [
        {
          'label': 'Prop Texto',
          'name': 'c_string_label'
        },
        {
          'label': 'Prop Cualquiera',
          'name': 'c_any_label'
        },
        {
          'label': 'Prop Boleana',
          'name': 'c_bool_label'
        },
        {
          'label': 'Prop Fecha',
          'name': 'c_date_label'
        },
        {
          'label': 'Prop Documento',
          'name': 'c_document_label',
          'properties': [{
            'label': 'Prop Sub Texto',
            'name': 'c_sub_string_label'
          }]
        },
        {
          'label': 'Prop Geometria',
          'name': 'c_geo_label'
        },
        {
          'label': 'Prop Lista',
          'name': 'c_list_label'
        },
        {
          'label': 'Prop Numero',
          'name': 'c_number_label'
        },
        {
          'label': 'Prop Id Objeto',
          'name': 'c_objectid_label'
        },
        {
          'label': 'Prop Referencia',
          'name': 'c_reference_label'
        },
        {
          'label': 'Prop Set',
          'name': 'c_set_label'
        },
        {
          'label': 'Prop Binaria',
          'name': 'c_binary_label'
        },
        {
          'label': 'Prop ID Unico',
          'name': 'c_uuid_label'
        }
      ])
      should.deepEqual(mapProps(result.objectEsAr.objectTypes), [
        { label: 'Tipo A',
          name: 'c_type_a',
          properties: [
            { label: 'Tipo Prop A', name: 'c_type_a' }
          ]
        },
        { label: 'Tipo B',
          name: 'c_type_b',
          properties: [
            { label: 'Tipo Prop B', name: 'c_type_a' }
          ]
        }
      ])

    })

  })

})
