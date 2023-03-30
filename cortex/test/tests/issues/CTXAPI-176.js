'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-176 - autocreate reference on account creation', function() {

    before(sandboxed(function() {

      /* global org, consts */

      const Model = org.objects.object,
            properties = [{
              label: 'String',
              name: 'c_ctxapi_176',
              type: 'Reference',
              sourceObject: 'c_ctxapi_176',
              autoCreate: true
            }]

      Model.insertOne({
        name: 'c_ctxapi_176',
        label: 'c_ctxapi_176',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }]
      }).execute()

      if (Model.find({ name: 'account' }).hasNext()) {
        Model.updateOne({ name: 'account' }, { $push: { properties } }).execute()
      } else {
        Model.insertOne({ name: 'account', label: 'Account', properties }).execute()
      }

    }))

    after(sandboxed(function() {

      const Model = org.objects.object

      Model.updateOne({ name: 'account' }, {
        $pull: {
          properties: ['c_ctxapi_176']
        }
      }).execute()

    }))

    it('register and account and successfully autoCreate', sandboxed(function() {

      /* global org */

      require('should')

      const Account = org.objects.account

      let Undefined

      Account.provision({
        name: {
          first: 'Charles',
          last: 'Best'
        },
        email: 'c_ctxapi_176@example.org',
        mobile: '1-650-555-5555',
        password: 'Thanks for the break, Banting!'
      })

      ;(Account.find({ email: 'c_ctxapi_176@example.org' }).skipAcl().grant(4).next().c_ctxapi_176 === Undefined).should.be.false()

    }))

  })

})
