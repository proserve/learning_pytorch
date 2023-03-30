const should = require('should'),
      modules = require('../../../../lib/modules'),
      server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised, sleep } = require('../../../../lib/utils'),
      tencentToken = 'tencentToken',
      subscribePerformAndWait = async(fun, runtimeArguments = {}) => {
        let done = false,
            result = null

        const handler = (destination, message, payload, options, providerMessage) => {
          done = true
          result = { destination, message, payload, options, providerMessage }
        }

        server.events.on('worker.push', handler)

        await promised(null, sandboxed(fun, { runtimeArguments }))

        while (!done) { // eslint-disable-line no-unmodified-loop-condition
          await sleep(250)
        }

        server.events.removeListener('worker.push', handler)

        return result
      }

describe('CTXAPI-1567 - Expose multi_pkg TPNS option', function() {

  let locationId,
      recipientId

  before(async() => {

    // create app
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1567',
            label: 'c_ctxapi_1567',
            enabled: true,
            TPNS: {
              accessId: 'accessId',
              secretKey: 'secretKey'
            },
            clients: [{
              label: 'c_ctxapi_1567',
              enabled: true,
              readOnly: false,
              sessions: true,
              allowNameMapping: true
            }]
          }]
        }
      }).execute()
    }))
    await promised(server, 'updateOrg')

  const { _id, org: code } = await modules.db.models.account.findOne({email: 'james+patient@medable.com'}),
        org = await modules.db.models.org.findOne({ org: code, object: 'org' }),
        { insertedId } = await modules.db.models.Location.collection.insertOne({
          org: code,
          accountId: _id,
          tencent: {
            token: tencentToken
          },
          client: org.apps.find(app => app.name === 'c_ctxapi_1567').clients[0].key
        })
    
    locationId = insertedId
    recipientId = _id

  })

    after(async() => {

      await modules.db.models.Location.collection.deleteOne({_id: locationId})

      // remove app
      await promised(null, sandboxed(function() {
        global.org.objects.org.updateOne({ code: script.org.code }, {
          $pull: {
            apps: ['c_ctxapi_1567']
          }
        }).execute()
      }))
      await promised(server, 'updateOrg')

    })

    it('multi_pkg should be included within the TPNS push message payload', async() => {

      const { providerMessage } = await subscribePerformAndWait(function() {
        /* global script */
        return require('notifications').send({}, {
          endpoints: {
            push: {
              tpns: {
                multi_pkg: true
              }
            }
          },
          recipient: script.arguments.recipientId
        })
      }, {
        recipientId
      })

      should.equal(providerMessage.multi_pkg, true)

    })

})
