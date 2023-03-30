/* eslint-disable one-var */
/* global script, org */
'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      { promised, sleep } = require('../../../../lib/utils'),
      consts = require('../../../../lib/consts'),
      { getUser, registerUser, createEvent } = require('./utils'),
      should = require('should')

describe('Bugfix - CTXAPI-1898 - Account update principal validation', function() {

  before(async() => {
    const triggerScript = `
    const { trigger } = require('decorators')
    class Trigger1898Account {
      @trigger('create.after', {
        object: 'account',
        weight: 1,
        inline: true
      })
      afterCreateAccountInline({ context }) {

        // Do not allow trigger to change non-trigger accounts
        // This way we can evaluate event updates
        const [account] = org.objects.accounts.find({ _id: context._id }).skipAcl().grant(8).toArray();
        if(account.email.indexOf('_trigger') === -1) {
          return
        }
        org.objects.accounts.updateOne({ _id: context._id }, {
          $push: { roles: '000000000000000000000004' }
        }).skipAcl().grant(8).execute()
      }
    }
    module.exports = Trigger1898Account
    `

    await promised(null, sandboxed(function() {
      org.objects.scripts.insertOne({
        label: 'CTXAPI-1898 TriggerObject Library',
        name: 'c_ctxapi_1898_triggerobject_lib',
        description: 'Library to trigger',
        type: 'library',
        script: script.arguments.triggerScript,
        configuration: {
          export: 'c_ctxapi_1898_triggerobject_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        triggerScript
      }
    }))

    const eventScript = `  
    const { on } = require('decorators')
    class Trigger1898Event {
      @on('c_ctxapi_1898.eventtrigger_lib')
      on1898triggered({ batch, creator, bulkRequestId, accountEmail }) {
        
        let account = org.objects.account.readOne({ email: accountEmail })
          .skipAcl()
          .grant('read')
          .throwNotFound(false)
          .execute()

        org.objects.accounts.updateOne(
          { _id: account._id },
          { 
            $push: { roles: consts.roles.admin }
          }
        ).skipAcl().grant(8).execute()

      }
    }
    module.exports = Trigger1898Event
    `

    await promised(null, sandboxed(function() {
      org.objects.scripts.insertOne({
        label: 'CTXAPI-1898 eventTrigger Library',
        name: 'c_ctxapi_1898_eventtrigger_lib',
        description: 'Library to trigger on event',
        type: 'library',
        script: script.arguments.eventScript,
        configuration: {
          export: 'c_ctxapi_1898_eventtrigger_lib'
        }
      }).execute()
    }, {
      runtimeArguments: {
        eventScript
      }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1898_triggerobject_lib' }).execute()
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_1898_eventtrigger_lib' }).execute()
    org.objects.accounts.deleteOne({ email: 'giannis.paraskakis+1898_trigger@medable.com' }).skipAcl(true).grant('script').execute()
    org.objects.accounts.deleteOne({ email: 'giannis.paraskakis+1898_developer@medable.com' }).skipAcl(true).grant('script').execute()
    org.objects.accounts.deleteOne({ email: 'giannis.paraskakis+1898_developer_self@medable.com' }).skipAcl(true).grant('script').execute()
  }))

  it('should allow updating the adminRole from inline trigger', async() => {
    await registerUser('giannis.paraskakis+1898_trigger@medable.com')

    const user = await getUser('giannis.paraskakis+1898_trigger@medable.com')

    should.exist(user)
    should.equal(user.email, 'giannis.paraskakis+1898_trigger@medable.com')
    should.equal(user.roles.length, 2)
    should.notEqual(user.created, user.updated)
    should.deepEqual(user.roles, [consts.roles.developer, consts.roles.admin])

  })

  it('should allow updating the adminRole from event if the principal is an admin', async() => {

    await registerUser('giannis.paraskakis+1898_developer@medable.com')
    const orgAdmin = await getUser('james+admin@medable.com')

    await createEvent(orgAdmin)
    // Give it some time to run
    await sleep(3000)

    const user = await getUser('giannis.paraskakis+1898_developer@medable.com')

    should.exist(user)
    should.equal(user.email, 'giannis.paraskakis+1898_developer@medable.com')
    should.equal(user.roles.length, 2)
    should.notEqual(user.created, user.updated)
    should.deepEqual(user.roles, [consts.roles.developer, consts.roles.admin])

  })

  it('should not allow updating the adminRole from event if the principal is not an admin', async() => {

    await registerUser('giannis.paraskakis+1898_developer_self@medable.com')
    const orgDeveloper = await getUser('giannis.paraskakis+1898_developer_self@medable.com')

    await createEvent(orgDeveloper)
    // Give it some time to run
    await sleep(3000)

    const user = await getUser('giannis.paraskakis+1898_developer_self@medable.com')

    should.exist(user)
    should.equal(user.email, 'giannis.paraskakis+1898_developer_self@medable.com')
    should.equal(user.roles.length, 1)
    should.notEqual(user.created, user.updated)
    should.deepEqual(user.roles, [consts.roles.developer])

  })

})
