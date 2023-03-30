'use strict'

/* global before */

const server = require('../../lib/server'),
      should = require('should'),
      async = require('async'),
      modules = require('../../../lib/modules'),
      utils = require('../../../lib/utils'),
      acl = require('../../../lib/acl')

server.usingMedia = true

describe('Rest Api', function() {

  describe('Notifications', function() {

    let testInstance, ac, StreamableObject, currentNotification

    before(function(callback) {

      ac = new acl.AccessContext(server.principals.admin)

      async.series([

        // create an object for which persistent notifications can be attached
        callback => {
          require('../../lib/create.streamable')(ac, (err, instanceAc) => {
            StreamableObject = instanceAc.object
            callback(err)
          })
        },

        // create a test template
        callback => {

          server.sessions.admin
            .post(server.makeEndpoint('/templates/email'))
            .set(server.getSessionHeaders())
            .send({ name: 'c_notifications_rest_api_test', summary: 'c_notifications_rest_api_test', label: 'c_notifications_rest_api_test', partial: false })
            .done(callback)
        },

        // add some template content
        callback => {

          server.sessions.admin
            .put(server.makeEndpoint('/templates/en_US/email/c_notifications_rest_api_test?activate=true&edit=0'))
            .set(server.getSessionHeaders())
            .send([{ 'name': 'subject', 'data': 'Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
            .done(callback)
        },

        // create a custom notification
        callback => {

          server.sessions.admin
            .post(server.makeEndpoint('/orgs/' + ac.orgId + '/configuration/notifications'))
            .set(server.getSessionHeaders())
            .send({ label: 'c_notifications_rest_api_test', name: 'c_notifications_rest_api_test', endpoints: [{ eid: '456e64706f696e7420456d6c', state: 'Enabled', template: 'c_notifications_rest_api_test' }], duplicates: false, persists: true })
            .done(callback)

        },

        // re-read the org to store the new notifications.
        callback => {
          server.updateOrg(callback)
        },

        // create an instance to which we'll attach notifications.
        callback => {

          server.sessions.admin
            .post(server.makeEndpoint('/c_script_mod_obj_stream_tests'))
            .set(server.getSessionHeaders())
            .send({ c_label: 'this is for notifications' })
            .done(function(err, result) {
              should.not.exist(err)
              testInstance = result
              callback()
            })
        },

        // persist a few notifications
        callback => {

          const type = server.org.configuration.notifications.filter(n => n.name === 'c_notifications_rest_api_test')[0],
                id = utils.getIdOrNull(testInstance._id)

          // should end up with 6 good notifications for testing (note one of them uses duplicate: true to allow duplicates)
          async.series([
            // invalid notification type.
            callback => modules.notifications.persist('invalid id', ac.principalId, ac.orgId, StreamableObject.objectName, id, err => {
              should.exist(err)
              should.equal(err.code, 'kInvalidArgument')
              callback()
            }),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'a' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'b' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'c' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'd' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'd' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: false, meta: 'e' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, { duplicate: true, meta: 'e' }, callback),
            callback => modules.notifications.persist(type._id, ac.principalId, ac.orgId, StreamableObject.objectName, id, callback)
          ], callback)

        },

        // cover some controller cases we can't see from the rest api. this is more to satisfy code coverage
        callback => {

          modules.notifications.acknowledgeOnOrBefore()
          modules.notifications.acknowledgePostOnOrBefore(server.principals.admin, [utils.createId()])
          modules.notifications.acknowledgePostOnOrBefore()
          modules.notifications.acknowledgeCommentOnOrBefore(server.principals.admin, [utils.createId()])
          modules.notifications.acknowledgeAllOnOrBefore(server.principals.admin, null, 'not an object')
          modules.notifications.acknowledgeAllOnOrBefore(server.principals.admin, 'bad type')
          modules.notifications.acknowledgeId()
          callback()
        }

      ], callback)

    })

    describe('GET /notifications', function() {

      it('should list all notifications', function(callback) {
        server.sessions.admin
          .get(server.makeEndpoint('/notifications'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.equal(result.data.length >= 6, true)
            currentNotification = result.data[0]
            callback()
          })
      })

    })

    describe('DELETE /notifications/:id', function() {

      it('should delete a notification', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/' + currentNotification._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.equal(result.data, 1)
            callback()
          })
      })

      it('should not delete a missing notification', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/' + currentNotification._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            should.equal(result.data, 0)
            callback()
          })
      })

    })

    describe('DELETE /notifications/posts', function() {

      it('should delete post notifications for selected post types', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/posts?postTypes[]=test'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

      it('should delete all post notifications', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/posts'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

    })

    describe('DELETE /notifications/comments', function() {

      it('should delete post notifications for selected comments', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/comments?ids[]=bogus_id'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

      it('should delete all comments notifications', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/comments'))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

    })

    describe('DELETE /notifications/:objects?/contextId?', function() {

      it('should delete notifications for selected objects', function(callback) {

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/' + StreamableObject.pluralName))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

      it('should delete notifications for selected context', function(callback) {

        const type = server.org.configuration.notifications.filter(n => n.name === 'c_notifications_rest_api_test')[0]

        server.sessions.admin
          .delete(server.makeEndpoint('/notifications/' + StreamableObject.pluralName + '/' + testInstance._id + '?type=' + type._id))
          .set(server.getSessionHeaders())
          .done(function(err, result) {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'result')
            callback()
          })
      })

    })

  })

})
