
'use strict'

const modules = require('../../../../../lib/modules'),
      ap = require('../../../../../lib/access-principal'),
      IterableCursor = require('../../../../../lib/classes/iterable-cursor'),
      path = require('path'),
      acl = require('../../../../../lib/acl'),
      { promised } = require('../../../../../lib/utils'),
      callbackSandboxed = require('../../../../lib/sandboxed'),
      ctxUtils = require('cortex-service/lib/utils')

let theEnvironment, definitions = []

ctxUtils.walk_dir_sync(path.join(__dirname, 'env'), null, (fullPath, file) => {

  if (file.match(/\.json$/)) {
    definitions.push(require(fullPath))
  }
})

async function getEnvironment() {

  if (!theEnvironment) {
    await setup()
  }

  return theEnvironment

}

async function runInSandbox(code, principal = 'admin', runtimeArguments = null) {

  const environment = await getEnvironment()

  if (principal === 'admin') {
    principal = environment.principals.admin
  } else if (!principal) {
    principal = await ap.create(environment.org, principal)
  }

  return promised(this, callbackSandboxed(code, principal, 'route', 'javascript', 'es6', runtimeArguments))

}

function sandboxed(...args) {
  return async() => {
    return runInSandbox(...args)
  }
}

// initialize a new org.
// using the sandbox for portability to scripting environments.
async function setup() {

  await promised(modules.org, 'provision', {
    name: 'Environment Tests',
    code: 'env'
  }, {
    email: 'env@medable.com',
    name: {
      first: 'Environment',
      last: 'Tests'
    },
    mobile: '+15055555555'
  })

  const { org } = await promised(modules.db.models.org, 'createObject', 'org', 'env'),
        admin = await ap.create(org, 'env@medable.com'),
        inputCursor = new IterableCursor({
          iterable: definitions
        })

  theEnvironment = { org, principals: { admin } }

  // import environment
  let cursor = await promised(modules.developer, 'importEnvironment', new acl.AccessContext(admin), inputCursor, { backup: false })
  while (await promised(cursor, 'hasNext')) {
    await promised(cursor, 'next')
  }

  // update the org so we have the latest for the tests
  theEnvironment = {
    org: await new Promise((resolve, reject) => {
      modules.db.models.org.createObject('org', 'env', (err, { model, org }) => {
        err ? reject(err) : resolve(org)
      })
    }),
    principals: {
      admin
    }
  }
}

module.exports = {
  setup,
  sandboxed,
  getEnvironment
}
