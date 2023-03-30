const server = require('../../lib/server'),
      { content: emailContent } = require('../../../i8ln/templates/en_US/email/account-auth-locked.json'),
      emailSpec = require('../../../i8ln/templates/spec/email/account-auth-locked.json'),
      { content: smsContent } = require('../../../i8ln/templates/en_US/sms/account-auth-locked.json'),
      smsSpec = require('../../../i8ln/templates/spec/sms/account-auth-locked.json'),
      should = require('should'),
      path = require('path'),
      fs = require('fs')

describe('CTXAPI-1574 - Authentication locked template is missing durationMinutes spec', function() {

  it('should include durationMinutes on account-auth-locked email template specifications', async function() {
    const html = fs.readFileSync(path.join(__dirname, '../../../i8ln/templates/en_US/email/html/account-auth-locked.html'), 'utf-8'),
          templateResponse = await server.sessions.admin
            .get(server.makeEndpoint('/templates/en_US/email/account-auth-locked?fallback=false&version=0'))
            .set(server.getSessionHeaders())
            .then()

    should.exist(templateResponse)
    should.equal(templateResponse.body.object, 'result')
    templateResponse.body.data.should.containDeepOrdered({
      builtin: true,
      version: 0,
      locale: ['en_US'],
      type: 'email',
      name: 'account-auth-locked'
    })

    templateResponse.body.data.spec.should.containDeepOrdered(emailSpec)
    should.equal(templateResponse.body.data.content.length, 3)

    templateResponse.body.data.content[0].should.containDeepOrdered(emailContent[0])
    templateResponse.body.data.content[1].should.containDeepOrdered(emailContent[1])
    templateResponse.body.data.content[2].should.containDeepOrdered({
      data: html,
      name: 'html',
      mime: 'text/html',
      includes: [{
        type: 'layout',
        name: 'layout'
      }]
    })
  })

  it('should include durationMinutes on account-auth-locked sms template specifications', async function() {
    const templateResponse = await server.sessions.admin
      .get(server.makeEndpoint('/templates/en_US/sms/account-auth-locked?fallback=false&version=0'))
      .set(server.getSessionHeaders())
      .then()

    should.exist(templateResponse)
    should.equal(templateResponse.body.object, 'result')
    templateResponse.body.data.should.containDeepOrdered({
      builtin: true,
      version: 0,
      locale: ['en_US'],
      type: 'sms',
      name: 'account-auth-locked'
    })

    templateResponse.body.data.spec.should.containDeepOrdered(smsSpec)
    should.equal(templateResponse.body.data.content.length, 1)

    templateResponse.body.data.content[0].should.containDeepOrdered(smsContent[0])
  })
})
