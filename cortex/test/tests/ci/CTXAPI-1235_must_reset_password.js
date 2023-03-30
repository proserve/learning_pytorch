const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      ap = require('../../../lib/access-principal'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      acl = require('../../../lib/acl'),
      supertest = require('supertest'),
      should = require('should')

describe('mustResetPassword', () => {

  let account,
      accountId

  const resetUserPassword = async(accountId, newPassword) => {
    await promised(null, sandboxed(function() {
      /* global script org */

      org.objects.accounts.admin.update(
        script.arguments.accountId.toString(),
        {
          password: script.arguments.newPassword,
          stats: {
            mustResetPassword: true
          }
        }
      )
    }, {
      runtimeArguments: {
        accountId,
        newPassword
      }
    }))
  }

  before(async() => {
    const { org } = server,
          principal = ap.synthesizeOrgAdmin(server.org, acl.SystemAdmin),
          options = {
            requireEmail: false,
            requireMobile: false
          },
          payload = {
            email: 'drew.holbrook+ctx-1235@medable.com',
            password: 'oneTwoThree123!@#'
          }

    account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'verified', null, null, options)
    accountId = account._id
  })

  it('mustResetPassword remains true when a users password is reset twice in a row by admin', async() => {
    await resetUserPassword(accountId, 'newPass123!@#')
    await resetUserPassword(accountId, 'newPass456$%^')
    const account = await modules.db.models.account.findOne({ email: 'drew.holbrook+ctx-1235@medable.com' })

    account.stats.mustResetPassword.should.equal(true)
  })

  it('mustResetPassword is not true after user is required to reset their own password', async() => {
    const agent = supertest.agent(server.api.expressApp)

    await resetUserPassword(accountId, 'newPass789&*(')

    await agent
      .post(server.makeEndpoint('/accounts/login'))
      .set(server.getSessionHeaders())
      .send({
        email: 'drew.holbrook+ctx-1235@medable.com',
        password: 'newPass789&*(',
        newPassword: 'newPass012)!@'
      })

    // eslint-disable-next-line one-var
    const account = await modules.db.models.account.findOne({ email: 'drew.holbrook+ctx-1235@medable.com' })

    // account.stats.mustResetPassword.should.equal(false)
    should.not.exist(account.stats.mustResetPassword)
  })
})
