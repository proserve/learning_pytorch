'use strict'

const server = require('../../lib/server'),
      async = require('async'),
      consts = require('../../../lib/consts'),
      wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  main: function() {

    /* global script */

    // noinspection NpmUsedModulesInstalled
    const notifications = require('notifications');

    // send a bogus notification
    (function() {
      try {
        notifications.send('c_bogus')
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('internal notification should cause an error.')
    }())

    // send legit
    notifications.send('c_scripting_test', { var: 'text' })
    notifications.send('c_scripting_test', { var: 'text' }, { recipient: script.principal._id })
    notifications.send('c_scripting_test', { var: 'text' }, { recipient: script.principal.email })
    notifications.send('c_scripting_test', { var: 'text' }, { number: '16508611234' })

    notifications.send('c_scripting_test', { var: 'test' }) // legacy

    notifications.send('c_scripting_test', { var: 'test' }, { apnsTopics: ['app', 'voip'], fcmTopic: 'all', recipient: script.principal._id }) // legacy
    notifications.send('c_scripting_test', { var: 'test' }, { endpoints: { push: { template: 'message as template {{var1}}', apn: { topics: ['app'] } } } }) // define own endpoints
    notifications.send('c_scripting_test', { var: 'test' }, { endpoints: { email: { recipient: script.principal.email, template: null, message: 'testing', html: '<html><p>Plain Html<p></html>' } } }) // set html and not use template

    notifications.send({ var: 'test' }, { notification: 'c_scripting_test' }) // set a notification to use with that payload
    notifications.send({ var1: 'test', var2: 'test2' }, { notification: consts.emptyId, endpoints: { email: { template: null, message: 'testing', html: '<html></html>' } } }) // set a empty notification
    notifications.send({ var1: 'test', var2: 'test2' }, { endpoints: { push: { message: 'test', apn: { topics: ['app', 'voip'] } } } })
    notifications.send(new Date(), { endpoints: { push: { message: 'test', apn: { topics: ['app', 'voip'] } } } })
    notifications.send('Some cool string', { endpoints: { push: { message: 'test', apn: { topics: ['app', 'voip'] } } } });

    // invalid notification
    (function() {
      try {
        notifications.send('location-verification')
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('internal notification should cause an error.')
    }());

    // invalid recipient
    (function() {
      try {
        notifications.send('c_scripting_test', { var: 'text' }, { recipient: 'no good' })
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('invalid recipient should cause an error.')
    }());

    // send to built-in principal
    (function() {
      try {
        notifications.send('c_scripting_test', { var: 'text' }, { recipient: '000000000000000000000001' })
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('send to built-in principal should cause an error.')
    }());

    // missing recipient
    (function() {
      try {
        notifications.send('c_scripting_test', { var: 'text' }, { recipient: 'not_a_member@example.org' })
      } catch (err) {
        if (err.code === 'kNotFound') {
          return
        }
        throw err
      }
      throw new Error('missing recipient should cause an error.')
    }());

    // bad/missing number
    (function() {
      try {
        notifications.send('c_scripting_test', { var: 'text' }, { number: '+15555555555' })
      } catch (err) {
        if (err.code === 'kInvalidArgument') {
          return
        }
        throw err
      }
      throw new Error('bad/missing number should cause an error.')
    }());

    (function() {
      try {
        notifications.send({ var1: 'test', var2: 'test2' }, { endpoints: { push: { apn: { topics: ['app', 'voip'], priority: '7' } } } })
      } catch (err) {
        if (err.code === 'kInvalidArgument' && err.errCode === 'cortex.invalidArgument.string') {
          return
        }
        throw err
      }
      throw new Error('Priority only accepts 5 or 10 values')
    }());

    (function() {
      try {
        notifications.send({ var1: 'test', var2: 'test2' })
      } catch (err) {
        if (err.code === 'kInvalidObject' && err.errCode === 'cortex.invalidArgument.object') {
          return
        }
        throw err
      }
      throw new Error('Endpoints is required for no template notifications')
    }())

    // blow limit.
    try {
      while (1) {
        notifications.send('c_scripting_test')
      }
    } catch (err) {
      if (!~(err.reason || '').indexOf('Max notifications')) {
        throw new Error('notification limit should have been breached.')
      }
    }

    return true
  },

  before: function(ac, model, callback) {

    async.series([

      // create a test template
      callback => {

        server.sessions.admin
          .post(server.makeEndpoint('/templates/email'))
          .set(server.getSessionHeaders())
          .send({ name: 'c_scripting_test', summary: 'scripting_test', label: 'scripting_test', partial: false })
          .done(callback)
      },

      // add some template content
      callback => {

        server.sessions.admin
          .put(server.makeEndpoint('/templates/en_US/email/c_scripting_test?activate=false&edit=0'))
          .set(server.getSessionHeaders())
          .send([{ 'name': 'subject', 'data': 'Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
          .done(callback)
      },

      // create a custom notification
      callback => {

        server.sessions.admin
          .post(server.makeEndpoint('/orgs/' + ac.orgId + '/configuration/notifications'))
          .set(server.getSessionHeaders())
          .send({ label: 'scripting_test', name: 'scripting_test', endpoints: [{ eid: '456e64706f696e7420456d6c', state: 'Enabled', template: 'c_scripting_test' }], duplicates: false, persists: false })
          .done(callback)

      },

      // create custom number
      callback => {

        server.sessions.admin
          .post(server.makeEndpoint('/orgs/' + ac.orgId + '/configuration/sms/numbers'))
          .set(server.getSessionHeaders())
          .send([{ 'provider': 'twilio', 'number': '+16508611234', 'accountSid': '12345', 'authToken': '12345', 'isDefault': true }])
          .done(callback)

      },

      // re-read the org
      callback => {

        server.updateOrg(err => {

          if (!err) {

            // update the limit so we can blow it up
            ac.org.configuration.scripting.maxNotifications = 25

            // enable custom notifications
            ac.org.configuration.scripting.enableCustomSms = true
          }
          callback(err)
        })

      }

    ], callback)

  }

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
