'use strict'

/* global before, after */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep, createId } = require('../../../lib/utils'),
      consts = require('../../../lib/consts')

let httpReqStore = null,
    apiHost = null

describe('Rest Api', function() {

  describe('Deployment', function() {

    before(function(done) {

      // In order to communicate between orgs during testing we must replace the httpRequest function in
      // modules.deployments. This we we don't have to resolve any hostnames and we can use supertest.

      apiHost = config('server.apiHost')
      httpReqStore = modules.deployment._httpRequest

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

      done()

    })

    after(function() {

      modules.deployment._httpRequest = httpReqStore
    })

    it('Should deploy from env A to env B successfully', function(callback) {

      const giveUpSeconds = 120

      // Deployments can take a long time and timeout
      this.timeout(giveUpSeconds * 1000)

      let orgData,
          targetId,
          sourceId,
          deploymentId

      async.series(
        [
        // create env B
          callback => {
            require('../../lib/create.org')('New Deployment Org', 'new-deployment-org', (err, result) => {
              if (!err) {
                orgData = result
              }
              callback(err)
            })
          },
          // add deployment items
          callback => {
            require('../../lib/create.deployment.items')((err) => {
              callback(err)
            })
          },
          // add target from org 1 to org 2
          callback => {
            server.sessions.admin
              .post(server.makeEndpoint('/orgs/' + server.org._id + '/deployment/targets'))
              .set(server.getSessionHeaders())
              .send({ 'server': apiHost, 'code': orgData.org.code })
              .done(function(err, result) {
                result.data.length.should.equal(1)
                callback(err)
              })
          },
          // get the targets list for org 1
          callback => {
            server.sessions.admin
              .get(server.makeEndpoint('/orgs/' + server.org._id + '/deployment/targets'))
              .set(server.getSessionHeaders())
              .done(function(err, result) {
                result.data.length.should.equal(1)
                targetId = createId(result.data[0]._id)
                callback(err)
              })
          },
          // get list of sources from org 2
          callback => {
            orgData.session
              .get('/' + orgData.org.code + '/orgs/' + orgData.org._id + '/deployment/sources')
              .set(orgData.getSessionHeaders())
              .done(function(err, result) {
                result.data.length.should.equal(1)
                result.data[0].state.should.equal('Pending')
                sourceId = createId(result.data[0]._id)
                callback(err)
              })

          },
          // Accept org 1 as a source
          (callback) => {
            orgData.session
              .put('/' + orgData.org.code + '/orgs/' + orgData.org._id + '/deployment/sources/' + sourceId)
              .set(orgData.getSessionHeaders())
              .send({ state: 'Active' })
              .done(function(err, result) {
                result.data.state.should.equal('Active')
                callback(err)
              })

          },
          // create Deployment
          callback => {
            let deployment = {
              label: 'Test Deployment',
              description: 'Dep',
              target: targetId,
              giveUpSeconds,
              scripts: {
                before: '',
                after: '',
                rollback: '',
                result: ''
              },
              configuration: {
                obj: {
                  select: 0,
                  ids: []
                },
                scr: {
                  select: 0,
                  ids: []
                },
                viw: {
                  select: 0,
                  ids: []
                },
                sva: {
                  select: 0,
                  ids: []
                },
                tpl: {
                  select: 0,
                  ids: []
                },
                ntf: {
                  select: 0,
                  ids: []
                },
                rle: {
                  select: 0,
                  ids: []
                },
                pol: {
                  select: 0,
                  ids: []
                },
                sms: {
                  select: 0,
                  ids: []
                },
                app: {
                  select: 0,
                  ids: [],
                  preserveCerts: false
                }
              }
            }
            server.sessions.admin
              .post(server.makeEndpoint('/deployments?include[]=mappings'))
              .set(server.getSessionHeaders())
              .send(deployment)
              .done(function(err, result) {
                should.not.exist(err)
                deploymentId = createId(result._id)
                callback(err)
              })
          },
          // auth against org 2
          callback => {
            server.sessions.admin
              .post(server.makeEndpoint('/deployments/source/authenticate/' + deploymentId))
              .set(server.getSessionHeaders())
              .send({ loginAs: '', email: server.principals.admin.email, password: server.password })
              .done(function(err) {
                should.not.exist(err)
                callback(err)
              })
          },
          // establish mappings and perform deployment
          async() => {

            let done = false,
                err = null

            const testId = server.mochaCurrentTestUuid,
                  handler = (message, e) => {
                    if (message.worker === 'deployer' && message.mochaCurrentTestUuid === testId) {
                      done = true
                      err = e
                    }
                  }

            server.events.on('worker.done', handler)

            await promised(null, sandboxed(function() {

              const {
                      CortexObject,
                      org: {
                        objects: {
                          Deployments
                        }
                      },
                      script: {
                        arguments: {
                          deploymentId,
                          email,
                          password
                        }
                      }
                    } = global,
                    dep = CortexObject.from(Deployments.find({ _id: deploymentId }).next()),
                    auth = dep.authenticate({ email, password })

              dep.guessMappings(auth, { force: true })
              dep.deploy(auth)

            }, {
              runtimeArguments: {
                deploymentId,
                email: server.principals.admin.email,
                password: server.password
              }
            }))

            while (!done) { // eslint-disable-line no-unmodified-loop-condition
              await sleep(250)
            }
            server.events.removeListener('worker.done', handler)

            if (!err) {

              // look for a deployment error.
              const result = (await modules.db.models.Log.collection
                .find({
                  org: orgData.org._id,
                  src: consts.logs.sources.deployment,
                  lvl: consts.logs.levels.error,
                  dpl: deploymentId
                })
                .toArray())[0]

              if (result && result.err) {
                err = Fault.create(result.err)
              }

            }

            if (err) {
              throw err
            }

          }

        ],
        callback
      )

    })
  })
})
