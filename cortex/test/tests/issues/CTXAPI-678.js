const should = require('should'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules')

describe('Features - CTXAPI-678 Multiple faults on create account', function() {

  it('Should return one fault when register account without email', async() => {
    const newUserAgent = supertest.agent(server.api.expressApp),
          response = await newUserAgent
            .post(server.makeEndpoint('/accounts/register'))

            .set(server.getSessionHeaders())
            .send({
              password: 'myPa$$word123',
              mobile: '15055555555'
            })
    should.equal(response.body.faults.length, 1)
    should.equal(response.body.faults[0].errCode, 'cortex.invalidArgument.required')
    should.equal(response.body.faults[0].path, 'account.email')
  })

  it('Should return one fault when register account without username and org has it required', async() => {
    let newUserAgent, response
    const oldSettings = server.org.configuration.accounts

    await new Promise((resolve) => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableEmail': false,
          'configuration.accounts.enableUsername': true,
          'configuration.accounts.requireEmail': false,
          'configuration.accounts.requireUsername': true
        }
      }, () => {
        server.updateOrg(resolve)
      })
    })

    newUserAgent = supertest.agent(server.api.expressApp)
    response = await newUserAgent
      .post(server.makeEndpoint('/accounts/register'))
      .set(server.getSessionHeaders())
      .send({
        password: 'myPa$$word123',
        mobile: '15055555555'
      })

    should.equal(response.body.faults.length, 1)
    should.equal(response.body.faults[0].errCode, 'cortex.invalidArgument.required')
    should.equal(response.body.faults[0].path, 'account.username')

    await new Promise((resolve) => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.accounts.enableEmail': oldSettings.enableEmail,
          'configuration.accounts.enableUsername': oldSettings.enableUsername,
          'configuration.accounts.requireEmail': oldSettings.requireEmail,
          'configuration.accounts.requireUsername': oldSettings.requireUsername
        }
      }, () => {
        server.updateOrg(resolve)
      })
    })
  })
})
