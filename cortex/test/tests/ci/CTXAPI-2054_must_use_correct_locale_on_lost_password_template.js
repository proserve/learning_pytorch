const { promised, sleep } = require('../../../lib/utils'),
      sandboxed = require('../../lib/sandboxed'),
      should = require('should'), modules = require('../../../lib/modules'),
      sinon = require('sinon'),
      EmailWorker = require('../../../lib/modules/workers/workers/emailer'),
      { createAccount } = require('../../lib/utils')(),
      email = 'fake.anyemail+2054@medable.com'

describe('Should considering user account local to localize lost-password email template', function() {
  let orgCode
  before(async() => {
    await createAccount({
      name: {
        first: 'Test',
        last: 'Account'
      },
      email,
      username: 'testaccount',
      mobile: '15055555555',
      password: 'myPa$$word123'
    })

    orgCode = await promised(null, sandboxed(function() {
      org.objects.accounts.updateOne({ email: 'fake.anyemail+2054@medable.com' }, { '$set': { locale: 'fr_FR' } }).skipAcl().grant(8).execute()
      return script.org.code
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      /* global script, org */
      return org.objects.accounts.deleteOne({ email: 'fake.anyemail+2054@medable.com' }).skipAcl().grant(8).execute()
    }))
  })

  it('Should run sendNotification with user account local', async function() {
    const org = await modules.db.models.org.loadOrg(orgCode)
    let orgSpy = sinon.spy(org)

    await new Promise((resolve) => {
      modules.accounts.requestPasswordReset(org, email, null, null, 'en', { sendEmail: true, sendSms: true }, resolve)
    })
    should(orgSpy.sendNotification.args[0][1].locale).eql('fr_FR')
  })

  it('Should run EmailWorker  with user account local', async function() {
    const org = await modules.db.models.org.loadOrg(orgCode),
          emailWorker = sinon.spy(EmailWorker.prototype)
    let tries = 0

    await new Promise((resolve) => {
      modules.accounts.requestPasswordReset(org, email, null, null, 'en', { sendEmail: true, sendSms: true }, resolve)
    })

    while (!emailWorker.parsePayload.called && tries < 100) {
      await sleep(10)
      tries++
    }
    should(emailWorker.parsePayload.args[0][0].template).eql('lost-password')
    should(emailWorker.parsePayload.args[0][0].locale).eql('fr_FR')
  })
})
