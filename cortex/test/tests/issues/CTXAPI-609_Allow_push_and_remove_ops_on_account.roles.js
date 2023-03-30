'use strict'

const sandboxed = require('../../lib/sandboxed'),
      supertest = require('supertest'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-609 - Allow push and remove ops on account.roles', function() {

  before(async() => {

    const newUserAgent = supertest.agent(server.api.expressApp)
    await newUserAgent
      .post(server.makeEndpoint('/accounts/register'))
      .set(server.getSessionHeaders())
      .send({
        name: {
          first: 'Fran',
          last: 'Dev'
        },
        email: 'franco+developer@medable.com',
        password: 'myPa$$word123',
        mobile: '15055555555'
      })
  })

  before(sandboxed(function() {
    /* global org */
    org.push('roles', [ { name: 'st__developer', code: 'st__developer' }, { name: 'st__admin', code: 'st__admin' } ])
  }))

  after(sandboxed(function() {
    /* global org */
    org.objects.accounts.deleteOne({ email: 'franco+developer@medable.com' }).skipAcl().grant(8).execute()
    const _id = org.read('roles').find(v => v.code === 'st__developer')._id,
          _id2 = org.read('roles').find(v => v.code === 'st__admin')._id
    org.delete(`roles.${_id}`)
    org.delete(`roles.${_id2}`)
  }))

  it('should be allowed push, pull and remove opts on account.roles using PATCH method', async function() {
    const pushResult = await promised(null, sandboxed(function() {
            /* global consts, org */
            function r(r) {
              return consts.roles[r]
            }

            let accountId = org.objects.accounts.patchOne({
                  email: 'franco+developer@medable.com'
                }, [{
                  op: 'push',
                  path: 'roles',
                  value: r('st__developer')
                },
                {
                  op: 'push',
                  path: 'roles',
                  value: r('st__admin')
                }
                ]).lean(true).skipAcl().grant(8).execute(),
                account = org.objects.accounts.find({ _id: accountId }).include('roles').skipAcl().grant(8).next(),
                developerRoleId = r('st__developer').toString(),
                adminRoleId = r('st__admin').toString()

            return { account, developerRoleId, adminRoleId }
          })),
          removeResult = await promised(null, sandboxed(function() {
            /* global consts, org */
            function r(r) {
              return consts.roles[r]
            }

            let accountId = org.objects.accounts.patchOne({
              email: 'franco+developer@medable.com'
            }, [{
              op: 'remove',
              path: 'roles',
              value: r('st__developer')
            }
            ]).lean(true).skipAcl().grant(8).execute()
            return org.objects.accounts.find({ _id: accountId }).skipAcl().grant(8).next()
          })),
          pullResult = await promised(null, sandboxed(function() {
            /* global consts, org */
            function r(r) {
              return consts.roles[r]
            }

            let accountId = org.objects.accounts.patchOne({
              email: 'franco+developer@medable.com'
            }, [
              {
                op: 'pull',
                path: 'roles',
                value: r('st__admin')
              }

            ]).lean(true).skipAcl().grant(8).execute()
            return org.objects.accounts.find({ _id: accountId }).skipAcl().grant(8).next()
          }))
    should.equal(pushResult.account.roles[0].toString(), pushResult.developerRoleId)
    should.equal(pushResult.account.roles[1].toString(), pushResult.adminRoleId)
    should.equal(removeResult.roles.length, 1)
    should.equal(removeResult.roles[0].toString(), pushResult.adminRoleId)
    should.equal(pullResult.roles.length, 0)

  })

  it('should be allowed push, pull and remove opts on account.roles using UPDATE method', async function() {
    const pushResult = await promised(null, sandboxed(function() {
            /* global org */
            let developerRoleId = org.read('roles').find(r => r.code === 'st__developer')._id.toString(),
                adminRoleId = org.read('roles').find(r => r.code === 'st__admin')._id.toString(),
                accountId = org.objects.accounts.updateOne({
                  email: 'franco+developer@medable.com'
                }, {
                  $push: {
                    roles: [ developerRoleId, adminRoleId ]
                  }
                }).lean(true).skipAcl().grant(8).execute(),
                account = org.objects.accounts.find({ _id: accountId }).include('roles').skipAcl().grant(8).next()

            return { account, developerRoleId, adminRoleId }
          })),
          removeResult = await promised(null, sandboxed(function() {
            /* global org */

            let accountId = org.objects.accounts.updateOne({
              email: 'franco+developer@medable.com'
            }, {
              $remove: {
                roles: [ org.read('roles').find(r => r.code === 'st__developer')._id.toString() ]
              }
            }).lean(true).skipAcl().grant(8).execute()
            return org.objects.accounts.find({ _id: accountId }).skipAcl().grant(8).next()

          })),
          pullResult = await promised(null, sandboxed(function() {
            /* global org */

            let accountId = org.objects.accounts.updateOne({
              email: 'franco+developer@medable.com'
            }, {
              $pull: {
                roles: [ org.read('roles').find(r => r.code === 'st__admin')._id.toString() ]
              }
            }).lean(true).skipAcl().grant(8).execute()
            return org.objects.accounts.find({ _id: accountId }).skipAcl().grant(8).next()
          }))

    should.equal(pushResult.account.roles[0].toString(), pushResult.developerRoleId)
    should.equal(pushResult.account.roles[1].toString(), pushResult.adminRoleId)
    should.equal(removeResult.roles.length, 1)
    should.equal(removeResult.roles[0].toString(), pushResult.adminRoleId)
    should.equal(pullResult.roles.length, 0)

  })
})
