'use strict'

const should = require('should'),
      supertest = require('supertest'),
      { promised, sleep } = require('../../../lib/utils'),
      modules = require('../../../lib/modules'),
      server = require('../../lib/server'),
      ap = require('../../../lib/access-principal'),
      acl = require('../../../lib/acl'),
      consts = require('../../../lib/consts'),

      registerListener = async(worker) => {
        let done, err, data
        const handler = (error, body) => {
          done = true
          err = error
          data = body
        }
        server.events.on(worker, handler)

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }
        server.events.off(worker, handler)
        return { err, data }
      },
      createTemplate = async(templateSpec, templateContent, locale = 'en_US') => {
        let result = await server.sessions.admin
          .post(server.makeEndpoint('/templates/email'))
          .set(server.getSessionHeaders())
          .send(templateSpec)
          .then()

        should.exist(result)
        should.exist(result.body)
        should.not.exist(result.body.errCode)

        // add some template content
        result = await server.sessions.admin
          .put(server.makeEndpoint(`/templates/${locale}/email/${templateSpec.name}`))
          .set(server.getSessionHeaders())
          .send(templateContent)

        should.exist(result)
        should.exist(result.body)
        should.not.exist(result.body.errCode)
      },
      sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-1610 - Send password/mobile changed in the proper language', function() {

  let account, principal
  before(async() => {
    // create an account
    principal = ap.synthesizeOrgAdmin(server.org, acl.SystemAdmin)
    const { org } = server,
          options = {
            requireEmail: false,
            requireMobile: false
          },
          payload = {
            email: `test_locale_user@medable.com`,
            name: {
              first: 'Gaston',
              last: 'Robledo'
            },
            password: 'test1234!@#ABC',
            locale: 'es_AR'
          }
    account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'unverified', null, null, options)

    // create a template
    // create a test template
    await createTemplate({
      name: 'password-change-notification',
      summary: 'Changed password',
      label: 'Password Change',
      partial: false
    }, [
      {
        'name': 'subject',
        'data': 'Asunto'
      }, {
        'name': 'plain',
        'data': 'Hola {{account.name.first}} {{account.name.last}}!'
      }, {
        'name': 'html',
        'data': '<h1>Constraseña Modificada</h1><div>Hola {{account.name.first}} {{account.name.last}}! Esto es un test!</div>'
      }
    ], 'es_AR')

    await createTemplate({
      name: 'mobile-change-notification',
      summary: 'Changed mobile',
      label: 'Mobile Change',
      partial: false
    }, [
      {
        'name': 'subject',
        'data': 'Asunto Movil'
      }, {
        'name': 'plain',
        'data': 'Hola {{account.name.first}} {{account.name.last}}!'
      }, {
        'name': 'html',
        'data': '<h1>Movil Modificado</h1><div>Hola {{account.name.first}} {{account.name.last}}! Esto es un test!</div>'
      }
    ], 'es_AR')

  })

  it('should get a password changed email in account locale even if request was on english', async function() {

    const callbackOptions = {
            expiresMs: 60000,
            targetId: account._id,
            clientKey: server.sessionsClient.key,
            data: { activateOrVerify: false,
              skipAccountProfileUpdateTrigger: false }
          },
          callback = await promised(modules.db.models.callback, 'createCallback', server.org, consts.callbacks.pass_reset, account._id, account.email, callbackOptions),
          // eslint-disable-next-line no-unused-vars
          result = supertest.agent(server.api.expressApp, {})
            .post(server.makeEndpoint('/accounts/reset-password'))
            .set(server.getSessionHeaders())
            .send({
              password: 'test1234!@#CBA',
              token: callback.token
            }).then(),
          { err, data } = await registerListener('worker.emailer')

    should.not.exist(err)
    should.exist(data)

    should(data.content.length).equal(2)
    should(data.personalizations[0].to[0].email).equal('test_locale_user@medable.com')
    should(data.personalizations[0].subject).equal('Asunto')
    should(data.content[0].value).equal('Hola Gaston Robledo!')
    should(data.content[1].value).equal('<h1>Constraseña Modificada</h1><div>Hola Gaston Robledo! Esto es un test!</div>')

  })

  it('should get a mobile change email in account locale even if request was on english', async function() {

    promised(null, sandboxed(function() {
      const acc = global.script.arguments
      return global.org.objects.account.updateOne({ _id: acc._id }, { $set: {
        mobile: '+5493513724958'
      } }).grant(6).execute()
    }, {
      runtimeArguments: account,
      principal
    }))
    const { err, data } = await registerListener('worker.emailer')

    should.not.exist(err)
    should(data.content.length).equal(2)
    should(data.personalizations[0].to[0].email).equal('test_locale_user@medable.com')
    should(data.personalizations[0].subject).equal('Asunto Movil')
    should(data.content[0].value).equal('Hola Gaston Robledo!')
    should(data.content[1].value).equal('<h1>Movil Modificado</h1><div>Hola Gaston Robledo! Esto es un test!</div>')

  })

})
