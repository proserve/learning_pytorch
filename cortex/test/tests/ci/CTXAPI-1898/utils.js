/* global script, org */
const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      consts = require('../../../../lib/consts'),
      server = require('../../../lib/server'),

      getUser = async(email) => {
        const [result] = await promised(null, sandboxed(function() {
          return org.objects.accounts.find({ email: script.arguments.email }).skipAcl().grant(8).toArray()
        }, {
          runtimeArguments: {
            email
          }
        }))
        return result
      },

      registerUser = async(email) => {

        const code = function() {
                return org.objects.accounts.register({
                  'name': {
                    'first': 'Test',
                    'last': 'CTXAPI-1898'
                  },
                  'email': '{{email}}',
                  'password': 'qpal1010',
                  'roles': [consts.roles.developer]
                }, {
                  skipVerification: true,
                  skipActivation: true,
                  skipNotification: true,
                  requireMobile: false
                })

              },
              codeStr = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1').trim().replace('{{email}}', email),
              scriptLoad = { 'script': codeStr, 'language': 'javascript', 'specification': 'es6' }

        await server.sessions.admin
          .post(server.makeEndpoint('/sys/script_runner'))
          .set(server.getSessionHeaders())
          .send(scriptLoad)
          .then()

      },

      createEvent = async(principal) => {
        const event = {
          type: 'script',
          event: 'c_ctxapi_1898.eventtrigger_lib',
          key: `c_ctxapi_1898`,
          principal: principal._id,
          param: {
            batch: 1,
            creator: principal._id, // Use the org admin account
            bulkRequestId: 1,
            accountEmail: 'giannis.paraskakis+1898_developer@medable.com'
          }
        }

        await promised(null, sandboxed(function() {
          return org.objects.event.insertOne(script.arguments.event).grant('script').bypassCreateAcl().execute()
        }, {
          runtimeArguments: {
            event
          }
        }))
      }

module.exports = {
  getUser,
  registerUser,
  createEvent
}
