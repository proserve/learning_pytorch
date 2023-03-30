'use strict'

const BaseScriptType = require('./base'),
      { rNum, array: toArray, normalizeObjectPath, isCustomName, matchesEnvironment } = require('../../../utils'),
      acl = require('../../../acl'),
      util = require('util'),
      Fault = require('cortex-service/lib/fault'),
      { pick, findIndex } = require('underscore')

function TriggerScriptType() {
  BaseScriptType.call(this)
}

util.inherits(TriggerScriptType, BaseScriptType)

TriggerScriptType.SupportedEvents = [
  'connection.before', 'connection.after', 'connection.removed.after',
  'create.before', 'create.after', 'update.before', 'update.after', 'delete.before', 'delete.after',
  'post.create.before', 'post.create.after', 'post.update.before', 'post.update.after', 'post.delete.before', 'post.delete.after',
  'comment.create.before', 'comment.create.after', 'comment.update.before', 'comment.update.after', 'comment.delete.before', 'comment.delete.after',
  'file.process.after'
]

TriggerScriptType.SupportedAccountEvents = ['signin.before', 'signin.after', 'authorizeToken.after']

TriggerScriptType.SupportedRoomEvents = [
  'room.after', // all room events
  'participant.after', // all participant events
  'track.after', // all track events
  'recording.after', // all recording events
  'recordings.ready.after',
  'composition.after' // all composition events
]

TriggerScriptType.SupportedSystemEvents = [
  'ws.room.join.after',
  'ws.room.leave.after',
  'err.events.softLimitExceeded',
  'err.events.hardLimitExceeded',
  'err.events.failed',
  'developer.import.before',
  'developer.import.after'
]

/**
 *
 * needs to be at least ns__.event[.before|after]
 *
 * @param eventName
 * @returns {boolean}
 * @constructor
 */
TriggerScriptType.prototype.isValidCustomEvent = function(eventName) {

  if (typeof eventName === 'string') {
    const parts = eventName.split('.').map(v => v.trim()).filter(v => v)
    if (eventName.length <= 128 && parts.length >= 2 && isCustomName(parts[0]) && ['before', 'after'].includes(parts[parts.length - 1])) {
      return true
    }
  }
  return false

}

TriggerScriptType.prototype.parseResources = async function(ac, doc, { includeSelf = true } = {}) {

  const resources = await BaseScriptType.prototype.parseResources.call(this, ac, doc)

  if (includeSelf) {
    resources.push({
      metadata: {
        runtime: false,
        scriptId: doc._id,
        scriptHash: doc.compiledHash,
        resource: ac.getResource(),
        requires: doc.requires,
        roles: [],
        serviceAccounts: doc.serviceAccounts
      },
      ...pick(doc, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
      configuration: pick(doc.configuration, 'object', 'event', 'inline', 'paths', 'rootDocument')
    })
  }
  return resources

}

TriggerScriptType.prototype.buildRuntime = async function(ac, runtime, scripts) {

  // look for triggers and order them by script.weight.
  // if there are any with matching names, store only the one with a higher script.weight.
  for (const script of scripts) {

    const triggers = toArray(script.resources).filter(doc => doc.type === 'trigger')

    for (const insert of triggers) {

      if (insert.active && matchesEnvironment(insert.environment)) {

        const pos = findIndex(runtime.triggers, v => v.name && insert.name && v.name === insert.name),
              existing = runtime.triggers[pos]

        if (!existing) {
          runtime.triggers.push(insert)
        } else {

          if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
            runtime.triggers.splice(pos, 1, insert)
          }
        }
      }

    }

  }

  runtime.triggers.sort((a, b) =>
    rNum(b.weight, 0) - rNum(a.weight, 0)
  )

}

TriggerScriptType.prototype.getTypeProperties = function() {

  const self = this

  return [{
    label: 'Object',
    name: 'object',
    type: 'String',
    writable: true,
    lowercase: true,
    trim: true,
    writer: function(ac, node, value) {
      return value || 'system'
    },
    dependencies: ['.object'],
    validators: [{
      name: 'required'
    }, {
      name: 'adhoc',
      definition: {
        message: 'A valid object is required.',
        validator: function(ac, node, value, callback) {
          if (isCustomName(value, 'o_', false)) {
            return callback(Fault.create('cortex.invalidArgument.object', { reason: 'Triggers cannot occur on OOs.' }))
          }
          if (value === 'system' || value === '*') {
            return callback(null, true)
          }
          ac.org.createObject(value, (err, object) => {
            callback(err, !err && object.objectName === value)
          })
        }
      }
    }, {
      name: 'adhoc',
      definition: {
        code: 'cortex.accessDenied.unspecified',
        message: 'Triggers are not allowed on Views, Scripts, Orgs or Objects.',
        validator: function(ac, node, value, callback) {
          if (value === 'system' || value === '*') {
            return callback(null, true)
          }
          ac.org.createObject(value, function(err, object) {
            if (!err) {
              callback(null, !~['object', 'org', 'script', 'view'].indexOf(object.objectName))
            }
            callback(err, true)
          })
        },
        skip: function(ac) {
          return ac.org.configuration.scripting.configurationTriggers
        }
      }
    }]
  }, {
    label: 'Event',
    name: 'event',
    type: 'String',
    dependencies: ['.object'],
    writable: true,
    validators: [{
      name: 'required'
    }, {
      name: 'adhoc',
      definition: {
        message: 'A valid event.',
        validator: function(ac, node, value) {
          return !!(
            ~TriggerScriptType.SupportedEvents.indexOf(value) ||
            (this.configuration.object === 'account' && ~TriggerScriptType.SupportedAccountEvents.indexOf(value)) ||
            (this.configuration.object === 'room' && ~TriggerScriptType.SupportedRoomEvents.indexOf(value)) ||
            (this.configuration.object === 'system' && (self.isValidCustomEvent(value) || ~TriggerScriptType.SupportedSystemEvents.indexOf(value)))
          )
        }
      }
    }]
  }, {
    // inline scripts, when supported, can affect the success or failure of the originating call. does nothing for .before (always inline) events
    label: 'Inline',
    name: 'inline',
    type: 'Boolean',
    writable: true,
    default: false
  }, {
    label: 'Conditional document',
    name: 'rootDocument',
    type: 'String',
    writable: true,
    default: 'document',
    validators: [{
      name: 'stringEnum',
      definition: {
        values: ['document', 'runtime']
      }
    }]
  }, {
    label: 'Paths',
    name: 'paths',
    type: 'String',
    array: true,
    maxItems: 50,
    uniqueValues: true,
    readable: true,
    writable: true,
    canPush: true,
    canPull: true,
    dependencies: ['.object'],
    pusher: function(ac, node, values, options, callback) {

      ac.org.createObject(this.configuration.object, function(err, object) {
        if (err) {
          return callback(err)
        }
        callback(null, values.map(function(path) {
          path = normalizeObjectPath(path, true, true, true)
          const node = object.schema.node.findNode(path)
          if (node) {
            return node.fullpath
          }
          return path
        }))
      })

    },
    writer: function(ac, node, values, options, callback) {
      return node.pusher.call(this, ac, node, values, options, callback)
    },
    validators: [{
      name: 'adhoc',
      definition: {
        validator: function(ac, node, values, callback) {
          if (values && values.length === 0) {
            return callback()
          }
          ac.org.createObject(this.configuration.object, function(err, object) {
            if (err) {
              return callback(err)
            }
            let i, path, node
            for (i = 0; i < values.length; i++) {
              path = values[i]
              node = object.schema.node.findNode(path)
              if (!node || !node.readable) {
                return callback(Fault.create('cortex.notFound.property', { path }))
              }
              // don't allow nodes that would otherwise not be readable.
              if (node.readAccess > acl.AccessLevels.Script) {
                return callback(Fault.create('cortex.notFound.property', { path }))
              }
            }
            callback()
          })
        },
        asArray: true
      }
    }]
  }]

}

module.exports = TriggerScriptType
