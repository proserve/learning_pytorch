const should = require('should'),
      supertest = require('supertest'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules')

describe('Features - CTXAPI-542 Username Accounts', function() {

  let oldSettings

  before((callback) => {
    oldSettings = server.org.configuration.accounts
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableEmail': true,
        'configuration.accounts.enableUsername': true,
        'configuration.accounts.requireEmail': false,
        'configuration.accounts.requireUsername': true
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after((callback) => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.enableEmail': oldSettings.enableEmail,
        'configuration.accounts.enableUsername': oldSettings.enableUsername,
        'configuration.accounts.requireEmail': oldSettings.requireEmail,
        'configuration.accounts.requireUsername': oldSettings.requireUsername
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(sandboxed(function() {
    /* global org */
    org.objects.accounts.deleteOne({ username: 'tong4$' }).skipAcl(true).grant('script').execute()
  }))

  it('create account using username', async() => {

    const newUserAgent = supertest.agent(server.api.expressApp),
          response = await newUserAgent
            .post(server.makeEndpoint('/accounts/register'))
            .set(server.getSessionHeaders())
            .send({
              name: {
                first: 'Test',
                last: 'Test'
              },
              username: 'tong4$',
              password: 'myPa$$word123',
              mobile: '15055555555'
            }),

          result = await newUserAgent
            .post(server.makeEndpoint('/accounts/login'))
            .set(server.getSessionHeaders())
            .send({
              username: response.body.username,
              password: 'myPa$$word123'
            })
    should.equal(result.body.username, response.body.username)
    should.exist(result.header['set-cookie'])

  })
})
