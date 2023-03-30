'use strict'

const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      modules = require('../../../../modules'),
      { Driver, DeleteManyOperation, DeleteOneOperation } = modules.driver,
      { isSet, equalIds, array: toArray, promised, resolveOptionsCallback, getIdOrNull } = require('../../../../utils'),
      sandboxDriver = {},
      sandboxCursor = {

        hasNext: function(script, message, cursorId, callback) {

          const cursor = script.getCursor(cursorId)
          if (cursor) {
            cursor.hasNext(callback)
          } else {
            callback(null, false)
          }
        },

        isClosed: function(script, message, cursorId, callback) {

          const cursor = script.getCursor(cursorId)
          callback(null, !cursor || cursor.isClosed())
        },

        close: function(script, message, cursorId, callback) {

          const cursor = script.getCursor(cursorId)
          if (cursor) {
            cursor.close(callback)
          } else {
            callback()
          }
        },

        next: function(script, message, cursorId, callback) {

          const cursor = script.getCursor(cursorId)
          if (cursor) {
            cursor.next(callback)
          } else {
            callback(Fault.create('cortex.notFound.cursor'))
          }
        },

        fetch: function(script, message, cursorId, options, callback) {

          [options, callback] = resolveOptionsCallback(options, callback)

          const cursor = script.getCursor(cursorId)
          if (cursor) {
            cursor.fetch(options.count, callback)
          } else {
            callback(Fault.create('cortex.notFound.cursor'))
          }
        },

        toObject: function(script, message, cursorId, callback) {

          const cursor = script.getCursor(cursorId)
          if (cursor) {
            callback(null, cursor.toJSON())
          } else {
            callback(Fault.create('cortex.notFound.cursor'))
          }

        }

      },
      speedUp = ['hasNext', 'isClosed', 'next', 'fetch']

// optimize out the stats and trace for the calls that will happen frequently
speedUp.forEach(fn => {
  sandboxCursor[fn].$trace = false
  sandboxCursor[fn].$stats = false
})

// allows reserved keywords to be used in the sandbox (ie. _export), stripping leading underscores from objectNames.
function normalizeSandboxObjectName(objectName) {

  return String(objectName).toLowerCase().trim().replace(/^[_]{0,}/, '')

}

function normalizeRoles(script, roles) {

  const valid = script.ac.org.roles

  return toArray(roles).reduce((memo, role) => {
    const r = valid.find(valid => valid.code === role || equalIds(valid._id, role))
    if (r) {
      memo.push(r._id)
    }
    return memo
  }, [])

}

for (let operationName of Driver.operationNames) {
  sandboxDriver[operationName] = (function(operationName) {

    return function(script, message, objectName, options, callback) {

      function executeOperation(object) {

        const { ac } = script,
              { req } = ac,
              driver = new Driver(script.ac.principal, object, { req, script })

        driver.executeOperation(operationName, options, options, { privileged: true, parent: script.operation })
          .then(({ result }) => callback(null, result))
          .catch(err => callback(err))
      }

      objectName = normalizeSandboxObjectName(objectName)

      if (operationName === 'bulk' && !objectName) {
        executeOperation()
      } else {
        script.ac.org.createObject(objectName, (err, object) => {
          if (err) {
            callback(err)
          } else {
            executeOperation(object)
          }
        })
      }

    }

  })(operationName)
}

module.exports = {

  version: '1.0.0',

  driver: sandboxDriver,
  cursor: sandboxCursor,

  // objectName, _id, account
  transfer: function(script, message, objectName, _id, account, callback) {

    objectName = normalizeSandboxObjectName(objectName)

    script.ac.org.createObject(objectName, function(err, object) {

      if (err) {
        return callback(err)
      } else if (!object.hasOwner) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'A transfer cannot occur in objects without owners.' }))
      }

      object.aclReadOne(script.ac.principal, _id, { script: script, req: script.ac.req, json: false, skipAcl: true, paths: ['_id', 'owner', 'object'] }, function(err, context) {

        if (err) {
          return callback(err)
        }

        ap.create(script.ac.org, account, function(err, principal) {

          const current = context && context.owner && context.owner._id

          if (err) {
            return callback(err)
          } else if (acl.isBuiltInAccount(principal._id)) {
            return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Built-in accounts cannot own object instances.' }))
          } else if (equalIds(principal._id, current)) {
            return callback(null, false)
          }

          acl.AclOperation.setOwner(script.ac.principal, principal, object, context._id, function(err) {
            modules.audit.recordEvent(script.ac, 'user', 'transfer', { err, context, metadata: { from: current, to: principal._id } }, () => {
              callback(err, true)
            })

          })

        })

      })

    })

  },

  getAccessContext: function(script, message, objectName, path, options, callback) {

    objectName = normalizeSandboxObjectName(objectName)

    script.ac.org.createObject(objectName, function(err, object) {

      if (err) {
        return callback(err)
      }

      options = {
        ...script.allowedOptions(options, 'grant', 'roles'),
        req: script.ac.req,
        script
      }
      if (isSet(options.grant)) {
        options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
      }
      options.roles = normalizeRoles(script, options.roles)

      object.buildAccessContext(script.ac.principal, path, options, callback)

    })

  },

  // legacy support for existing scripts using objects module directly -------------------------------------------------

  list: function(script, message, objectName, payloadOptions, callback) {

    objectName = normalizeSandboxObjectName(objectName)

    Promise.resolve(null)
      .then(async() => {

        const object = await promised(script.ac.org, 'createObject', objectName),
              { ac } = script,
              { req } = ac,
              driver = new Driver(script.ac.principal, object, { req, script })

        return driver.cursor(payloadOptions, payloadOptions, { asList: true })

      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  },

  count: function(script, message, objectName, where, payloadOptions, callback) {
    return sandboxDriver.count(script, message, objectName, { ...payloadOptions, where }, callback)
  },

  cursor_open: sandboxDriver.cursor,
  cursor_next: sandboxCursor.next,
  cursor_hasNext: sandboxCursor.hasNext,
  cursor_isClosed: sandboxCursor.isClosed,
  cursor_close: sandboxCursor.close,

  cursor_fetch: function(script, message, cursorId, count, callback) {
    return sandboxCursor.fetch(script, message, cursorId, { count }, callback)
  },

  read: function(script, message, objectName, where, payloadOptions, callback) {

    const inputId = getIdOrNull(where, true) // backwards compatibility. if it exists, assume searching by _id.
    if (inputId) {
      where = { _id: inputId }
    }

    return sandboxDriver.readOne(script, message, objectName, { ...payloadOptions, where }, callback)
  },

  createMany: function(script, message, objectName, documents, payloadOptions, callback) {
    return sandboxDriver.insertMany(script, message, objectName, { ...payloadOptions, documents }, callback)
  },

  create: function(script, message, objectName, document, payloadOptions, callback) {
    return sandboxDriver.insertOne(script, message, objectName, { ...payloadOptions, document }, callback)
  },

  patchMany: function(script, message, objectName, match, ops, payloadOptions, callback) {
    return sandboxDriver.patchMany(script, message, objectName, { ...payloadOptions, match, ops }, callback)
  },

  patch: function(script, message, objectName, match, ops, payloadOptions, callback) {
    return sandboxDriver.patchOne(script, message, objectName, { ...payloadOptions, match, ops }, callback)
  },

  update: function(script, message, objectName, match, value, payloadOptions, callback) {
    sandboxDriver.patchOne(script, message, objectName, { ...payloadOptions, match, ops: [{ op: 'set', value }] }, callback)
  },

  push: function(script, message, objectName, match, value, payloadOptions, callback) {
    sandboxDriver.patchOne(script, message, objectName, { ...payloadOptions, match, ops: [{ op: 'push', value }] }, callback)
  },

  // -------------------------------------------------------------------------------------------------------------------

  delete: function(script, message, objectName, match, payloadOptions, callback) {

    objectName = normalizeSandboxObjectName(objectName)

    Promise.resolve(null)
      .then(async() => {

        const object = await promised(script.ac.org, 'createObject', objectName),
              { ac } = script,
              { req } = ac,
              driver = new Driver(script.ac.principal, object, { req, script }),
              operation = new DeleteOneOperation(driver),
              { match: computedMatch, path: computedPath } = operation.computeMatchAndPathOptions(match, payloadOptions, null)

        if (computedPath) {
          const ops = [{ op: 'remove', path: computedPath }],
                { modified } = await driver.patchOne({ ...payloadOptions, match: computedMatch, path: null, ops }, payloadOptions, { withRead: false })
          return !!(modified && modified.length > 0)
        }

        return driver.deleteOne({ ...payloadOptions, match: computedMatch }, payloadOptions)

      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  },

  deleteMany: function(script, message, objectName, match, payloadOptions, callback) {

    objectName = normalizeSandboxObjectName(objectName)

    Promise.resolve(null)
      .then(async() => {

        const object = await promised(script.ac.org, 'createObject', objectName),
              { ac } = script,
              { req } = ac,
              driver = new Driver(script.ac.principal, object, { req, script }),
              operation = new DeleteManyOperation(driver),
              { match: computedMatch, path: computedPath } = operation.computeMatchAndPathOptions(match, payloadOptions)

        // this is weird legacy functionality. here for compatibility with older code.
        if (computedPath) {
          const ops = [{ op: 'remove', path: computedPath }],
                { modified } = await driver.patchOne({ ...payloadOptions, match: computedMatch, path: null, ops }, payloadOptions, { withRead: false })
          return !!(modified && modified.length > 0)
        }

        return driver.deleteMany({ ...payloadOptions, match: computedMatch }, payloadOptions)

      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  }

}
