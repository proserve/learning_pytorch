const should = require('should'),
      server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      ap = require('../../../../lib/access-principal'),
      acl = require('../../../../lib/acl'),
      sinon = require('sinon').createSandbox(),
      models = modules.db.models,
      { promised, sleep } = require('../../../../lib/utils')

describe('Issues - CTXAPI-1238 - Max accounts', function() {

  async function markToBeReaped(accounts, principal) {
    for (const account of accounts) {
      await promised(modules.org, 'deleteAccount', principal, account)
    }
  }

  async function getAccountCount(org, onlyActive = false) {
    let filter = { org: org._id, object: 'account' }
    if (onlyActive) {
      filter = { org: org._id, object: 'account', reap: false }
    }
    return promised(models.account.collection, 'countDocuments', filter)
  }

  it('should be capped if limit is reached', async function() {

    const { org } = server,
          additionalAccounts = 2
    let newAccounts = [],
        activeAccountsCount = await getAccountCount(org, true),
        maxActiveAccounts = activeAccountsCount + additionalAccounts,
        principal = ap.synthesizeOrgAdmin(server.org, acl.SystemAdmin)
    try {

      // Set the configuration for this run
      org.configuration.maxAccounts = maxActiveAccounts

      // Let's store the newly created accounts to reap them
      newAccounts = []
      for (let i = activeAccountsCount; i <= maxActiveAccounts + 1; i++) {
        const options = {
                requireEmail: false,
                requireMobile: false
              },
              payload = {
                email: `jparaskakis+test_${i}@medable.com`,
                password: 'test1234!@#ABC'
              },

              // create the account
              account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'unverified', null, null, options)
        newAccounts.push(account)
      }

    } catch (e) {
      // The last createAccount should always exceed the maxAccount by 1
      should.equal(e.errCode, 'cortex.accessDenied.maxAccounts')
    } finally {
      // Before failing we should have already created as many accounts as we can
      should.equal(newAccounts.length, additionalAccounts + 1)

      // Active accounts should now equal to the maxAccounts
      // (the check is done before persisting so we will end up with one more than max)
      should.equal(await getAccountCount(org, false), maxActiveAccounts + 1)

      // Let's now mark the newly created accounts to be reaped
      await markToBeReaped(newAccounts, principal)

      // Active accounts should now equal to the maxAccounts
      should.equal(await getAccountCount(org, true), maxActiveAccounts - additionalAccounts)
    }
  })

  it('should not be capped if accounts are marked for deletion', async function() {
    const { org } = server,
          additionalAccounts = 2
    let newAccounts = [],
        activeAccountsCount = await getAccountCount(org, true),
        allAccountsCount = await getAccountCount(org, false),
        maxActiveAccounts = activeAccountsCount + additionalAccounts,
        principal = ap.synthesizeOrgAdmin(org, acl.SystemAdmin),
        instanceReaper = require('../../../../lib/modules/workers/workers/instance-reaper'),
        instanceReaperStub

    // Set the configuration for this run
    org.configuration.maxAccounts = maxActiveAccounts
    // Let's wait for the worker to run
    while (allAccountsCount > activeAccountsCount) {
      await sleep(200)
      allAccountsCount = await getAccountCount(org, false)
      activeAccountsCount = await getAccountCount(org, true)
    }

    should.equal(activeAccountsCount, allAccountsCount)

    // Let's store the newly created accounts to reap them
    for (let i = activeAccountsCount; i <= maxActiveAccounts; i++) {
      const options = {
              requireEmail: false,
              requireMobile: false
            },
            payload = {
              email: `jparaskakis+test_${i}@medable.com`,
              password: 'test1234!@#ABC'
            },

            // create the account
            account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'unverified', null, null, options)
      newAccounts.push(account)
    }

    // After creating the accounts the
    // allAccounts = activeAccounts = (maxAccounts + 1)
    activeAccountsCount = await getAccountCount(org, true)
    allAccountsCount = await getAccountCount(org, false)
    should.equal(activeAccountsCount, allAccountsCount)
    should.equal(allAccountsCount, maxActiveAccounts + 1)

    // stub instance reaper _process method to stop it from reaping accounts
    instanceReaperStub = sinon.stub(instanceReaper.prototype, '_process').callsArg(3)

    // Let's now mark the newly created accounts to be reaped
    await markToBeReaped(newAccounts, principal)

    // After marking the accounts to be reaped the
    // activeAccounts should be reduced to what it previously was
    // allAccounts should remain as they were
    activeAccountsCount = await getAccountCount(org, true)
    allAccountsCount = await getAccountCount(org, false)
    should.notEqual(activeAccountsCount, allAccountsCount)
    should.equal(allAccountsCount, maxActiveAccounts + 1)

    // Should be able to recreate new Accounts in the place of the ones that are marked for reaping
    newAccounts = []
    for (let i = activeAccountsCount; i <= maxActiveAccounts; i++) {
      const options = {
              requireEmail: false,
              requireMobile: false
            },
            payload = {
              email: `jparaskakis+test_${i}_replace@medable.com`,
              password: 'test1234!@#ABC'
            },

            // create the account
            account = await promised(modules.accounts, 'createAccount', principal, payload, org, 'en_US', 'unverified', null, null, options)
      newAccounts.push(account)
    }

    // After replacing the accounts to be reaped
    // allAccounts = (maxAccounts + 1) + the previous run (additionalAccounts)
    // activeAccounts = (maxAccounts + 1)
    activeAccountsCount = await getAccountCount(org, true)
    should.equal(activeAccountsCount, maxActiveAccounts + 1)

    instanceReaperStub.restore()

    await markToBeReaped(newAccounts, principal)
  })

})
