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

describe('CTXAPI-1255: Fix handling of Tencent push notification payload and message type', function() {

  let locationId,
      recipientId

  before(async() => {

    // create app
    await promised(null, sandboxed(function() {
      global.org.objects.org.updateOne({ code: script.org.code }, {
        $push: {
          apps: [{
            name: 'c_ctxapi_1255',
            label: 'c_ctxapi_1255',
            enabled: true,
            TPNS: {
              accessId: 'accessId',
              secretKey: 'secretKey'
            },
            clients: [{
              label: 'c_ctxapi_1255',
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
          client: org.apps.find(app => app.name === 'c_ctxapi_1255').clients[0].key
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
            apps: ['c_ctxapi_1255']
          }
        }).execute()
      }))
      await promised(server, 'updateOrg')

    })

    it('Should send a push notification using Tencent', async() => {

      const result = await subscribePerformAndWait(function() {
          /* global script */
          const notifications = require('notifications')
          return notifications.send({
              type: 'callStart',
              roomId: 'roomId',
              twilioToken: 'twilioToken',
              name: 'Tester'
          }, {
              endpoints: {
                  push: {
                    message: 'message'
                  }
              },
              recipient: script.arguments.recipientId
        })
      }, {
        recipientId
      })

      should.exist(result)

    })

    it('Tencent push notification provider message should be the default message', async() => {

      const { providerMessage } = await subscribePerformAndWait(function() {
          /* global script */
          const notifications = require('notifications')
          return notifications.send({
              type: 'callStart',
              roomId: 'roomId',
              twilioToken: 'twilioToken',
              name: 'Tester'
          }, {
              endpoints: {
                  push: {
                    message: 'message'
                  }
              },
              recipient: script.arguments.recipientId
        })
      }, {
        recipientId
      })

      should.equal(providerMessage.audience_type, 'token')
      should.equal(providerMessage.message_type, 'notify')
      should.equal(providerMessage.token_list[0], tencentToken)
      should.equal(providerMessage.message.content, 'message')
      should.equal(providerMessage.message.android.custom_content, '{"type":"callStart","roomId":"roomId","twilioToken":"twilioToken","name":"Tester"}')

    })

    it('Tencent push notification provider message should contain specified parameters', async() => {

      const { providerMessage } = await subscribePerformAndWait(function() {
          /* global script */
          const notifications = require('notifications')
          return notifications.send({
              type: 'callStart',
              roomId: 'roomId',
              twilioToken: 'twilioToken',
              name: 'Tester'
          }, {
              message: 'message',
              endpoints: {
                  push: {
                    tpns: {
                      upload_id: 'upload_id',
                      message_type: 'message'
                    }
                  }
              },
              recipient: script.arguments.recipientId
        })
      }, {
        recipientId
      })

      should.equal(providerMessage.audience_type, 'token')
      should.equal(providerMessage.token_list[0], tencentToken)
      should.equal(providerMessage.message.content, 'message')
      should.equal(providerMessage.message.android.custom_content, '{"type":"callStart","roomId":"roomId","twilioToken":"twilioToken","name":"Tester"}')
      should.equal(providerMessage.upload_id, 'upload_id')
      should.equal(providerMessage.message_type, 'message')

    })

    it('Should not be possible to override Tencent Push Notification Service token audience type', async() => {

      const { providerMessage } = await subscribePerformAndWait(function() {
        /* global script */
        const notifications = require('notifications')
        return notifications.send({
          type: 'callStart',
          roomId: 'roomId',
          twilioToken: 'twilioToken',
          name: 'Tester'
        }, {
          message: 'message',
          endpoints: {
            push: {
              tpns: {
                audience_type: 'all',
                token_list: ['token1', 'token2', 'token3']
              }
            }
          },
          recipient: script.arguments.recipientId
        })
      }, {
        recipientId
      })

      should.equal(providerMessage.audience_type, 'token')
      should.equal(providerMessage.token_list[0], tencentToken)
      should.equal(providerMessage.token_list.length, 1)

    })

    it('Should default multi_pkg option to true for Tencent Push Notification Service', async() => {

      const { providerMessage } = await subscribePerformAndWait(function() {
        /* global script */
        const notifications = require('notifications')
        return notifications.send({
          type: 'callStart',
          roomId: 'roomId',
          twilioToken: 'twilioToken',
          name: 'Tester'
        }, {
          endpoints: {
            push: {
              message: 'message'
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
