const server = require('./server'),
      ap = require('../../lib/access-principal'),
      modules = require('../../lib/modules'),
      { promised, sleep } = require('../../lib/utils'),
      acl = require('../../lib/acl'),
      sandboxed = require('./sandboxed'),
      supertest = require('supertest'),

      defaultCredentials = {
        name: {
          first: 'Test',
          last: 'Account'
        },
        email: 'test.account@medable.com',
        mobile: '15055555555',
        password: 'myPa$$word123'
      }

async function waitForWorker(server, worker, fn, options = {}) {
  const { forceWorkerRun = false, sleptMax = 60000 } = options

  let err,
      done = false

  const testId = server.__mocha_test_uuid__,
        handler = (message, e) => {
          if (message.worker === worker && message.testId === testId) {
            done = true
          }
          err = e
        }
  server.events.on('worker.done', handler)
  if (fn) {
    await fn()
  }
  if (forceWorkerRun) {
    modules.workers.runNow(worker)
  }
  // eslint-disable-next-line one-var
  let slept = 0
  while (!err && !done) { // eslint-disable-line no-unmodified-loop-condition
    if (slept > sleptMax) {
      done = true
    }
    await sleep(25)
    slept += 25
  }
  server.events.removeListener('worker.done', handler)
  if (err) {
    throw err
  }
}

module.exports = (opts = {}) => {
  const orgData = opts.orgData || server

  return {
    waitForWorker,

    updateOrg: async(path, value, principal) => {
      await promised(null, sandboxed(function() {
        /* global script, org */
        org.update(script.arguments.path, script.arguments.value)
      }, {
        principal,
        runtimeArguments: {
          path,
          value
        }
      }))
    },

    updateAccount: async(accountId, value, principal) => {
      await promised(null, sandboxed(function() {
        const accounts = require('accounts')

        accounts.admin.update(script.arguments.accountId, script.arguments.value)
      }, {
        principal,
        runtimeArguments: {
          accountId: accountId,
          value
        }
      }))
    },

    createAccount: async(credentials) => {
      const newUserAgent = supertest.agent(server.api.expressApp),
            payload = Object.assign({}, defaultCredentials, credentials),

            response = await newUserAgent.post(orgData.makeEndpoint('/accounts/register'))
              .set(orgData.getSessionHeaders())
              .send(payload, {
                skipVerification: true,
                skipActivation: true,
                skipNotification: true
              })
      response.body.password = payload.password

      return response.body
    },

    createAdminAccount: async(credentials) => {
      const { org } = server,
            principal = ap.synthesizeOrgAdmin(org, acl.SystemAdmin),
            options = {
              requireEmail: false,
              requireMobile: false
            }

      return promised(modules.accounts, 'createAccount', principal, credentials, org, 'en_US', 'verified', null, null, options)
    },

    getInstance: async(objectType, id) => {
      return promised(null, sandboxed(function() {
        return org.objects[script.arguments.objectType].find({ _id: script.arguments.id }).skipAcl().grant(8).next()
      }, {
        runtimeArguments: {
          objectType,
          id
        }
      }))
    },

    getFirstInstance: async(objectType) => {
      return promised(null, sandboxed(function() {
        return org.objects[script.arguments.objectType].find().skipAcl().grant(8).next()
      }, {
        runtimeArguments: {
          objectType
        }
      }))
    },

    updateInstance: async(objectType, id, update) => {
      return promised(null, sandboxed(function() {
        return org.objects[script.arguments.objectType].updateOne({
          _id: script.arguments.id
        }, script.arguments.update).lean(true).skipAcl().grant(8).execute()

      }, {
        runtimeArguments: {
          objectType,
          id,
          update
        }
      }))
    },

    deleteInstance: async(objectType, id) => {
      await promised(null, sandboxed(function() {
        org.objects[script.arguments.objectType].deleteOne({ _id: script.arguments.id }).skipAcl().grant(8).execute()
      }, {
        runtimeArguments: {
          objectType,
          id
        }
      }))

      await waitForWorker(server, 'instance-reaper')
    },

    deleteManyInstances: async(objectType) => {
      await promised(null, sandboxed(function() {
        org.objects[script.arguments.objectType].deleteMany().skipAcl().grant(8).execute()
      }, {
        runtimeArguments: {
          objectType
        }
      }))

      await waitForWorker(server, 'instance-reaper')
    },

    insertInstance: async(objectType, object) => {
      return promised(null, sandboxed(function() {
        return org.objects[script.arguments.objectType].insertOne(script.arguments.object).skipAcl().grant(8).execute()
      }, {
        runtimeArguments: {
          objectType,
          object
        }
      }))
    },

    login: (payload, agent = null) => {
      agent = agent || supertest.agent(server.api.expressApp)
      return agent
        .post(orgData.makeEndpoint('/accounts/login'))
        .set(orgData.getSessionHeaders())
        .send(payload)
    },
    register: (payload, agent = null) => {
      agent = agent || supertest.agent(server.api.expressApp)
      return agent
        .post(orgData.makeEndpoint('/accounts/register'))
        .set(orgData.getSessionHeaders())
        .send(payload)
    }
  }
}
