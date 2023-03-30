'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      ap = require('../../../../access-principal'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      later = require('later'),
      _ = require('underscore'),
      cronParser = require('cron-parser'),
      { isCustomName, isSet, equalIds, toJSON, promised, encodeME, decodeME } = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      modules = require('../../../../modules'),
      SUPPORTED_OPERATIONS = ['deleteMany', 'deleteOne', 'insertMany', 'insertOne', 'patchMany', 'patchOne', 'updateMany', 'updateOne']

function EventDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

  if (config('events.enableLimits')) {

    this.properties._id.validators.push({
      name: 'adhoc',
      definition: {
        code: 'cortex.invalidArgument.maxAllowed',
        validator: async function(ac) {

          if (this.isNew) {

            const { softLimit, hardLimit, triggerSoftLimit, triggerHardLimit } = ac.org.configuration.events

            if ((softLimit > 0 && triggerSoftLimit) || hardLimit > 0) {

              const count = await ac.object.collection.countDocuments({
                      org: ac.orgId,
                      object: 'event',
                      state: consts.events.states.pending,
                      reap: false
                    }),
                    { db, sandbox } = modules

              if (count > hardLimit) {

                if (triggerHardLimit) {
                  const triggerExists = await promised(sandbox, 'triggerExists', ac.principal, 'system', 'err.events.hardLimitExceeded')
                  if (triggerExists) {
                    const doc = await promised(
                      db,
                      'sequencedUpdate',
                      ac.org.constructor,
                      {
                        _id: ac.org._id,
                        $or: [
                          { 'configuration.events.triggerHardLimit': { $exists: false } },
                          { 'configuration.events.triggerHardLimit': true }
                        ]
                      },
                      {
                        $set: { 'configuration.events.triggerHardLimit': false }
                      }
                    )
                    if (doc) {
                      await promised(sandbox, 'triggerScript', 'err.events.hardLimitExceeded', null, ac, {
                        forceInline: true,
                        object: 'system'
                      }, {})
                    }
                  }
                }
                return false

              }

              if (count > softLimit) {
                if (triggerSoftLimit) {
                  const triggerExists = await promised(sandbox, 'triggerExists', ac.principal, 'system', 'err.events.softLimitExceeded')
                  if (triggerExists) {
                    const doc = await promised(
                      db,
                      'sequencedUpdate',
                      ac.org.constructor,
                      {
                        _id: ac.org._id,
                        $or: [
                          { 'configuration.events.triggerSoftLimit': { $exists: false } },
                          { 'configuration.events.triggerSoftLimit': true }
                        ]
                      },
                      {
                        $set: { 'configuration.events.triggerSoftLimit': false }
                      }
                    )
                    if (doc) {
                      await promised(sandbox, 'triggerScript', 'err.events.softLimitExceeded', null, ac, {
                        forceInline: true,
                        object: 'system'
                      }, {})
                    }
                  }
                }
              }

            }
          }
          return true
        }
      }
    })

  }
}
util.inherits(EventDefinition, BuiltinContextModelDefinition)

EventDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.statics = EventDefinition.statics
  options.methods = EventDefinition.methods
  options.indexes = EventDefinition.indexes
  options.options = { collection: EventDefinition.collection }
  options.apiHooks = EventDefinition.apiHooks
  options.exclusiveCollection = true
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

EventDefinition.collection = 'events'

EventDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: true,
    hasOwner: true,
    _id: consts.NativeIds.event,
    objectLabel: 'Event',
    objectName: 'event',
    pluralName: 'events',
    collection: 'events',
    isExtensible: false,
    isVersioned: false,
    isDeletable: true,
    isUnmanaged: true,
    isFavoritable: false,
    auditing: {
      enabled: false
    },
    obeyObjectMode: true,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    allowBypassCreateAcl: true,
    createAclOverwrite: false,
    createAclExtend: false,
    defaultAclOverride: false,
    shareChainOverride: false,
    shareAclOverride: false,
    shareChain: [],
    defaultAcl: [],
    createAcl: [],
    requiredAclPaths: ['state'],
    sequence: 1,
    properties: [
      {
        label: 'Parent',
        name: 'parent',
        type: 'ObjectId'
      },
      {
        label: 'Parent Key',
        name: 'parentKey',
        type: 'String',
        nativeIndex: true
      },
      {
        // shard key
        label: 'Shard',
        name: 'shardKey',
        type: 'Number',
        readable: false,
        default: function() {
          return modules.services.api.generateShardKey()
        }
      },
      {
        // optional unique local key.
        label: 'Key',
        name: 'key',
        type: 'String',
        readable: true,
        writable: true,
        nativeIndex: true,
        removable: true,
        validators: [
          {
            name: 'string',
            definition: {
              min: 0,
              max: 512,
              allowNull: true
            }
          }
        ]
      },
      {
        // optional schedule. for now, cron is supported.
        label: 'Schedule',
        name: 'schedule',
        type: 'String',
        writable: true,
        trim: true,
        dependencies: ['start', 'count', 'state'],
        validators: [
          {
            name: 'adhoc',
            definition: {
              message: 'A valid schedule in cron format.',
              validator: function(ac, node, cron) {

                const parts = String(cron).split(' ')

                let schedule

                if (parts.length === 0) {
                  if (this.state === consts.events.states.scheduled) {
                    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'a recurring event schedule cannot be unset.' })
                  }
                  return true
                } else if (!this.isNew && this.state !== consts.events.states.scheduled) {
                  throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'a non-recurring event schedule cannot be set.' })
                }

                if (parts.length === 5) {

                  try {
                    cronParser.parseExpression(cron)
                    const parsed = later.parse.cron(cron, false)
                    schedule = later.schedule(parsed)
                  } catch (err) {
                    void err
                  }

                }

                if (schedule && schedule.isValid()) {
                  if (!isSet(this.start) || !ac.option('$event-definition.wrote-start-value')) {
                    this.start = schedule.next()
                  }
                  if (!isSet(this.count)) {
                    this.count = 0
                  }
                  if (this.isNew) {
                    this.state = consts.events.states.scheduled
                  }
                  return true
                }
                return false
              }
            }
          }
        ]
      },
      {
        // the number of times a scheduled item has been run.
        label: 'count',
        name: 'count',
        type: 'Number'
      },
      {
        label: 'If conditional',
        name: 'if',
        type: 'Expression',
        writable: true,
        removable: true
      },
      {
        // TTL removed entirely.
        label: 'Expires',
        name: 'expiresAt',
        type: 'Date',
        writable: true,
        nativeIndex: true,
        removable: true
      },
      {
        label: 'Retention',
        name: 'retention',
        type: 'Number',
        writable: true,
        default: consts.events.retention.never,
        validators: [
          { name: 'required' },
          { name: 'number', definition: { min: 0, max: Object.values(consts.events.retention).reduce((memo, value) => memo | value, 0) } }
        ]
      },
      {
        label: 'State',
        name: 'state',
        type: 'Number',
        default: consts.events.states.pending,
        validators: [{ name: 'numberEnum', definition: { values: _.values(consts.events.states) } }],
        nativeIndex: true
      },
      {
        label: 'Started',
        name: 'started',
        type: 'Date'
      },
      {
        label: 'Start',
        name: 'start',
        type: 'Date',
        writable: true,
        default: function() {
          return new Date()
        },
        writer: function(ac, node, value) {
          if (isSet(value)) {
            ac.option('$event-definition.wrote-start-value', true)
          }
          return value
        },
        validators: [
          {
            name: 'date'
          }
        ]
      },
      {
        label: 'Principal',
        name: 'principal',
        type: 'ObjectId',
        default: null,
        writable: true,
        writer: function(ac, node, value, options, callback) {
          if (value === null || value === undefined) {
            return callback(null, null)
          }
          if (equalIds(value, acl.AnonymousIdentifier) || equalIds(value, acl.PublicIdentifier)) {
            return callback(null, value)
          }
          ap.create(ac.org, value, (err, principal) => {
            callback(err, principal && principal._id)
          })
        }
      },
      {
        label: 'Error',
        name: 'err',
        type: 'Any',
        serializeData: false,
        set: (v) => {
          const err = encodeME(toJSON(Fault.from(v)))
          if (err && err.stack) {
            delete err.stack // NEVER include the stack
          }
          return err
        },
        get: function(v) { return decodeME(v) }
      }
    ],
    objectTypes: [
      {
        // fires script @on runtime event handlers
        _id: consts.events.types.script,
        label: 'Script',
        name: 'script',
        properties: [
          {
            label: 'Event',
            name: 'event',
            type: 'String',
            creatable: true,
            validators: [{
              name: 'required'
            }, {
              name: 'adhoc',
              definition: {
                validator: function(ac, node, eventName) {
                  if (typeof eventName === 'string') {
                    const parts = eventName.split('.').map(v => v.trim()).filter(v => v)
                    if (eventName.length <= 128 && parts.length >= 1 && isCustomName(parts[0])) {
                      return true
                    }
                  }
                  return false
                }
              }
            }]
          },
          {
            label: 'Param',
            name: 'param',
            type: 'Any',
            writable: true,
            maxSize: 16384,
            serializeData: false,
            set: function(v) { return encodeME(v) },
            get: function(v) { return decodeME(v) }
          }
        ]
      },
      {
        _id: consts.events.types.driver,
        label: 'Driver',
        name: 'driver',
        properties: [
          {
            label: 'Options',
            name: 'options',
            type: 'Any',
            writable: true,
            maxSize: 16384,
            serializeData: false,
            set: function(v) { return encodeME(v, '$$decodedOptions', this) },
            get: function(v) { return decodeME(v, '$$decodedOptions', this) },
            validators: [{
              name: 'required'
            }, {
              name: 'adhoc',
              code: 'cortex.unsupportedOperation.unspecified',
              definition: {
                validator: function(ac, node, options) {
                  const operation = options && options.operation
                  return SUPPORTED_OPERATIONS.includes(operation)
                }
              }
            }]
          },
          {
            label: 'Privileged',
            name: 'privileged',
            type: 'Boolean',
            writable: true,
            default: false
          }
        ]
      },
      {
        _id: consts.events.types.notification,
        label: 'Notification',
        name: 'notification',
        properties: [
          {
            label: 'Name',
            name: 'name',
            type: 'String',
            writable: true,
            removable: true,
            validators: [
              {
                name: 'string',
                definition: {
                  min: 0,
                  max: 512,
                  allowNull: true
                }
              }
            ]
          },
          {
            label: 'Variables',
            name: 'variables',
            type: 'Any',
            writable: true,
            maxSize: 16384,
            serializeData: false,
            stubValue: '{}',
            default: function() {
              return {}
            },
            set: function(v) { return encodeME(v) },
            get: function(v) { return decodeME(v) }
          },
          {
            label: 'Options',
            name: 'options',
            type: 'Any',
            writable: true,
            maxSize: 16384,
            serializeData: false,
            set: function(v) { return encodeME(v) },
            get: function(v) { return decodeME(v) }
          }
        ]
      },
      {
        _id: consts.events.types.console,
        label: 'Console',
        name: 'console',
        properties: [
          {
            label: 'Param',
            name: 'param',
            type: 'Any',
            writable: true,
            maxSize: 8192,
            serializeData: false,
            set: function(v) { return encodeME(v) },
            get: function(v) { return decodeME(v) }
          }
        ]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

EventDefinition.methods = {

}

// shared statics --------------------------------------------------------

EventDefinition.statics = {

  aclInit() {

  }

}

// indexes ---------------------------------------------------------------

EventDefinition.indexes = [

  // optional unique key
  [{ org: 1, key: 1 }, { unique: true, name: 'idxKey', partialFilterExpression: { key: { $exists: true } } }],

  // optional parent key (for events spawned from a schedule)
  [{ org: 1, parentKey: 1 }, { name: 'idxParentKey', partialFilterExpression: { parentKey: { $exists: true } } }],

  // the ttl
  [{ expiresAt: 1 }, { name: 'idxExpires', partialFilterExpression: { expiresAt: { $exists: true } } }],

  // state
  [{ org: 1, object: 1, state: 1, reap: 1 }, { name: 'idxState' }],

  // worker queue
  [{ shardKey: 1, state: 1, start: 1, reap: 1 }, { name: 'idxQueue', partialFilterExpression: { state: { $lte: consts.events.states.pending } } }]

]

// shared hooks  ---------------------------------------------------------

EventDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = EventDefinition
