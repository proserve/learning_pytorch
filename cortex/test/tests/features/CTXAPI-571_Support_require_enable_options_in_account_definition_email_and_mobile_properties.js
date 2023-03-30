const should = require('should'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed')

describe('Features - CTXAPI-571 Support require/enable options in account definition email and mobile properties', function() {

  let oldSettings

  before((callback) => {
    oldSettings = server.org.configuration.accounts
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.requireUsername': true,
        'configuration.accounts.requireEmail': true,
        'configuration.accounts.requireMobile': true
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after((callback) => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.accounts.requireUsername': oldSettings.requireUsername,
        'configuration.accounts.requireEmail': oldSettings.requireEmail,
        'configuration.accounts.requireMobile': oldSettings.requireMobile
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(sandboxed(function() {
    org.objects.accounts.deleteOne({ email: 'franco+withrequiredfields@medable.com' }).skipAcl().grant(8).execute()
  }))

  after(function() {
    // Call the reaper
    modules.workers.runNow('instance-reaper')
  })

  it('account with required parameters should be created successfully', async() => {
    /* global org */
    let code = function() {
          return org.objects.account.register({
            name: {
              first: 'Franco',
              last: 'Username'
            },
            email: 'franco+withrequiredfields@medable.com',
            username: 'francoUsername',
            mobile: '+15055555555'
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    const result = await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .then()

    should.equal(result.body.object, 'account')
    should.equal(result.body.email, 'franco+withrequiredfields@medable.com')
    should.equal(result.body.username, 'francoUsername')
    should.equal(result.body.mobile, '+15055555555')

  })

  it('validation error should be shown if account to be created is not including email', async() => {
    /* global org */
    let code = function() {
          return org.objects.account.register({
            name: {
              first: 'Franco',
              last: 'Username'
            },
            username: 'francoUsername2',
            mobile: '+15055555555'
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    const result = await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .then()

    should.equal(result.body.object, 'fault')
    should.equal(result.body.status, 400)
    should.equal(result.body.reason, 'Validation error.')
    should.equal(result.body.errCode, 'cortex.invalidArgument.validation')
    should.equal(result.body.code, 'kValidationError')
    should.equal(result.body.faults.length, 1)
    should.equal(result.body.faults[0].object, 'fault')
    should.equal(result.body.faults[0].name, 'validation')
    should.equal(result.body.faults[0].code, 'kRequired')
    should.equal(result.body.faults[0].errCode, 'cortex.invalidArgument.required')
    should.equal(result.body.faults[0].status, 400)
    should.equal(result.body.faults[0].reason, 'Required property')
    should.equal(result.body.faults[0].message, 'Please enter a value.')
    should.equal(result.body.faults[0].path, 'account.email')
  })

  it('validation error should be shown if account to be created is not including username', async() => {

    /* global org */
    let code = function() {
          return org.objects.account.register({
            name: {
              first: 'Franco',
              last: 'Username'
            },
            email: 'franco+nousername@medable.com',
            mobile: '+15055555555'
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    const result = await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .then()

    should.equal(result.body.object, 'fault')
    should.equal(result.body.status, 400)
    should.equal(result.body.reason, 'Validation error.')
    should.equal(result.body.errCode, 'cortex.invalidArgument.validation')
    should.equal(result.body.code, 'kValidationError')
    should.equal(result.body.faults.length, 1)
    should.equal(result.body.faults[0].object, 'fault')
    should.equal(result.body.faults[0].name, 'validation')
    should.equal(result.body.faults[0].code, 'kRequired')
    should.equal(result.body.faults[0].errCode, 'cortex.invalidArgument.required')
    should.equal(result.body.faults[0].status, 400)
    should.equal(result.body.faults[0].path, 'account.username')

  })

  it('validation error should be shown if account to be created is not including mobile', async() => {

    /* global org */
    let code = function() {
          return org.objects.account.register({
            name: {
              first: 'Franco',
              last: 'Username'
            },
            username: 'francoUsername3',
            email: 'franco+nomobile@medable.com'
          }, {
            skipVerification: true,
            skipActivation: true,
            skipNotification: true
          })
        },
        codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
        script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

    const result = await server.sessions.admin
      .post(server.makeEndpoint('/sys/script_runner'))
      .set(server.getSessionHeaders())
      .send(script)
      .then()

    should.equal(result.body.object, 'fault')
    should.equal(result.body.status, 400)
    should.equal(result.body.reason, 'Validation error.')
    should.equal(result.body.errCode, 'cortex.invalidArgument.validation')
    should.equal(result.body.code, 'kValidationError')
    should.equal(result.body.faults.length, 1)
    should.equal(result.body.faults[0].object, 'fault')
    should.equal(result.body.faults[0].name, 'validation')
    should.equal(result.body.faults[0].code, 'kRequired')
    should.equal(result.body.faults[0].errCode, 'cortex.invalidArgument.required')
    should.equal(result.body.faults[0].status, 400)
    should.equal(result.body.faults[0].reason, 'A mobile number is required.')
    should.equal(result.body.faults[0].message, 'Please enter a value.')
    should.equal(result.body.faults[0].path, 'account.mobile')

  })
})
