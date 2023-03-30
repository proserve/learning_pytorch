'use strict'

/* global before */

const server = require('../../lib/server'),
      supertest = require('supertest'),
      should = require('should'),
      async = require('async'),
      { v4 } = require('uuid'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      models = modules.db.models,
      utils = require('../../../lib/utils'),
      acl = require('../../../lib/acl'),
      request = require('request')

server.usingMedia = true

describe('Rest Api - Connections', function() {

  let connectionDoc, connectionInstance

  before(function(callback) {

    const mochaCurrentTestUuid = server.mochaCurrentTestUuid = v4()

    require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

      if (err) return callback(err)

      let handler,
          timeoutId = null

      const doneTest = err => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        server.events.removeListener('worker.emailer', handler)
        if (callback) {
          callback(err)
          callback = null
        }
      }

      handler = (error, email, message, payload, options) => {
        if (message.mochaCurrentTestUuid === mochaCurrentTestUuid) {
          let err
          try {
            email.personalizations[0].to.length.should.equal(1)
            email.personalizations[0].to[0].email.should.equal(server.principals.provider.email, 'email recipient should match target')
          } catch (e) {
            err = e
          }
          doneTest(err || error)
        }
      }
      server.events.on('worker.emailer', handler)

      timeoutId = setTimeout(() => {
        doneTest(new Error('connection creation timed out waiting for emailer.'))
      }, 20000)

      server.sessions.admin
        .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
        .set(server.getSessionHeaders())
        .send({ targets: [{ access: acl.AccessLevels.Connected, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
        .done(function(err, result) {
          try {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)
            connectionDoc = result.data[0]
            models.connection.findOne({ _id: connectionDoc._id }, (err, instance) => {
              connectionInstance = instance
              if (err) {
                doneTest(err)
              }
            })

          } catch (e) {
            doneTest(e)
          }
        })
    })

  })

  describe('POST /connections', function() {

    it('should fail to create a connection for object not allowing connections', function(callback) {
      async.eachSeries(['exports', 'deployments', 'views', 'scripts', 'objects'], (pluralName, callback) => {
        server.sessions.admin
          .post(server.makeEndpoint('/' + pluralName + '/' + utils.createId() + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ object: 'account', email: 'nobody@example.com' }] })
          .done(function(err, result) {
            should.exist(err)
            should.equal(err.errCode, 'cortex.accessDenied.connectionsDisabled')
            callback()
          })
      }, callback)
    })

    it('should fail for unverified account', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {
        if (err) return callback(err)
        instanceAc.object.aclCreate(server.principals.unverified, { c_name: 'B-Hoozit' }, (err, { ac: localAc }) => {
          if (err) return callback(err)
          server.sessions.unverified
            .post(server.makeEndpoint('/' + localAc.object.pluralName + '/' + localAc.subjectId + '/connections'))
            .set(server.getSessionHeaders())
            .send({
              targets: [{
                access: acl.AccessLevels.Connected,
                object: 'account',
                _id: server.principals.provider._id,
                name: { first: 'Hunky', last: 'Dory' }
              }]
            })
            .done(function(err, result) {
              should.exist(err)
              should.equal(err.errCode, 'cortex.accessDenied.connectionRequiresVerification')
              callback()
            })
        })
      })
    })

    it('should complain about self-connection', function(callback) {

      server.sessions.provider
        .post(server.makeEndpoint('/accounts/' + server.principals.provider._id + '/connections'))
        .set(server.getSessionHeaders())
        .send({
          targets: [{
            access: acl.AccessLevels.Connected,
            object: 'account',
            _id: server.principals.provider._id,
            name: { first: 'Hunky', last: 'Dory' }
          }]
        })
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.errCode, 'cortex.invalidArgument.connectionTarget')
          should.equal(err.path, 'self')
          callback()
        })

    })

    it('should complain about various invalid targets', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        // create a connection using various valid and invalid targets.
        const targets = [
          {
            data: [null], // null target
            fault: {
              errCode: 'cortex.invalidArgument.connectionTarget'
            }
          },
          {
            data: { // a valid account target
              object: 'account',
              _id: server.principals.provider._id,
              access: acl.AccessLevels.Connected
            }
          },
          {
            data: { // a email account target
              object: 'account',
              email: 'someone@example.com'
            }
          },
          {
            data: { // an invalid email address
              object: 'account',
              email: 'nerf-herder'
            },
            fault: {
              errCode: 'cortex.invalidArgument.connectionTarget'
            }
          },
          {
            data: { // set invalid auto connection property
              object: 'account',
              email: 'someone-else@example.com',
              auto: true
            },
            fault: {
              errCode: 'cortex.invalidArgument.autoConnectionRequiresId'
            }
          },
          {
            data: { // set invalid auto connection property
              object: 'account',
              _id: server.principals.provider._id,
              auto: true
            },
            fault: {
              errCode: 'cortex.invalidArgument.requireConnectionAccept'
            }
          },
          {
            data: { // roles aren't valid targets.
              object: 'role',
              _id: acl.OrgAdminRole
            },
            fault: {
              errCode: 'cortex.invalidArgument.connectionTarget'
            }
          }, {
            data: [{ // multiple account targets. some of which do not exist.
              object: 'account',
              _id: server.principals.provider._id
            }, {
              object: 'account',
              _id: utils.createId()
            }, {
              object: 'account',
              _id: utils.createId()
            }],
            fault: {
              errCode: 'cortex.notFound.account'
            }
          }, {
            data: [{ // send doubles
              object: 'account',
              _id: server.principals.patient._id,
              access: acl.AccessLevels.Delete
            }, {
              object: 'account',
              _id: server.principals.patient._id,
              access: acl.AccessLevels.Connected
            }]
          }

        ]

        async.eachSeries(targets, (target, callback) => {

          server.sessions.admin
            .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
            .set(server.getSessionHeaders())
            .send({ targets: target.data })
            .done(function(err, result) {
              if (target.fault) {
                should.exist(err)
                should.equal(err.errCode, target.fault.errCode)
              } else {
                should.not.exist(err)
              }
              callback()
            })

        }, callback)

      })

    })

    it('should fail without share access account', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {
        if (err) return callback(err)
        instanceAc.object.aclCreate(server.principals.unverified, { c_name: 'B-Hoozit' }, (err, { ac: localAc }) => {
          if (err) return callback(err)
          server.sessions.provider
            .post(server.makeEndpoint('/' + localAc.object.pluralName + '/' + localAc.subjectId + '/connections'))
            .set(server.getSessionHeaders())
            .send({
              targets: [{
                access: acl.AccessLevels.Connected,
                object: 'account',
                _id: server.principals.provider._id,
                name: { first: 'Hunky', last: 'Dory' }
              }]
            })
            .done(function(err, result) {
              should.exist(err)
              should.equal(err.errCode, 'cortex.accessDenied.shareAccess')
              callback()
            })
        })
      })
    })

    it('should fail without targets', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {
        if (err) return callback(err)
        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({})
          .done(function(err) {
            should.exist(err)
            should.equal(err.errCode, 'cortex.invalidArgument.noConnectionTargets')
            callback()
          })
      })
    })
  })

  describe('GET /connections', function() {

    it('should list all target\'s connections', function(callback) {

      // as provider to which the above test connection was created.
      server.sessions.provider
        .get(server.makeEndpoint('/connections'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'list')
          result.data.length.should.be.greaterThan(0)
          callback()
        })
    })

    it('should list all sender\'s connections', function(callback) {

      // as admin which created the connection.
      server.sessions.admin
        .get(server.makeEndpoint('/connections'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'list')
          result.data.length.should.be.greaterThan(0)

          callback()
        })
    })

  })

  describe('GET /connections/:token', function() {

    it('should load the connection as the target', function(callback) {

      server.sessions.provider
        .get(server.makeEndpoint('/connections/' + connectionInstance.token))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'connection')
          result._id.should.equal(connectionDoc._id)
          callback()
        })
    })

    it('should load the connection as anonymous', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance.token))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'connection')
          result._id.should.equal(connectionDoc._id)
          callback()
        })
    })

    it('should fail to load the connection as someone else', function(callback) {

      server.sessions.patient
        .get(server.makeEndpoint('/connections/' + connectionInstance.token))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.errCode, 'cortex.invalidArgument.connectionToken')
          callback()
        })
    })

    it('should fail to load the connection as the sender', function(callback) {

      server.sessions.admin
        .get(server.makeEndpoint('/connections/' + connectionInstance.token))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.errCode, 'cortex.invalidArgument.connectionToken')
          callback()
        })
    })

  })

  describe('GET /connections/:id', function() {

    it('should load the connection as the target', function(callback) {
      server.sessions.provider
        .get(server.makeEndpoint('/connections/' + connectionInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'connection')
          result._id.should.equal(connectionDoc._id)
          callback()
        })
    })

    it('should load the connection as the sender', function(callback) {
      server.sessions.admin
        .get(server.makeEndpoint('/connections/' + connectionInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'connection')
          result._id.should.equal(connectionDoc._id)
          callback()
        })
    })

    it('should load the connection as the sender', function(callback) {
      server.sessions.admin
        .get(server.makeEndpoint('/connections/' + connectionInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'connection')
          result._id.should.equal(connectionDoc._id)
          callback()
        })
    })

    it('should fail to load the connection anonymous', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should fail to load the connection as someone else', function(callback) {

      server.sessions.patient
        .get(server.makeEndpoint('/connections/' + connectionInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

  })

  describe('GET /connections/:token/*', function() {

    it('should stream a file property', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Share, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)

            models.connection.findOne({ _id: result.data[0]._id }, (err, instance) => {

              should.not.exist(err)
              server.sessions.provider
                .get(server.makeEndpoint('/connections/' + instance.token + '/context/c_file/content'))
                .set({ 'Accept': 'text/plain' })
                .set(server.getSessionHeaders())
                .done(function(err, result, response) {
                  // c_file requires read access. we were given share access
                  should.not.exist(err)
                  should.exist(response.headers.location)
                  request(response.headers.location, (err, response) => {
                    should.not.exist(err)
                    should.equal(response.body, 'Testy')
                    callback()
                  })
                })
            })

          })

      })

    })

    it('should load a shared custom property', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance.token + '/context/c_custom'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, 'custom')
          callback()
        })
    })

    it('should fail to load a primitive property requiring greater access', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance.token + '/context/c_must_have_read'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should fail to load a document property requiring greater access', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance.token + '/context/c_must_have_read_doc'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

  })

  describe('GET /connections/:id/*', function() {

    it('should load a shared custom property', function(callback) {

      server.sessions.provider
        .get(server.makeEndpoint('/connections/' + connectionInstance._id + '/context/c_custom'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, 'custom')
          callback()
        })
    })

    it('should fail to load as anonymous', function(callback) {

      supertest(server.api.expressApp)
        .get(server.makeEndpoint('/connections/' + connectionInstance._id + '/context/c_must_have_read'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should fail to load a primitive property requiring greater access', function(callback) {

      server.sessions.provider
        .get(server.makeEndpoint('/connections/' + connectionInstance._id + '/context/c_must_have_read'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should fail to load a document property requiring greater access', function(callback) {

      server.sessions.provider
        .get(server.makeEndpoint('/connections/' + connectionInstance._id + '/context/c_must_have_read_doc'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should fail to load a property as another user', function(callback) {

      server.sessions.patient
        .get(server.makeEndpoint('/connections/' + connectionInstance._id + '/context/c_custom'))
        .set(server.getSessionHeaders())
        .done(function(err, result) {
          should.exist(err)
          should.equal(err.code, 'kAccessDenied')
          callback()
        })
    })

    it('should stream a file property', function(callback) {

      require('../../lib/create.streamable')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Share, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)

            should.not.exist(err)
            server.sessions.provider
              .get(server.makeEndpoint('/connections/' + result.data[0]._id + '/context/c_file/content'))
              .set({ 'Accept': 'text/plain' })
              .set(server.getSessionHeaders())
              .done(function(err, result, response) {
                // c_file requires read access. we were given share access
                should.not.exist(err)
                should.exist(response.headers.location)
                request(response.headers.location, (err, response) => {
                  should.not.exist(err)
                  should.equal(response.body, 'Testy')
                  callback()
                })
              })

          })

      })

    })
  })

  describe('DELETE /connections/:token', function() {

    it('should remove the connection', function(callback) {

      server.sessions.provider
        .delete(server.makeEndpoint('/connections/' + connectionInstance.token))
        .set(server.getSessionHeaders())
        .done(function(err, result) {

          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, true)

          models.connection.findOne({ _id: connectionDoc._id }, (err, instance) => {
            should.not.exist(instance)
            callback(err)
          })

        })
    })

  })

  describe('DELETE /connections/:id', function() {

    let localInstance

    before(function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        if (err) return callback(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Connected, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)
            models.connection.findOne({ _id: result.data[0]._id }, (err, instance) => {
              localInstance = instance
              callback(err)
            })

          })
      })

    })

    it('should remove the connection', function(callback) {

      server.sessions.provider
        .delete(server.makeEndpoint('/connections/' + localInstance._id))
        .set(server.getSessionHeaders())
        .done(function(err, result) {

          should.not.exist(err)
          should.exist(result)
          should.equal(result.object, 'result')
          should.equal(result.data, true)

          models.connection.findOne({ _id: localInstance._id }, (err, instance) => {
            should.not.exist(instance)
            callback(err)
          })

        })

    })

  })

  describe('POST /connections/:token', function() {

    it('should fail using an id', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Connected, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)
            models.connection.findOne({ _id: result.data[0]._id }, (err, instance) => {
              should.not.exist(err)

              server.sessions.provider
                .post(server.makeEndpoint('/connections/' + instance._id))
                .set(server.getSessionHeaders())
                .done(function(err, result) {
                  should.exist(err)
                  should.equal(err.errCode, 'cortex.invalidArgument.object')
                  callback()
                })
            })

          })
      })

    })

    it('should apply the connection', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Connected, object: 'account', _id: server.principals.provider._id, name: { first: 'Hunky', last: 'Dory' } }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)
            models.connection.findOne({ _id: result.data[0]._id }, (err, instance) => {
              should.not.exist(err)

              server.sessions.provider
                .post(server.makeEndpoint('/connections/' + instance.token))
                .set(server.getSessionHeaders())
                .done(function(err, result) {

                  should.not.exist(err)
                  should.exist(result)
                  should.equal(result.object, 'connection')

                  models.connection.findOne({ _id: instance._id }, (err, instance) => {
                    should.not.exist(err)
                    should.exist(instance)
                    should.equal(instance.state, consts.connectionStates.active)

                    instanceAc.object.aclReadOne(server.principals.provider, instance.context._id, (err, result, ac) => {
                      should.not.exist(err)
                      should.exist(ac)
                      should.equal(ac.resolved, instance.access)
                      callback()
                    })

                  })

                })

            })

          })
      })

    })

    it('should fail to apply for unverified account', function(callback) {

      require('../../lib/create.custom')(new acl.AccessContext(server.principals.admin), (err, instanceAc) => {

        should.not.exist(err)

        server.sessions.admin
          .post(server.makeEndpoint('/' + instanceAc.object.pluralName + '/' + instanceAc.subjectId + '/connections'))
          .set(server.getSessionHeaders())
          .send({ targets: [{ access: acl.AccessLevels.Connected, object: 'account', _id: server.principals.unverified._id }] })
          .done(function(err, result) {

            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length, 1)
            should.equal(result.data[0].object, 'connection')
            should.equal(result.data[0].state, consts.connectionStates.pending)
            models.connection.findOne({ _id: result.data[0]._id }, (err, instance) => {
              should.not.exist(err)

              server.sessions.unverified
                .post(server.makeEndpoint('/connections/' + instance.token))
                .set(server.getSessionHeaders())
                .done(function(err, result) {

                  should.exist(err)
                  should.equal(err.errCode, 'cortex.accessDenied.connectionRequiresVerification')
                  callback()

                })

            })

          })
      })

    })

  })

})
