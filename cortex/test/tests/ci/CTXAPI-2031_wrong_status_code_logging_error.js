'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { sleep, createId } = require('../../../lib/utils'),
      server = require('../../lib/server'),
      consts = require('../../../lib/consts'),
      modules = require('../../../lib/modules'),
      should = require('should'),
      callScriptRunner = async function(code) {
        const codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim(),
              script = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        return server.sessions.admin
          .post(server.makeEndpoint('/sys/script_runner'))
          .set(server.getSessionHeaders())
          .send(script)
          .then()
      }

describe('CTXAPI-2031 - Wrong status code and missing error object when logging failed requests', function() {

  before(sandboxed(function() {
    global.org.objects.objects.insertOne({
      name: 'c_ctxapi_2031_object',
      label: 'CTXAPI-2031 Test Object',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_string',
        label: 'String',
        type: 'String',
        indexed: true
      }]
    }).execute()
  }))

  before(async function() {
    const account = await callScriptRunner(function() {
      /* global org */
      const email = 'ctxapi2031+admin@medable.com'

      org.objects.account.register({
        name: {
          first: 'Admin',
          last: 'Test'
        },
        email: email,
        mobile: '15055555555',
        roles: [consts.roles.Administrator]
      }, {
        skipVerification: true,
        skipActivation: true,
        skipNotification: true,
        requireMobile: false
      })

      return org.objects.account.find({ email: email }).skipAcl().grant(consts.accessLevels.read).next()
    })

    should.exist(account)
  })

  after(sandboxed(function() {
    global.org.objects.objects.deleteOne({ name: 'c_ctxapi_2031_object' }).execute()
    global.org.objects.accounts.deleteOne({ email: 'ctxapi2031+admin@medable.com' }).skipAcl().grant(8).execute()
  }))

  it('should log the right status code and error object for a failed request', async function() {
    let logs = [], requestId
    const response = await callScriptRunner(function() {
      /* global org, script */
      const _id = script.as('ctxapi2031+admin@medable.com', () => {
        return org.objects.c_ctxapi_2031_object.insertOne({ c_string: 'test string' }).execute()
      })

      return org.objects.c_ctxapi_2031_object.find({ _id })
        .skipAcl()
        .grant(8)
        .expand('creator')
        .paths('creator.name.first')
    })

    should.exist(response)
    should.equal(response.statusCode, 403)
    should.exist(response.body)
    response.body.should.containDeep({
      data: [],
      object: 'fault',
      name: 'fault',
      code: 'kAccessDenied',
      errCode: 'cortex.accessDenied.propertyRead',
      status: 403,
      message: 'Property read access denied.',
      path: 'name'
    })

    requestId = createId(response.headers['medable-request-id'])

    await sleep(2500)

    logs = await modules.db.models.Log.collection
      .find(
        {
          org: server.org._id,
          req: requestId
        }
      )
      .toArray()

    should.exist(logs)
    should.equal(logs.length, 2)
    logs[0].should.containDeep({
      sts: 200,
      src: consts.logs.sources.script,
      in: 0,
      out: 0,
      lvl: consts.logs.levels.info,
      stp: 'route',
      ctt: 0,
      cms: 0,
      dat: {
        _dat_: `{"runtime":false}`
      }
    })
    should.equal(logs[0].req, requestId.toString())
    logs[1].should.containDeep({
      err: {
        name: 'fault',
        code: 'kAccessDenied',
        errCode: 'cortex.accessDenied.propertyRead',
        status: 403,
        message: 'Property read access denied.',
        path: 'name'
      },
      sts: 403,
      mtd: consts.http.methods.POST,
      src: consts.logs.sources.request,
      url: '/sys/script_runner',
      rte: '/sys/script_runner',
      lvl: consts.logs.levels.error
    })
    should.equal(logs[1].req, requestId.toString())

  })

})
