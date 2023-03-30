'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised, sleep } = require('../../../lib/utils'),
      server = require('../../lib/server')

let namespacedNotification

describe('Issues - CTXAPI-574 - Namespaced notifications', function() {

  before(async function() {
    let result

    // create a test template
    result = await server.sessions.admin
      .post(server.makeEndpoint('/templates/email'))
      .set(server.getSessionHeaders())
      .send({
        name: 'c_ctxapi_574_template',
        summary: 'c_ctxapi_574_template',
        label: 'c_ctxapi_574_template',
        partial: false
      })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)

    // add some template content
    result = await server.sessions.admin
      .put(server.makeEndpoint('/templates/en_US/email/c_ctxapi_574_template?activate=false&edit=0'))
      .set(server.getSessionHeaders())
      .send([
        {
          'name': 'subject',
          'data': 'Subject'
        }, {
          'name': 'plain',
          'data': 'Hello {{{name}}}!'
        }, {
          'name': 'html',
          'data': `<h1>Today is {{date}}</h1><div>Hi {{name}}! This is a test, do not worry!</div>`
        }
      ])
      .then()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)

    // create a custom notification
    result = await server.sessions.admin
      .post(server.makeEndpoint('/orgs/' + server.org._id + '/configuration/notifications'))
      .set(server.getSessionHeaders())
      .send({
        label: 'ns__ctxapi_574_notification',
        name: 'ns__ctxapi_574_notification',
        endpoints: [{
          eid: '456e64706f696e7420456d6c',
          state: 'Enabled',
          template: 'c_ctxapi_574_template'
        }],
        duplicates: false,
        persists: false
      })
      .then()

    should.exist(result)
    should.exist(result.body)
    should.not.exist(result.body.errCode)
    should.exist(result.body.data)

    namespacedNotification = result.body.data.find(n => n.name === 'ns__ctxapi_574_notification')
    should.exist(namespacedNotification)
  })

  after(async function() {
    let result = await server.sessions.admin
      .delete(server.makeEndpoint(`/orgs/${server.org._id}/configuration/notifications/${namespacedNotification._id}`))
      .set(server.getSessionHeaders())
      .then()

    should.exist(result)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, true)

    result = await server.sessions.admin
      .delete(server.makeEndpoint('/templates/email/c_ctxapi_574_template'))
      .set(server.getSessionHeaders())
      .then()

    should.exist(result)
    should.not.exist(result.body.errCode)
    should.equal(result.body.object, 'result')
    should.equal(result.body.data, true)
  })

  it('should send a namespaced notification', async function() {
    let result

    result = await subscribeAndWaitFor(function() {
      const notifications = require('notifications'),
            notificationData = {
              name: 'Paul',
              date: 'Thursday'
            }

      return notifications.send(
        'ns__ctxapi_574_notification',
        notificationData,
        {
          recipient: 'james+admin@medable.com'
        }
      )
    })

    should.exist(result)
    should.not.exist(result.errCode)

    should.equal(result.personalizations.length, 1)
    should.equal(result.personalizations[0].subject, 'Subject')
    should.equal(result.personalizations[0].to[0].email, 'james+admin@medable.com')

    should.equal(result.from.email, 'noreply@medable.com')
    should.equal(result.from.name, 'Test Unit Organization')

    should.equal(result.content.length, 2)
    should.equal(result.content[0].type, 'text/plain')
    should.equal(result.content[0].value, 'Hello Paul!')

    should.equal(result.content[1].type, 'text/html')
    should.equal(result.content[1].value, '<h1>Today is Thursday</h1><div>Hi Paul! This is a test, do not worry!</div>')
  })
})

async function subscribeAndWaitFor(sandboxFunction) {
  let done = false,
      data = null,
      err

  const handler = (error, body) => {
    done = true
    err = error
    data = body
  }

  server.events.on('worker.emailer', handler)

  await promised(null, sandboxed(sandboxFunction))

  while (!done) { // eslint-disable-line no-unmodified-loop-condition
    await sleep(250)
  }

  server.events.removeListener('worker.emailer', handler)

  if (err) {
    return err
  }

  return data
}
