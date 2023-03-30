'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../../utils'),
      {
        isPrimitive, isSet, isId, toJSON, isCustomName, sortKeys, naturalCmp, path: pathTo, array: toArray, promised,
        pathDel, couldBeId, createId, getIdOrNull, equalIds, matchesEnvironment, rNum, serializeObject,
        deserializeObject, resolveOptionsCallback, rBool, encodeME, decodeME, isBSONTypeOf
      } = utils,
      acl = require('../../../../acl'),
      _ = require('underscore'),
      async = require('async'),
      semver = require('semver'),
      clone = require('clone'),
      consts = require('../../../../consts'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      { DeferredRead } = require('../classes/deferred-read'),
      ap = require('../../../../access-principal'),
      modules = require('../../../../modules'),
      makeUrlsDefinition = require('../properties/urls').definition,
      firstBy = require('thenby'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      ModelDefinition = require('../model-definition'),
      OrgAppDefinition = require('../org-app-definition'),
      OrgPolicyDefinition = require('../org-policy-definition'),
      OrgNotificationDefinition = require('../org-notification-definition'),
      OrgRoleDefinition = require('../org-role-definition'),
      SetDefinition = require('../types/set-definition'),
      { ModelCacheNode } = modules.db.definitions,
      transpiler = modules.services.transpiler,
      objectCache = modules.cache.memory.add('cortex.objects', { indexes: ['_id', 'name', 'pluralName'], nodeType: ModelCacheNode }),
      ooCache = modules.cache.memory.add('cortex.oos', { indexes: ['_id', 'name'], nodeType: ModelCacheNode }),
      orgCache = modules.cache.memory.add('cortex.envs', { indexes: ['_id', 'code'] }),
      RESERVED_NOTIF_OPTIONS = ['type', 'org', 'variables', 'account', 'principal', 'locale', 'context', 'meta', 'req', 'created'],
      VALID_TOPICS = ['app', 'voip'],
      VALID_PUSH_TYPES = ['alert', 'background', 'voip', 'complication', 'fileprovider', 'mdm'],
      packageReader = require('./../../../../patches/org/Interim Package Reader.js')

let Undefined

function OrgDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}

function isSerializableInPayload(value) {
  return isPrimitive(value) ||
    !isSet(value) ||
    (value instanceof RegExp) ||
    _.isDate(value) ||
    isId(value) ||
    Buffer.isBuffer(value) ||
    isBSONTypeOf(value, 'Binary')
}

class DeferredPublicKeysRead extends DeferredRead {

  async read() {
    const { ac, parent, key } = this
    try {
      const result = await promised(modules.config, 'get', ac.org, null, { publicOnly: true }),
            reporting = ac.org.configuration.reporting

      pathTo(parent, key, Object.assign(result, { reporting }))
    } catch (err) {
      void err
    }
  }

}

class DeferredPackagesRead extends DeferredRead {

  async read() {
    const { ac, parent, key } = this
    try {
      const result = await promised(null, packageReader, ac.subject._id)
      pathTo(parent, key, result)
    } catch (err) {
      void err
    }
  }

}

function prepareEndpointsForNotification(org, payload, options) {
  let endpoints = {}
  if (utils.equalIds(payload.type, consts.emptyId) && !utils.isPlainObject(options.endpoints)) {
    throw Fault.create('cortex.invalidArgument.object', { reason: `Endpoints is required for no template notifications` })
  }

  if (options.apnsTopics || options.fcmTopic || utils.path(options.endpoints, 'push')) {
    Object.assign(endpoints, { push: {
      message: utils.rString(options.message, undefined),
      template: utils.rString(options.template, undefined),
      apn: { topics: options.apnsTopics || [] },
      fcm: { topic: utils.rString(options.fcmTopic, undefined) }
    } })
  }
  if (options.mobile || options.number || utils.path(options.endpoints, 'sms')) {
    Object.assign(endpoints, { sms: {
      mobile: utils.rString(options.mobile, undefined),
      number: utils.rString(options.number, undefined),
      message: utils.rString(options.message, undefined)
    } })
  }
  if (utils.path(options.endpoints, 'email')) {
    Object.assign(endpoints, { email: {
      template: utils.rString(options.template, undefined),
      message: utils.rString(options.message, undefined)
    } })
  }

  Object.assign(endpoints, options.endpoints || {})

  const push = utils.path(endpoints, 'push') || {},
        email = utils.path(endpoints, 'email') || {},
        apn = utils.path(push, 'apn') || {},
        template = utils.path(endpoints, 'email.template') || utils.path(endpoints, 'sms.template') || utils.path(endpoints, 'push.template'),
        isCustomPayload = utils.equalIds(payload.type, consts.emptyId),

        // validate attachments
        { allowAttachments } = org.configuration.notification.email
  if (email && email.attachments && !allowAttachments) {
    throw Fault.create('cortex.invalidArgument.object', { reason: `Org does not allow attachments in emails` })
  } else if (email && email.attachments) {
    for (let att of email.attachments) {
      let content = att.content
      if (!utils.isPlainObject(content)) {
        const parts = content.split('://'),
              type = parts[0]
        content = {
          [type]: parts[1],
          type,
          encode: true,
          dispose: false
        }
        att.content = content
      }
      if (att.content.encode === undefined) {
        att.content.encode = true
      }

      if (['buffer', 'config', 'cache', 'path'].indexOf(content.type) < 0) {
        throw Fault.create('cortex.invalidArgument.object', { reason: `Attachment content ${content.type} is not valid.` })
      }

      if (!att.disposition) {
        att.disposition = 'attachment'
      }

      if (att.disposition === 'inline' && !att.contentId) {
        throw Fault.create('cortex.invalidArgument.required', { reason: 'contentId is required when disposition is inline.' })
      }

    }
  }

  if (apn.priority && ['5', '10'].indexOf(apn.priority) < 0) {
    throw Fault.create('cortex.invalidArgument.string', { reason: `Priority could be 5 or 10 only` })
  }
  if (apn.expiration && new Date(apn.expiration).getTime() <= 0) {
    throw Fault.create('cortex.invalidArgument.numberExpected', { reason: `Expiration is not a valid timestamp` })
  }

  if (utils.equalIds(payload.type, consts.emptyId)) {
    for (let k of Object.keys(endpoints)) {
      if (k === 'sms' && (!utils.isSet(endpoints[k].message) && !utils.isSet(endpoints[k].template))) {
        endpoints[k].message = utils.isPlainObject(payload.variables) ? JSON.stringify(payload.variables) : payload.variables.toString()
      }
    }
  }
  // resolve topics
  if (push.apn) {
    if (push.apn.topics.length) {
      for (const topic of push.apn.topics) {
        if (!VALID_TOPICS.includes(topic)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid apn topic name.' })
        }
      }
    } else {
      utils.path(endpoints, 'push.apn.topics', ['app']) // default topic
    }
  }

  if (push.fcm) {
    if (_.isString(push.fcm.topic) && !push.fcm.topic.match(/[a-zA-Z0-9-_.~%]{1,900}/)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid fcm topic name.' })
    }

    if (_.isString(push.fcm.priority) && ['high', 'normal'].indexOf(push.fcm.priority.toLowerCase()) < 0) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid priority value (high or normal allowed)' })
    }
  }

  if (push.apn && _.isString(push.apn.pushType)) {
    if (!VALID_PUSH_TYPES.includes(push.apn.pushType)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid push type name.' })
    }
  }

  // eslint-disable-next-line one-var
  let number = utils.path(endpoints, 'sms.number') || options.number
  if (number) {
    if (utils.isCustomName(number)) {
      void 0 // use name as number
    } else if (_.isString(number) && !utils.isIdFormat(number) && number[0] !== '+') {
      number = '+' + number // make E.164
    }
    const selected = org.configuration.sms.numbers.filter(function(n) {
      return (n.name && n.name === number) || n.number === number || utils.equalIds(n._id, number)
    })[0]
    if (selected) {
      utils.path(endpoints, 'sms.number', selected._id)
    } else {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `The SMS endpoint number ${number} is invalid.` })
    }
  }

  if ((!isCustomPayload || template) && !utils.isPlainObject(payload.variables)) {
    throw Fault.create('cortex.invalidArgument.object', { reason: `variables must be a plain object when use templates` })
  }

  return endpoints
}

util.inherits(OrgDefinition, BuiltinContextModelDefinition)

OrgDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.sequence = options.sequence || 0
  options.statics = OrgDefinition.statics
  options.methods = OrgDefinition.methods
  options.indexes = OrgDefinition.indexes
  options.options = { collection: OrgDefinition.collection }
  options.apiHooks = OrgDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

OrgDefinition.collection = 'contexts'

OrgDefinition.prototype.addProperty = function(prop) {

  if (prop.name === 'creator') {
    prop.writable = true
    prop.writeAccess = acl.AccessLevels.System
    prop.writer = function(ac, node, value, options, callback) {
      let id = utils.getIdOrNull(value)
      if (id) {
        value = {
          _id: id
        }
        callback(null, value)
      } else {
        ap.create(this._id, value, null, (err, principal) => {
          if (!err && !principal.isOrgAdmin()) {
            err = Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Org root account must hold the administrator role.' })
          }
          if (!err) {
            this.creator = principal ? { _id: principal._id } : { _id: consts.emptyId }
            this.markModified('creator')
          }
          if (err) {
            err.path = node.fqpp
          }
          callback(err, undefined)
        })
      }
    }
  }

  return BuiltinContextModelDefinition.prototype.addProperty.call(this, prop)

}

OrgDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.org,
    objectLabel: 'Organization',
    objectName: 'org',
    pluralName: 'orgs',
    collection: 'contexts',
    uniqueKey: 'code',
    isExtensible: true,
    auditing: {
      enabled: true,
      all: true,
      category: 'configuration'
    },
    defaultAclOverride: false,
    defaultAclExtend: false,
    allowConnections: true,
    allowConnectionsOverride: false,
    defaultAcl: [ // everyone gets public access, and admins get update access.
      { type: acl.AccessTargets.Account, target: acl.AnonymousIdentifier, allow: acl.AccessLevels.Public },
      { type: acl.AccessPrincipals.Creator, allow: acl.AccessLevels.Update },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Update }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    obeyObjectMode: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected, acl.AccessLevels.None], // special 'None' for invite-only to orgs.
    shareChainOverride: false,
    shareAclOverride: false,
    isFavoritable: false,
    hasCreator: true,
    hasOwner: false,
    nativeSchemaVersion: 1, // update this whenever we add new properties to the definition
    properties: [
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        // description: 'The Org label.',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'printableString',
          definition: { min: 1, max: 100, anyFirstLetter: false }
        }]
      },
      new OrgPolicyDefinition({
        label: 'Policies',
        name: 'policies',
        type: 'Document',
        default: [],
        optional: true,
        canPull: true,
        canPush: true,
        array: true,
        maxItems: 50,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        puller: function(ac, node, value) {
          ac.hook('save').before(function(vars, callback) {
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                return ac.object.fireHook('policy.removed.before', null, { ac: ac, policyId: value }, callback)
              }
            }
            callback()
          })
          ac.hook('save').after(function(vars) {
            if (~vars.modified.indexOf('policies')) {
              if (!~ac.subject.policies.indexOf(value)) {
                ac.object.fireHook('policy.removed.after', null, { ac: ac, policyId: value }, () => {})
              }
            }
          })
          return value
        }
      }),
      new OrgAppDefinition({
        label: 'Apps',
        name: 'apps',
        type: 'Document',
        // description: 'The Org\'s configured applications.',
        optional: true,
        dependencies: ['configuration.canCreateApps', 'configuration.maxApps', 'apps.clients._id'],
        readable: true,
        canPull: true,
        canPush: true,
        array: true,
        uniqueKey: 'name',
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        pusher: function(ac, node, values) {
          if (!ac.principal.isSysAdmin()) {
            let current = toArray(pathTo(this, node.path)).length,
                total = current + values.length
            if (total > current && !ac.subject.configuration.canCreateApps) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'This Org app creation has been disabled.' })
            } else if (total > ac.subject.configuration.maxApps) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'You have reached your limit of ' + ac.subject.configuration.maxApps + ' apps' })
            }
          }
          return values
        },
        puller: function(ac, node, value) {
          const clientIds = toArray(pathTo(utils.findIdInArray(this.apps, '_id', value), 'clients')).map(v => v._id)
          ac.hook('save').before(function(vars, callback) {
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                return ac.object.fireHook('app.removed.before', null, { ac: ac, appId: value, clientIds: clientIds }, callback)
              }
            }
            callback()
          })
          ac.hook('save').after(function(vars) {
            if (~vars.modified.indexOf('apps')) {
              if (!~ac.subject.apps.indexOf(value)) {
                ac.object.fireHook('app.removed.after', null, { ac: ac, appId: value, clientIds: clientIds }, () => {})
              }
            }
          })
          return value
        }
      }),
      {
        label: 'State',
        name: 'state',
        type: 'String',
        // description: 'The Org state.',
        writeAccess: acl.AccessLevels.System,
        readable: true,
        writable: true,
        nativeIndex: true,
        validators: [{
          name: 'stringEnum',
          definition: { values: _.values(consts.orgStates) }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value) {
              if (equalIds(acl.BaseOrg, ac.subjectId) && value !== 'enabled') {
                throw Fault.create('cortex.accessDenied.unspecified', { reason: 'The Medable org cannot be disabled.' })
              }
              return true
            }
          }
        }],
        default: 'enabled'
      },
      {
        label: 'Maintenance Mode',
        name: 'maintenance',
        type: 'Boolean',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        default: false,
        stub: false
      },
      {
        label: 'Maintenance Message',
        name: 'maintenanceMessage',
        type: 'String',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        default: '',
        stub: '',
        validators: [{
          name: 'string',
          definition: {
            min: 0,
            max: 512
          }
        }]
      },
      {
        label: 'Bundle Version',
        name: 'bundleVersion',
        type: 'Number',
        public: false,
        // description: 'The current version of the Org\'s string bundle.',
        readAccess: acl.AccessLevels.Public,
        virtual: true,
        reader: function() {
          return 0
        }
      },
      {
        label: 'Schemas ETag',
        name: 'schemasETag',
        type: 'String',
        // description: 'Org schemas ETag',
        readAccess: acl.AccessLevels.Public,
        virtual: true,
        reader: function(ac) {
          return modules.schemas.calculateSchemasETag(ac.org, ac.org.objects)
        }
      },
      {
        label: 'Locale',
        name: 'locale',
        type: 'String',
        // description: 'The Org\'s default locale setting.',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        default: 'en_US'
      },
      {
        label: 'Timezone',
        name: 'tz',
        type: 'String',
        // description: 'Org\'s timezone, used for determining UTC offset in scripts if timezone is not available for principal',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        validators: [{
          name: 'timeZone'
        }]
      },
      {
        label: 'Support Options',
        name: 'support',
        type: 'Document',
        select: false,
        optional: true,
        writable: true,
        properties: [
          {
            label: 'Disable Support Login',
            name: 'disableSupportLogin',
            type: 'Boolean',
            writable: true,
            default: (config('app.env') === 'production' && config('app.domain') === 'market')
          },
          {
            label: 'Pinned Account',
            name: 'pinnedAccount',
            type: 'String',
            writable: true,
            default: '',
            validators: [{
              name: 'email',
              definition: { allowNull: true }
            }]
          }
        ]
      },
      {
        label: 'Security',
        name: 'security',
        type: 'Document',
        // description: 'Org security settings.',
        writable: true,
        properties: [
          {
            label: 'Unauthorized Access',
            name: 'unauthorizedAccess',
            type: 'Document',
            // description: 'Unauthorized access settings.',
            writable: true,
            properties: [
              {
                label: 'Lock Attempts',
                name: 'lockAttempts',
                // description: 'The number of failed sign-in attempts before the account is locked. Set to 0 to disable account locking.',
                type: 'Number',
                default: 5,
                writable: true,
                validators: [{
                  name: 'number',
                  definition: {
                    allowDecimal: false,
                    min: 0
                  }
                }]
              },
              {
                label: 'Lock Duration',
                name: 'lockDuration',
                // description: 'The number of minutes an account locked due to failed sign-ins will remain locked. Set to 0 to lock an account indefinitely.',
                type: 'Number',
                default: 15,
                writable: true,
                validators: [{
                  name: 'number',
                  definition: {
                    allowDecimal: false,
                    min: 0
                  }
                }]
              }]
          }
        ]
      },
      {
        label: 'Registration',
        name: 'registration',
        type: 'Document',
        // description: 'Org registration settings.',
        writable: true,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
        properties: [
          {
            label: 'Bypass Account Verification',
            name: 'bypassAccountVerification',
            type: 'Boolean',
            // description: 'Auto verifiy accounts',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: false,
            stub: false
          },
          {
            label: 'Allow',
            name: 'allow',
            type: 'Boolean',
            // description: 'True if account registration through /account/register is enabled. When false, accounts must be manually provisioned.',
            acl: acl.Inherit,
            readable: true,
            writable: true,
            default: false
          },
          {
            label: 'Allow Provider Registration',
            name: 'allowProviders',
            type: 'Boolean',
            // description: 'True to enable registration of accounts with the provider role through /account/register. When false, provider accounts must be manually provisioned',
            readable: true,
            acl: acl.Inherit,
            writable: true,
            default: false
          },
          {
            label: 'Manual Provider Verification',
            name: 'manualProviderVerification',
            type: 'Boolean',
            // description: 'When true, provider state (as opposed to account state) verification requests are handled by the administrator. If false, provider accounts are automatically set to a verified state.',
            readable: true,
            acl: acl.Inherit,
            writable: true,
            default: false
          },
          {
            label: 'Invitation Required',
            name: 'invitationRequired',
            type: 'Boolean',
            // description: 'When true, and self-registration is enabled, users can only register if invited through a connection request.',
            readable: true,
            acl: acl.Inherit,
            writable: true,
            default: false
          },
          {
            label: 'Activation Required',
            name: 'activationRequired',
            type: 'Boolean',
            // description: 'When true, newly registered accounts that were not created through a connection request must verify their email address prior to authentication.',
            readable: true,
            writable: true,
            acl: acl.Inherit,
            default: false
          }]
      }, {
        label: 'Hub',
        name: 'hub',
        type: 'Document',
        writable: false,
        optional: true,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
        properties: [
          {
            label: 'Enabled',
            name: 'enabled',
            type: 'Boolean',
            acl: acl.Inherit
          },
          {
            label: 'Env Api Key',
            name: 'envKey',
            type: 'String',
            readable: false
          },
          {
            label: 'Env Api Secret',
            name: 'envSecret',
            type: 'String',
            readable: false
          },
          {
            label: 'Client Api Key',
            name: 'clientKey',
            type: 'String',
            readable: false
          },
          {
            label: 'Client RSA',
            name: 'clientRsa',
            type: 'Document',
            readable: false,
            properties: [{
              label: 'Generation Unix Timestamp',
              name: 'timestamp',
              type: 'Date',
              readable: false
            },
            {
              label: 'Public Key',
              name: 'public',
              type: 'String',
              acl: acl.Inherit,
              readable: false
            },
            {
              label: 'Private Key',
              name: 'private',
              type: 'String',
              readable: false
            }
            ]
          }]
      },
      {
        label: 'Deployment',
        name: 'deployment',
        type: 'Document',
        writable: true,
        optional: true,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
        properties: [
          {
            label: 'Enabled',
            name: 'enabled',
            type: 'Boolean',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            writable: true,
            default: false,
            stub: false
          },
          {
            label: 'Support Only',
            name: 'supportOnly',
            type: 'Boolean',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: true,
            stub: true
          },
          {
            label: 'In Progress',
            name: 'inProgress',
            type: 'Boolean',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: false,
            stub: false
          },
          {
            public: false,
            label: 'Backup Blob',
            name: 'backup',
            type: 'ObjectId',
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System,
            writable: true
          },
          {
            label: 'Allow Edits',
            name: 'allowEdits',
            type: 'Boolean',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            writable: true,
            default: config('deploy.allowEdits'),
            stub: config('deploy.allowEdits')
          },
          {
            label: 'Availability',
            name: 'availability',
            type: 'Number',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            writable: true,
            default: config('deploy.defaultAvailability'),
            stub: config('deploy.defaultAvailability'),
            validators: [{
              name: 'numberEnum',
              definition: {
                values: _.values(consts.deployment.availability)
              }
            }]
          },
          {
            label: 'Targets',
            name: 'targets',
            type: 'Document',
            array: true,
            canPush: true,
            canPull: true,
            writeOnCreate: true,
            dependencies: ['deployment'],
            validators: [{
              name: 'adhoc',
              definition: {
                asArray: true,
                post: true,
                validator: function(ac, node, values) {
                  let added,
                      targets = values.map(function(value) {
                        if (value.server === config('server.apiHost') && value.code === ac.org.code) {
                          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'A deployment target cannot match the source.' })
                        }
                        return value.server + '/' + value.code
                      })
                  if (targets.length !== _.uniq(targets).length) {
                    throw Fault.create('cortex.conflict.exists', { reason: 'Deployment targets cannot be duplicated.' })
                  }

                  added = values.filter(function(value) {
                    return value.isNew
                  }).map(function(value) {
                    return value.id
                  })

                  ac.hook('save').after(vars => {
                    added.forEach(targetId => {
                      let target = utils.findIdInArray(pathTo(this, node.docpath), '_id', targetId)
                      if (target) {
                        modules.deployment.requestTarget(vars.ac.org, target)
                      }
                    })
                  })
                  return true
                }
              }
            }],
            properties: [
              {
                label: 'Server',
                name: 'server',
                type: 'String',
                creatable: true,
                trim: true,
                validators: [{
                  name: 'required'
                }, {
                  name: 'pattern',
                  definition: {
                    message: 'A valid hostname',
                    pattern: '/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$/'
                  }
                }]
              },
              {
                label: 'Org Code',
                name: 'code',
                type: 'String',
                creatable: true,
                lowercase: true,
                trim: true,
                validators: [
                  {
                    name: 'required'
                  },
                  {
                    name: 'pattern',
                    definition: {
                      message: 'A string containing at least 3 letters and numbers (up to 40), without the word "medable".',
                      pattern: '/^(?!.*medable.*)(?=[-_]*[a-z0-9]{3,}[a-z0-9-_]*)[a-z0-9-_]{3,40}$/i',
                      skip: function() {
                        return equalIds(modules.db.getRootDocument(this)._id, acl.BaseOrg)
                      }
                    }
                  },
                  {
                    name: 'pattern',
                    definition: {
                      message: 'A string that does not match the signature of an ObjectId',
                      pattern: '/^(?!^[0-9a-fA-F]{24}$).*$/i'
                    }
                  }]
              },
              {
                label: 'State',
                name: 'state',
                type: 'String',
                writable: true,
                writeAccess: acl.AccessLevels.System,
                default: 'Pending',
                validators: [{
                  name: 'stringEnum',
                  definition: {
                    values: ['Pending', 'Rejected', 'Active', 'Error']
                  }
                }]
              },
              {
                label: 'Error Reason',
                name: 'reason',
                type: 'String',
                writable: true,
                writeAccess: acl.AccessLevels.System
              },
              {
                label: 'Token',
                name: 'token',
                type: 'String',
                readAccess: acl.AccessLevels.System
              }
            ]
          },
          {
            label: 'Sources',
            name: 'sources',
            type: 'Document',
            array: true,
            canPush: true,
            canPull: true,
            dependencies: ['deployment'],
            puller: function(ac, node, value) {

              let sources = pathTo(this, node.docpath),
                  pulled = ac.option('$deployment.source.pulled') || [],
                  doc = utils.findIdInArray(sources, '_id', value)

              if (!doc) {
                return value
              }

              pulled.push(doc.toObject())
              ac.option('$deployment.source.pulled', pulled)

              ac.hook('save').after(function(vars) {
                let sources = pathTo(vars.ac.subject, node.docpath),
                    pulled = ac.option('$deployment.source.pulled') || []
                pulled.forEach(function(pulled) {
                  if (!~sources.indexOf(pulled._id)) {
                    modules.deployment.respondSource(vars.ac.org, pulled, 'Rejected')
                  }
                })
                vars.ac.option('$deployment.source.pulled', null)
              }, 'deployment.source.pulled', true)

              return value
            },
            writeOnCreate: true,
            validators: [{
              name: 'adhoc',
              definition: {
                asArray: true,
                post: true,
                validator: function(ac, node, values) {
                  let targets = values.map(function(value) {
                    if (value.server === config('server.apiHost') && value.code === ac.org.code) {
                      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'A deployment target cannot match the source.' })
                    }
                    return value.server + '/' + value.code
                  })
                  if (targets.length !== _.uniq(targets).length) {
                    throw Fault.create('cortex.conflict.exists', { reason: 'Deployment targets cannot be duplicated.' })
                  }
                  return true
                }
              }
            }],
            properties: [{
              label: 'Server',
              name: 'server',
              type: 'String',
              writeAccess: acl.AccessLevels.System,
              creatable: true,
              trim: true,
              validators: [{
                name: 'required'
              }, {
                name: 'pattern',
                definition: {
                  message: 'A valid hostname',
                  pattern: '/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$/'
                }
              }]
            }, {
              label: 'Org Code',
              name: 'code',
              type: 'String',
              writeAccess: acl.AccessLevels.System,
              creatable: true,
              lowercase: true,
              trim: true,
              validators: [{
                name: 'required'
              }, {
                name: 'pattern',
                definition: {
                  message: 'A string containing at least 3 letters and numbers (up to 40).',
                  pattern: '/^(?=[-_]*[a-z0-9]{3,}[a-z0-9-_]*)[a-z0-9-_]{3,40}$/i'
                }
              }, {
                name: 'pattern',
                definition: {
                  message: 'A string that does not match the signature of an ObjectId',
                  pattern: '/^(?!^[0-9a-fA-F]{24}$).*$/i'
                }
              }]
            }, {
              label: 'State',
              name: 'state',
              type: 'String',
              writable: true,
              default: 'Pending',
              validators: [{
                name: 'stringEnum',
                definition: {
                  values: ['Pending', 'Active']
                }
              }, {
                name: 'adhoc',
                definition: {
                  validator: function(ac, node, value) {

                    if (ac.resolved === acl.AccessLevels.System) {
                      return true
                    }

                    if (value !== 'Active') {
                      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Source state can only be set Active, or the source removed entirely.' })
                    }

                    let activated = ac.option('$deployment.source.activated') || []
                    activated.push(this.toObject())
                    ac.option('$deployment.source.activated', activated)

                    ac.hook('save').after(function(vars) {
                      let // sources = pathTo(vars.ac.subject, 'deployment.sources'),
                          activated = ac.option('$deployment.source.activated') || []
                      activated.forEach(function(source) {
                        modules.deployment.respondSource(vars.ac.org, source, 'Active')
                      })
                      vars.ac.option('$deployment.source.activated', null)
                    }, 'deployment.source.activated', true)

                    return true
                  }
                }
              }]
            }, {
              label: 'Token',
              name: 'token',
              type: 'String',
              writable: true,
              readAccess: acl.AccessLevels.System,
              writeAccess: acl.AccessLevels.System
            }]
          }
        ]
      },
      {
        label: 'Configuration',
        name: 'configuration',
        type: 'Document',
        // description: 'Org configuration settings.',
        writable: true,
        readAccess: acl.AccessLevels.Public,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
        properties: [
          {
            label: 'Reporting',
            name: 'reporting',
            type: 'Document',
            acl: acl.Inherit,
            readAccess: acl.AccessLevels.Public,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            properties: [{
              label: 'Enabled',
              name: 'enabled',
              type: 'Boolean',
              acl: acl.Inherit,
              readAccess: acl.AccessLevels.Public,
              writeAccess: acl.AccessLevels.System,
              readable: true,
              writable: true,
              default: false
            }]
          },
          {
            label: 'Default Identifier Sort Order',
            name: 'defaultIdentifierSortOrder',
            type: 'Number',
            default: -1, // for legacy orgs
            writable: true,
            validators: [{
              name: 'numberEnum',
              definition: {
                values: [-1, 0, 1]
              }
            }]
          },
          {
            label: 'String accessRoles',
            name: 'stringAccessRoles',
            type: 'Boolean',
            default: false,
            writable: true
          },
          {
            label: 'Enable Legacy Objects (PatientFile/Conversation)',
            name: 'legacyObjects',
            type: 'Boolean',
            default: false,
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          {
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
            label: 'Legacy Audit History Values',
            name: 'legacyAuditHistoryValues',
            type: 'Boolean',
            default: true,
            writable: true
          },
          {
            label: 'Allow Websocket Jwt Scopes',
            name: 'allowWsJwtScopes',
            type: 'Boolean',
            default: false,
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          {
            label: 'Stream Exports Locally',
            name: 'localExportStreams',
            type: 'Boolean',
            default: false,
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          new OrgPolicyDefinition({
            label: 'System Policies',
            name: 'systemPolicies',
            type: 'Document',
            optional: true,
            canPull: true,
            canPush: true,
            array: true,
            maxItems: 50,
            default: [],
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System
          }, true),
          {
            label: 'Default Custom Contexts Collection',
            name: 'defaultCollection',
            type: 'String',
            default: 'contexts',
            writable: true,
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System,
            dependencies: ['code'],
            writer: function(ac, node, value) {
              value = utils.rString(value, '').toLowerCase().trim()
              if (value !== 'contexts') {
                if (value.indexOf('ctx.') !== 0) {
                  value = `ctx.${value}`
                }
              }
              return value
            },
            validators: [{
              name: 'adhoc',
              definition: {
                validator: function(ac, node, targetCollection) {
                  if (ac.subject.code === 'medable' && targetCollection !== 'contexts') {
                    throw Fault.create('cortex.accessDenied.unspecified', { reason: 'default collection cannot be modified in this org.' })
                  }
                  if (targetCollection !== 'contexts') {
                    if (!targetCollection.match(/^ctx\.[a-z0-9_-]{3,40}(\.[a-z0-9_-]{3,40})?$/)) {
                      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'targetCollection must match /^ctx\\.[a-z0-9_-]{3,40}(\\.[a-z0-9_-]{3,40})?$/' })
                    }
                  }
                  return true
                }
              }
            }]
          },
          {
            label: 'Custom Contexts Object Mode',
            name: 'objectMode',
            type: 'String',
            default: 'cud',
            writable: true,
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System,
            lowercase: true,
            trim: true,
            validators: [{
              name: 'adhoc',
              definition: {
                validator: function(ac, node, mode) {
                  if (mode.length && !mode.match(/^(?!.*(.).*\1)[cud]+$/)) {
                    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'objectMode must be made up of "cud"' })
                  }
                  return true
                }
              }
            }]
          },
          {
            label: 'Enable buffer uploads (from script)',
            name: 'allowBufferSources',
            type: 'Boolean',
            default: false,
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          {
            label: 'Default parser engine',
            name: 'defaultParserEngine',
            type: 'String',
            default: 'stable',
            writable: true,
            writeAccess: acl.AccessLevels.System,
            validators: [{
              name: 'required'
            }, {
              name: 'stringEnum',
              definition: {
                values: modules.parser.engineNames
              }
            }]
          },
          {
            label: 'Enable streaming uploads (multipart/form-data)',
            name: 'allowStreamingUploads',
            type: 'Boolean',
            default: false,
            writable: true,
            writeAccess: acl.AccessLevels.System
          },
          new OrgNotificationDefinition(),
          {
            label: 'Event Options',
            name: 'events',
            type: 'Document',
            array: false,
            writable: true,
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
            properties:
            [
              {
                label: 'Soft Limit',
                name: 'softLimit',
                type: 'Number',
                acl: acl.Inherit,
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: config('events.defaultSoftLimit')
              },
              {
                label: 'Hard Limit',
                name: 'hardLimit',
                type: 'Number',
                acl: acl.Inherit,
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: config('events.defaultHardLimit')
              },
              {
                label: 'Trigger Soft Limit',
                name: 'triggerSoftLimit',
                type: 'Boolean',
                acl: acl.Inherit,
                writable: true,
                default: true
              },
              {
                label: 'Trigger Hard Limit',
                name: 'triggerHardLimit',
                type: 'Boolean',
                acl: acl.Inherit,
                writable: true,
                default: true
              }
            ]
          },
          {
            label: 'Storage Options',
            name: 'storage',
            type: 'Document',
            array: false,
            writable: true,
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
            properties: [
              {
                label: 'Default S3 Read Url Expiry Seconds',
                name: 'defaultS3ReadUrlExpiry',
                type: 'Number',
                acl: acl.Inherit,
                writable: true,
                default: config('uploads.s3.readUrlExpiry'),
                validators: [{
                  name: 'number',
                  definition: { min: 5, max: 604800, allowNull: false, allowDecimal: false }
                }]
              },
              {
                label: 'Enable Locations',
                name: 'enableLocations',
                type: 'Number',
                acl: acl.Inherit,
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: false
              },
              {
                // default location
                label: 'Default Location',
                name: 'defaultLocation',
                type: 'String',
                acl: acl.Inherit,
                writable: true,
                default: consts.storage.availableLocationTypes.medable,
                dependencies: ['.locations'],
                validators: [{
                  name: 'required'
                }, {
                  name: 'adhoc',
                  definition: {
                    validator: function(ac, node, value) {
                      if (consts.storage.availableLocationTypes.medable === value) {
                        return true
                      }
                      const location = toArray(pathTo(ac.org.configuration.storage, 'locations')).find(v => v.name === value)
                      if (!location) {
                        throw Fault.create('cortex.notFound.storage', { reason: 'The storage location does not exist.' })
                      } else if (!location.active) {
                        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The storage location is not available.' })
                      }
                      return true
                    }
                  }
                }]
              },
              {
                // force an export location
                label: 'Exports Location',
                name: 'exportLocation',
                type: 'String',
                acl: acl.Inherit,
                writable: true,
                default: consts.storage.availableLocationTypes.medable,
                dependencies: ['.locations'],
                validators: [{
                  name: 'required'
                }, {
                  name: 'adhoc',
                  definition: {
                    validator: function(ac, node, value) {
                      if (Object.values(consts.storage.availableLocationTypes).includes(value)) {
                        return true
                      }
                      const location = toArray(pathTo(ac.org.configuration.storage, 'locations')).find(v => v.name === value)
                      if (!location) {
                        throw Fault.create('cortex.notFound.storage', { reason: 'The storage location does not exist.' })
                      } else if (!location.active) {
                        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'The storage location is not available.' })
                      } else if (!['aws-s3', 's3-endpoint'].includes(location.type)) {
                        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Exports only support AWS S3 storage.' })
                      }
                      return true
                    }
                  }
                }]
              },
              {
                label: 'Locations',
                name: 'locations',
                type: 'Set',
                minItems: 0,
                maxItems: 10,
                default: [],
                optional: true,
                discriminatorKey: 'type',
                uniqueProp: 'name',
                uniqueKey: 'name',
                canPull: true,
                canPush: true,
                array: true,
                acl: acl.Inherit,
                puller: function(ac, node, value) {
                  const storageDoc = utils.findIdInArray(pathTo(this, node.docpath), '_id', value),
                        storageId = storageDoc && storageDoc.name
                  ac.hook('save').before(function(vars, callback) {
                    if (~vars.modified.indexOf(node.fullpath)) {
                      if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                        return ac.object.fireHook('storageLocation.removed.before', null, { ac, storageId }, callback)
                      }
                    }
                    callback()
                  })
                  ac.hook('save').after(function(vars) {
                    if (~vars.modified.indexOf('apps')) {
                      if (!~ac.subject.apps.indexOf(value)) {
                        ac.object.fireHook('storageLocation.removed.after', null, { ac, storageId }, () => {})
                      }
                    }
                  })
                  return value
                },
                export: async function(ac, doc, resourceStream, parentResource, options) {

                  const resourcePath = `storageLocation.${doc && doc.name}`

                  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
                    return Undefined
                  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
                    return Undefined
                  } else if (!doc.name) {
                    if (resourceStream.silent) {
                      return Undefined
                    }
                    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', { resource: ac.getResource(), path: `storageLocation.${doc.label}` })
                  } else {

                    const def = _.omit(
                      (await SetDefinition.prototype.export.call(this, ac, [doc], resourceStream, parentResource, { ...options, required: true, nodePath: 'storageLocations' }))[0],
                      'secretAccessKey'
                    )

                    def.object = 'storageLocation'

                    return resourceStream.exportResource(def, resourcePath)

                  }

                },
                import: async function(ac, doc, resourceStream, parentResource, options) {

                  const resourcePath = `storageLocation.${doc && doc.name}`

                  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
                    return Undefined
                  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
                    return Undefined
                  } else {

                    const docs = (await SetDefinition.prototype.import.call(this, ac, [doc], resourceStream, parentResource, { ...options, required: true, nodePath: 'storageLocations' }))

                    return resourceStream.updateEnvironment(async(ac) => {

                      let existing = ac.org.configuration.storage.locations.find(loc => loc.name && loc.name === doc.name),
                          def = clone(docs[0])

                      if (existing) {
                        def._id = existing._id
                      } else {
                        def.name = doc.name
                      }

                      ac.method = existing ? 'put' : 'post'
                      await promised(this, 'aclWrite', ac, ac.org, def)

                      return ac.org.configuration.storage.locations.find(loc => loc.name && loc.name === doc.name)

                    })

                  }

                },

                // shared properties
                properties: [
                  {
                    label: 'Label',
                    name: 'label',
                    type: 'String',
                    writable: true,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'string',
                      definition: {
                        allowNull: false,
                        min: 1,
                        max: 100
                      }
                    }]
                  },
                  {
                    label: 'Name',
                    name: 'name',
                    type: 'String',
                    readable: true,
                    creatable: true,
                    trim: true,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'customName'
                    }, {
                      name: 'uniqueInArray'
                    }],
                    writer: function(ac, node, v) {
                      return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
                    }
                  },
                  {
                    // location is active
                    label: 'Active',
                    name: 'active',
                    type: 'Boolean',
                    writable: true,
                    default: true,
                    acl: acl.Inherit,
                    dependencies: ['.name', '..defaultLocation', '..exportLocation'],
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'adhoc',
                      definition: {
                        validator: function(ac, node, value) {
                          const doc = modules.db.getRootDocument(this)
                          if (!value) {
                            if (this.name === doc.configuration.storage.defaultLocation) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'The default storage location cannot be deactivated.' })
                            }
                            if (this.name === doc.configuration.storage.exportLocation) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'The export storage location cannot be deactivated.' })
                            }
                          }
                          return true
                        }
                      }
                    }]
                  },
                  {
                    // managed locations calculate storage and have their resources cleaned up.
                    // not currently writable as we don't support deletions.
                    label: 'Managed',
                    name: 'managed',
                    type: 'Boolean',
                    writable: true,
                    default: false,
                    acl: acl.Inherit,
                    validators: [{
                      name: 'required'
                    }]
                  },
                  {
                    label: 'Export TTL Days',
                    name: 'exportTtlDays',
                    type: 'Number',
                    writable: true,
                    default: 7,
                    acl: acl.Inherit,
                    writer: function(ac, node, value) {
                      if (value === null || value === undefined || value === '') {
                        return null
                      }
                      return value
                    },
                    validators: [{
                      name: 'number',
                      definition: { min: 1, max: config('exports.maxTtlDays'), allowNull: true, allowDecimal: false }
                    }]
                  },
                  {
                    label: 'Read Url Expiry Seconds',
                    name: 'readUrlExpiry',
                    type: 'Number',
                    acl: acl.Inherit,
                    writable: true,
                    default: null,
                    writer: function(ac, node, value) {
                      if (value === null || value === undefined || value === '') {
                        return null
                      }
                      return value
                    },
                    validators: [{
                      name: 'number',
                      definition: { min: 5, max: 604800, allowNull: true, allowDecimal: false }
                    }]
                  },
                  {
                    label: 'Passive',
                    name: 'passive',
                    type: 'Boolean',
                    readable: true,
                    writable: true,
                    acl: acl.Inherit,
                    default: false
                  },
                  {
                    label: 'Access Key',
                    name: 'accessKeyId',
                    type: 'String',
                    acl: acl.Inherit,
                    writable: true,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'string',
                      definition: {
                        min: 1,
                        max: 512
                      }
                    }]
                  },
                  {
                    label: 'Access Secret',
                    name: 'secretAccessKey',
                    type: 'String',
                    acl: acl.Inherit,
                    writable: true,
                    default: '',
                    validators: [{
                      name: 'string',
                      definition: {
                        min: 0,
                        max: 512
                      }
                    }
                    ],
                    writer: function(ac, node, value) {
                      if (/^\*{1,}$/.test(String(value).trim())) {
                        return Undefined
                      }
                      return value
                    },
                    reader: function(ac, node, selection) {
                      return '*'.repeat((this.secretAccessKey || '').length)
                    }
                  },
                  {
                    label: 'Bucket',
                    name: 'bucket',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'string',
                      definition: {
                        min: 1,
                        max: 512
                      }
                    }]
                  },
                  {
                    label: 'Prefix',
                    name: 'prefix',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    default: '',
                    validators: [{
                      name: 'string',
                      definition: {
                        min: 0,
                        max: 512
                      }
                    }]
                  }
                ],
                documents: [
                  {
                    label: 'AWS S3',
                    name: 'aws-s3',
                    type: 'Document',
                    writable: true,
                    properties: [
                      {
                        label: 'Region',
                        name: 'region',
                        type: 'String',
                        writable: true,
                        acl: acl.Inherit,
                        validators: [{
                          name: 'required'
                        }, {
                          name: 'stringEnum',
                          definition: {
                            values: ['us-east-2', 'us-east-1', 'us-west-1', 'us-west-2', 'ca-central-1', 'ap-south-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'cn-north-1', 'cn-northwest-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1']
                          }
                        }]
                      }
                    ]
                  },
                  {
                    label: 'S3 Compatible',
                    name: 's3-endpoint',
                    type: 'Document',
                    writable: true,
                    properties: [
                      {
                        label: 'Endpoint URI',
                        name: 'endpoint',
                        type: 'String',
                        writable: true,
                        acl: acl.Inherit,
                        validators: [{
                          name: 'required'
                        }, {
                          name: 'url',
                          definition: {
                            webOnly: true,
                            webSecure: true
                          }
                        }]
                      },
                      {
                        label: 'CA Bundle',
                        name: 'ca',
                        type: 'String',
                        readable: true,
                        writable: true,
                        trim: true,
                        acl: acl.Inherit,
                        default: '',
                        validators: [{
                          name: 'adhoc',
                          definition: {
                            code: 'cortex.invalidArgument.certificateOrKeyFormat',
                            message: 'Invalid certificate format',
                            validator: function(ac, node, value) {
                              function endsWith(str, suffix) {
                                return str.indexOf(suffix, str.length - suffix.length) !== -1
                              }
                              if (_.isString(value)) {
                                const begin = '-----BEGIN CERTIFICATE-----', end = '-----END CERTIFICATE-----'
                                if (value.length === 0) {
                                  return true
                                } else if (value.indexOf(begin) === 0 && endsWith(value, end)) {
                                  const base64 = value.substr(begin.length, value.length - (begin.length + end.length)).replace(/\r\n|\n|\r/gm, '')
                                  return !!base64.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/)
                                }
                              }
                              return false
                            }
                          }
                        }]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'SMS Options',
            name: 'sms',
            // description: 'The application\'s endpoint urls.',
            type: 'Document',
            array: false,
            writable: true,
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
            export: false,
            import: false,
            properties: [
              {
                label: 'Allow Internal Over Custom Number',
                name: 'internalOverCustom',
                type: 'Boolean',
                writable: true,
                acl: acl.Inherit,
                writeAccess: acl.AccessLevels.System,
                default: false
              },
              {
                label: 'Allow Custom SMS Notifications over internal number.',
                name: 'customOverInternal',
                type: 'Boolean',
                writable: true,
                acl: acl.Inherit,
                writeAccess: acl.AccessLevels.System,
                default: false
              },
              {
                label: 'Numbers',
                name: 'numbers',
                type: 'Document',
                canPull: true,
                canPush: true,
                acl: acl.Inherit,
                array: true,
                maxItems: 5,
                uniqueKey: 'name',
                dependencies: ['configuration.sms.numbers'], // load the entire array to ensure we pass the guard so the write can update others.
                onRemovingValue: function(ac, node, value, index) {
                  if (value.isDefault) {
                    let numbers = pathTo(this, node.fullpath),
                        setting = true
                    for (let i = 0; i < numbers.length; i++) {
                      if (i !== index) {
                        numbers[i].isDefault = setting
                        setting = false
                      }
                    }
                  }
                },
                import: async function(ac, doc, resourceStream, parentResource, options) {

                  const resourcePath = `smsNumber.${doc && doc.name}`

                  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
                    return Undefined
                  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
                    return Undefined
                  } else {

                    return resourceStream.updateEnvironment(async(ac) => {

                      const existing = ac.org.configuration.sms.numbers.find(v => v.name && v.name === doc.name),
                            def = _.pick(doc, [
                              'number',
                              'isDefault',
                              'provider',
                              'accountSid'
                            ])

                      if (existing) {
                        def._id = existing._id
                      } else {
                        def.name = doc.name
                      }

                      ac.method = existing ? 'put' : 'post'
                      await promised(this, 'aclWrite', ac, ac.org, def)

                      return ac.org.configuration.sms.numbers.find(v => v.name && v.name === doc.name)

                    })

                  }

                },
                export: async function(ac, doc, resourceStream, parentResource, options) {

                  const resourcePath = `smsNumber.${doc && doc.name}`,
                        def = _.pick(doc || {}, [
                          'name',
                          'number',
                          'isDefault',
                          'provider',
                          'accountSid'
                        ])

                  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
                    return Undefined
                  } else if (!doc.name) {
                    if (resourceStream.silent) {
                      return Undefined
                    }
                    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', { resource: ac.getResource(), path: `smsNumber.${doc.number}` })
                  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
                    return Undefined
                  }

                  def.object = 'smsNumber'

                  return resourceStream.exportResource(sortKeys(def), resourcePath)

                },
                puller: function(ac, node, value) {
                  ac.hook('save').before(function(vars, callback) {
                    if (~vars.modified.indexOf(node.fullpath)) {
                      if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                        ac.object.fireHook('sms-number.removed.before', null, { ac: ac, numberId: value }, callback)
                      }
                    }
                  })
                  ac.hook('save').after(function(vars) {
                    if (~vars.modified.indexOf(node.fullpath)) {
                      if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                        ac.object.fireHook('sms-number.removed.after', null, { ac: ac, numberId: value }, () => {})
                      }
                    }
                  })
                  return value
                },
                properties: [
                  {
                    label: 'Identifier',
                    name: '_id',
                    type: 'ObjectId',
                    auto: true,
                    acl: acl.Inherit
                  },
                  {
                    label: 'Name',
                    name: 'name',
                    type: 'String',
                    dependencies: ['._id'],
                    acl: acl.Inherit,
                    writable: true,
                    trim: true,
                    writer: function(ac, node, value) {
                      return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
                    },
                    validators: [{
                      name: 'customName'
                    }, {
                      name: 'uniqueInArray'
                    }]
                  },
                  {
                    label: 'Deployment Identifiers',
                    name: 'did',
                    type: 'ObjectId',
                    public: false,
                    readable: false,
                    array: true
                  },
                  {
                    label: 'IsDefault',
                    name: 'isDefault',
                    type: 'Boolean',
                    default: false,
                    writable: true,
                    acl: acl.Inherit,
                    writer: function(ac, node, value) {
                      // only allowed to set to true.
                      if (value) {
                        let numbers = pathTo(this.parent(), node.parent.docpath)
                        numbers.forEach(function(number) {
                          number.isDefault = false
                        })
                        this.isDefault = true
                      }
                    },
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'adhoc',
                      definition: {
                        message: 'A single default number must be selected.',
                        validator: function(ac, node) {
                          let numbers = pathTo(this.parent(), node.parent.docpath),
                              len = numbers.length,
                              count = 0
                          while (len--) {
                            if (numbers[len].isDefault) {
                              count++
                            }
                          }
                          return count === 1
                        }
                      }
                    }]
                  },
                  {
                    label: 'Number',
                    name: 'number',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'phoneNumber',
                      definition: {
                        allowShortCode: true
                      }
                    }]
                  },
                  {
                    label: 'Provider',
                    name: 'provider',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    default: 'twilio',
                    validators: [{
                      name: 'stringEnum',
                      definition: {
                        values: ['twilio']
                      }
                    }]
                  },
                  {
                    label: 'Account Id',
                    name: 'accountSid',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    validators: [{
                      name: 'pattern',
                      definition: {
                        message: 'Invalid Twilio AccountSID format.',
                        pattern: '/^[a-f0-9]{1,40}$/i'
                      }
                    }]

                  },
                  {
                    label: 'Auth Token',
                    name: 'authToken',
                    type: 'String',
                    writable: true,
                    acl: acl.Inherit,
                    validators: [{
                      name: 'pattern',
                      definition: {
                        message: 'Invalid Twilio AuthToken format.',
                        pattern: '/^[a-f0-9]{1,40}$/i'
                      }
                    }]

                  }
                ]
              }
            ]
          },
          makeUrlsDefinition(),
          {
            label: 'Queries',
            name: 'queries',
            type: 'Document',
            readAccess: acl.AccessLevels.System,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            properties: [{
              label: 'Allowed Restricted Match Operators',
              name: 'allowedRestrictedMatchOps',
              type: 'String',
              array: true,
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              validators: [{
                name: 'stringEnum',
                definition: { values: ['*', ...modules.parser.stages.find('$match').restrictedOperators] }
              }]
            }, {
              label: 'Allow Parser Strict Option',
              name: 'allowParserStrictOption',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow Unindexed Matches Option',
              name: 'allowUnidexedMatchesOption',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow native mongodb db pipelines',
              name: 'enableNativePipelines',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }]
          },
          {
            label: 'Televisit',
            name: 'televisit',
            type: 'Document',
            writeAccess: acl.Inherit,
            readable: true,
            writable: true,
            properties: [
              {
                label: 'Available Media Regions',
                name: 'availableRegions',
                type: 'String',
                array: true,
                uniqueValues: true,
                minItems: 1,
                maxItems: -1,
                maxShift: false,
                readable: true,
                writable: true,
                writeAccess: acl.Inherit,
                acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
                default: config('televisit.twilio.availableRegions').slice(),
                validators: [{
                  name: 'stringEnum',
                  definition: {
                    values: config('televisit.twilio.availableRegions').slice()
                  }
                }]
              },
              {
                label: 'Default Region',
                name: 'defaultRegion',
                type: 'String',
                writeAccess: acl.Inherit,
                acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
                writable: true,
                default: config('televisit.twilio.availableRegions')[0],
                validators: [{
                  name: 'adhoc',
                  definition: {
                    message: 'The value must exist in the list of available regions.',
                    validator: function(ac, node, value) {
                      return toArray(modules.db.getRootDocument(this).configuration.televisit.availableRegions).includes(value)
                    }
                  }
                }]
              },
              {
                label: 'Enable Rooms',
                name: 'roomsEnabled',
                type: 'Boolean',
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: false
              },
              {
                label: 'Enable Recording',
                name: 'enableRecording',
                type: 'Boolean',
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: true
              },
              {
                label: 'Max Concurrent Rooms',
                name: 'maxConcurrentRooms',
                type: 'Number',
                writeAccess: acl.AccessLevels.System,
                writable: true,
                default: config('televisit.twilio.defaultMaxConcurrentRooms')
              }
            ]
          },
          {
            label: 'Scripting',
            name: 'scripting',
            type: 'Document',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
            properties: [{
              label: 'Script Types',
              name: 'types',
              type: 'Document',
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              acl: acl.Inherit,
              properties: [{
                label: 'Job',
                name: 'job',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.job.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.job.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Route',
                name: 'route',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.route.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.route.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Trigger',
                name: 'trigger',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.trigger.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.trigger.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Deployment',
                name: 'deployment',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.deployment.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.deployment.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Export',
                name: 'export',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.export.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.export.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Validator',
                name: 'validator',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.validator.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.validator.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Policy',
                name: 'policy',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.policy.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.policy.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Transform',
                name: 'transform',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.transform.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.transform.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Operation',
                name: 'operation',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.operation.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.operation.sandboxScriptExecutionTimeoutMs')
                }]
              }, {
                label: 'Event',
                name: 'event',
                type: 'Document',
                writeAccess: acl.Inherit,
                acl: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Max Bytecode Ops',
                  name: 'maxOps',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.event.sandboxMaximumScriptBytecodeOps')
                }, {
                  label: 'Timeout Ms',
                  name: 'timeoutMs',
                  type: 'Number',
                  writeAccess: acl.Inherit,
                  acl: acl.Inherit,
                  readable: true,
                  writable: true,
                  default: config('sandbox.limits.types.event.sandboxScriptExecutionTimeoutMs')
                }]
              }]
            }, {
              label: 'Allowed Restricted blacklisted http headers',
              name: 'allowedRestrictedHttpHeaders',
              type: 'String',
              array: true,
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              validators: [{
                name: 'stringEnum',
                definition: { values: ['accept-charset', 'accept-encoding', 'cookie'] }
              }]
            }, {
              label: 'Max Callouts',
              name: 'maxCallouts',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxCallouts')
            }, {
              label: 'Max Callout Request Timeout',
              name: 'maxCalloutRequestTimeout',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxCalloutRequestTimeout')
            }, {
              label: 'Max Callout Request Size',
              name: 'maxCalloutRequestSize',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxCalloutRequestSize')
            }, {
              label: 'Max Callout Response Size',
              name: 'maxCalloutResponseSize',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxCalloutResponseSize')
            }, {
              label: 'Max Response Buffer Size',
              name: 'maxResponseBufferSize',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxResponseBufferSize')
            }, {
              label: 'Max Job Runs Per Day',
              name: 'maxJobRunsPerDay',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxJobRunsPerDay')
            }, {
              label: 'Allow Scripts to Execute Bytecode',
              name: 'allowBytecodeExecution',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Max Notifications',
              name: 'maxNotifications',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxNotifications')
            }, {
              label: 'Enable Non-Account Notifications',
              name: 'enableNonAccountNotifications',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableNonAccountNotifications')
            }, {
              label: 'Enable Script Validators',
              name: 'enableValidators',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableValidators')
            }, {
              label: 'Enable Policy Scripts',
              name: 'enableApiPolicies',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableApiPolicies')
            }, {
              label: 'Enable View Scripts',
              name: 'enableViewTransforms',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableViewTransforms')
            }, {
              label: 'Enable Triggers on View, Script, Object and Org',
              name: 'configurationTriggers',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow Callouts to restricted Servers',
              name: 'enableRestrictedCallouts',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow access to SFTP module',
              name: 'enableSftpModule',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow access to FTP module',
              name: 'enableFtpModule',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Allow Callouts in inline triggers',
              name: 'enableHttpInInlineTriggers',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: false
            }, {
              label: 'Enable Custom Sms',
              name: 'enableCustomSms',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableCustomSms')
            }, {
              label: 'Enable Timers',
              name: 'enableTimers',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.enableTimers')
            }, {
              label: 'Max Execution Depth',
              name: 'maxExecutionDepth',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxExecutionDepth')
            }, {
              label: 'Max Script Size',
              name: 'maxScriptSize',
              type: 'Number',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.maxScriptSize')
            }, {
              label: 'Enable Scripting',
              name: 'scriptsEnabled',
              type: 'Boolean',
              writeAccess: acl.Inherit,
              acl: acl.Inherit,
              readable: true,
              writable: true,
              default: config('sandbox.limits.scriptsEnabled')
            }]
          },
          {
            label: 'Can Create Apps',
            name: 'canCreateApps',
            type: 'Boolean',
            // description: 'When true, app creation through the api is available.',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: true
          },
          {
            label: 'Audit Log Expiry',
            name: 'auditLogExpiry',
            type: 'Number',
            // description: 'The number of days before audit logs are purged.',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: 180,
            validators: [{
              name: 'required'
            }, {
              name: 'number',
              definition: { min: 1, max: 365, allowNull: false, allowDecimal: false }
            }]
          },
          {
            label: 'Pending Connection Expiry',
            name: 'pendingConnectionExpiry',
            type: 'Number',
            // description: 'The number of days before pending connections are purged.',
            readable: true,
            writable: true,
            default: 7,
            validators: [{
              name: 'required'
            }, {
              name: 'number',
              definition: { min: 1, max: 90, allowNull: false, allowDecimal: false }
            }]
          },
          {
            label: 'Max Apps',
            name: 'maxApps',
            type: 'Number',
            // description: 'The maximum number of apps that can be created for the Org.',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: 10
          },
          {
            label: 'Max Storage',
            name: 'maxStorage',
            type: 'Number',
            // description: 'The maximum number in GB',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: 5
          },
          {
            label: 'File Storage Used',
            name: 'fileStorageUsed',
            type: 'Number',
            apiType: 'Number',
            virtual: true,
            optional: true,
            dependencies: ['_id', 'maxStorage'],
            readAccess: acl.AccessLevels.System,
            groupReader: function(node, principal, entries, req, script, selection, callback) {

              const Stat = modules.db.models.Stat,
                    orgIds = entries.map(entry => entry.input._id),
                    pipeline = [{
                      $match: {
                        org: { $in: orgIds },
                        code: consts.stats.sources.fileStorage
                      }
                    }, {
                      $sort: {
                        ending: -1
                      }
                    }, {
                      $group: {
                        _id: '$ending',
                        count: { $sum: '$ending' }
                      }
                    }, {
                      $limit: 2
                    }]

              Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {

                let ending = null
                if (!err && results && results.length > 0) {
                  if (results.length === 1 || results[0].count === results[1].count) {
                    ending = results[0]._id
                  } else {
                    ending = results[1]._id
                  }
                }

                if (!ending) {
                  entries.forEach(function(entry) {
                    pathTo(entry.output, node.docpath, 0)
                  })
                  return callback()
                }

                const pipeline = [{
                  $match: {
                    org: { $in: orgIds },
                    ending: ending,
                    code: consts.stats.sources.fileStorage
                  }
                }, {
                  $group: {
                    _id: '$org',
                    used: { $sum: '$size' }
                  }
                }]

                Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {
                  entries.forEach(function(entry) {
                    const result = utils.findIdInArray(results, '_id', entry.input._id)
                    pathTo(entry.output, node.docpath, utils.rInt(pathTo(result, 'used'), 0))
                  })
                  callback(err)
                })

              })

            }

          },
          {
            label: 'Doc Storage Used',
            name: 'docStorageUsed',
            type: 'Number',
            apiType: 'Number',
            virtual: true,
            optional: true,
            dependencies: ['_id', 'maxStorage'],
            readAccess: acl.AccessLevels.System,
            groupReader: function(node, principal, entries, req, script, selection, callback) {

              const Stat = modules.db.models.Stat,
                    orgIds = entries.map(entry => entry.input._id),
                    pipeline = [{
                      $match: {
                        org: { $in: orgIds },
                        code: consts.stats.sources.docStorage
                      }
                    }, {
                      $sort: {
                        ending: -1
                      }
                    }, {
                      $group: {
                        _id: '$ending',
                        count: { $sum: '$ending' }
                      }
                    }, {
                      $limit: 2
                    }]

              Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {

                let ending = null
                if (!err && results && results.length > 0) {
                  if (results.length === 1 || results[0].count === results[1].count) {
                    ending = results[0]._id
                  } else {
                    ending = results[1]._id
                  }
                }

                if (!ending) {
                  entries.forEach(function(entry) {
                    pathTo(entry.output, node.docpath, 0)
                  })
                  return callback()
                }

                const pipeline = [{
                  $match: {
                    org: { $in: orgIds },
                    ending: ending,
                    code: consts.stats.sources.docStorage
                  }
                }, {
                  $group: {
                    _id: '$org',
                    used: { $sum: '$size' }
                  }
                }]

                Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {
                  entries.forEach(function(entry) {
                    const result = utils.findIdInArray(results, '_id', entry.input._id)
                    pathTo(entry.output, node.docpath, utils.rInt(pathTo(result, 'used'), 0))
                  })
                  callback(err)
                })

              })

            }

          },
          {
            label: 'Cache Storage Used',
            name: 'cacheStorageUsed',
            type: 'Number',
            apiType: 'Number',
            virtual: true,
            optional: true,
            dependencies: ['_id'],
            readAccess: acl.AccessLevels.System,
            groupReader: function(node, principal, entries, req, script, selection, callback) {

              const Stat = modules.db.models.Stat,
                    orgIds = entries.map(entry => entry.input._id),
                    pipeline = [{
                      $match: {
                        org: { $in: orgIds },
                        code: consts.stats.sources.cacheStorage
                      }
                    }, {
                      $sort: {
                        ending: -1
                      }
                    }, {
                      $group: {
                        _id: '$ending',
                        count: { $sum: '$ending' }
                      }
                    }, {
                      $limit: 2
                    }]

              Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {

                let ending = null
                if (!err && results && results.length > 0) {
                  if (results.length === 1 || results[0].count === results[1].count) {
                    ending = results[0]._id
                  } else {
                    ending = results[1]._id
                  }
                }

                if (!ending) {
                  entries.forEach(function(entry) {
                    pathTo(entry.output, node.docpath, 0)
                  })
                  return callback()
                }

                const pipeline = [{
                  $match: {
                    org: { $in: orgIds },
                    ending: ending,
                    code: consts.stats.sources.cacheStorage
                  }
                }, {
                  $group: {
                    _id: '$org',
                    used: { $sum: '$size' }
                  }
                }]

                Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {
                  entries.forEach(function(entry) {
                    const result = utils.findIdInArray(results, '_id', entry.input._id)
                    pathTo(entry.output, node.docpath, utils.rInt(pathTo(result, 'used'), 0))
                  })
                  callback(err)
                })

              })

            }

          },
          {
            label: 'Max Accounts',
            name: 'maxAccounts',
            type: 'Number',
            // description: 'The maximum number of bytes',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: 500
          },
          {
            label: 'Allow Account Deletion',
            name: 'allowAccountDeletion',
            type: 'Boolean',
            // description: 'When false, account logins from another location logout all other existing logins for that account.',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: false
          },
          {
            label: 'Allow Org Refresh',
            name: 'allowOrgRefresh',
            type: 'Boolean',
            // description: 'When true, org refresh is allowed',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            writable: true,
            default: !(config('app.env') === 'production' && config('app.domain') === 'market')
          },
          {
            label: 'Max Applications Keys.',
            name: 'maxKeysPerApp',
            type: 'Number',
            // description: 'The number of application clients that can be created for each Org application.',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: 1,
            writer: function() {
              return 1 // fix at 1
            }
          },
          {
            label: 'Public Configuration Keys',
            name: 'public',
            type: 'Any',
            readAccess: acl.AccessLevels.Public,
            virtual: true,
            optional: true,
            acl: acl.Inherit,
            readable: true,
            writable: false,
            reader: function(ac, node) {
              return new DeferredPublicKeysRead(node, ac)
            }
          },
          {
            label: 'Package Information',
            name: 'package',
            type: 'Any',
            readAccess: acl.AccessLevels.Read,
            virtual: true,
            optional: true,
            acl: acl.Inherit,
            dependencies: ['code'],
            reader: function(ac, node) {
              return new DeferredPackagesRead(node, ac)
            }
          },
          {
            label: 'Max Request Size.',
            name: 'maxRequestSize',
            type: 'String',
            // description: 'the maximum incoming request size and org is allowed to handle.',
            readAccess: acl.AccessLevels.Public,
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            readable: true,
            writable: true,
            default: config('requests.limit')
          },
          {
            label: 'Max Non-Bulk Unmanaged Inserts',
            name: 'maxUnmanagedInserts',
            type: 'Number',
            // description: 'the maximum number of non-bulk unmanaged inserts allowed.',
            readAccess: acl.AccessLevels.Public,
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            readable: true,
            writable: true,
            default: 1000,
            validators: [{
              name: 'number',
              definition: { min: 0, max: 100000, allowNull: false, allowDecimal: false }
            }]
          },
          {
            label: 'Max Non-Bulk Managed Inserts',
            name: 'maxManagedInserts',
            type: 'Number',
            // description: 'the maximum number of non-bulk unmanaged inserts allowed.',
            readAccess: acl.AccessLevels.Public,
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            readable: true,
            writable: true,
            default: 100,
            validators: [{
              name: 'number',
              definition: { min: 0, max: 100000, allowNull: false, allowDecimal: false }
            }]
          },
          {
            label: 'Enable Single Sign-On',
            name: 'ssoEnabled',
            // description: 'When true, users can login through SSO.',
            type: 'Boolean',
            readable: true,
            writable: true,
            readAccess: acl.AccessLevels.Public,
            acl: acl.Inherit,
            default: false,
            virtual: true,
            reader: function(ac) {
              return ac.org.configuration.loginMethods.includes('sso')
            }
          },
          {
            label: 'Login Methods',
            name: 'loginMethods',
            type: 'String',
            // description: 'Users can login with either SSO, credentials, or both',
            array: true,
            uniqueValues: true,
            minItems: 1,
            maxShift: false,
            canPush: true,
            canPull: true,
            readable: true,
            writable: true,
            readAccess: acl.AccessLevels.Public,
            acl: acl.Inherit,
            default: ['credentials'],
            writer: function(ac, node, value) {
              // always include credentials for BC
              if ((value || []).includes('sso')) {
                return ['credentials', 'sso']
              }
              return value
            },
            validators: [{
              name: 'stringEnum',
              definition: {
                values: ['sso', 'credentials']
              }
            }]
          },
          {
            label: 'Enable New Login Experience',
            name: 'newLoginExperience',
            // description: 'When true, newly provisioned users are directed to App Dashboard',
            type: 'Boolean',
            readable: true,
            writable: true,
            readAccess: acl.AccessLevels.Public,
            acl: acl.Inherit,
            default: false
          },
          {
            label: 'Minimum Password Score',
            name: 'minPasswordScore',
            type: 'Number',
            // description: 'The password score required for new passwords.',
            readable: true,
            acl: acl.Inherit,
            writable: true,
            dependencies: ['configuration.minSelectablePasswordScore'],
            validators: [{
              name: 'required'
            }, {
              name: 'number',
              definition: { min: 0, max: 4, allowNull: false, allowDecimal: false }
            }, {
              name: 'adhoc',
              definition: {
                message: 'The password score is too low.',
                validator: function(ac, node, value) {
                  return value >= utils.rInt(this.minSelectablePasswordScore, 0)
                }
              }
            }],
            default: 0
          },
          {
            label: 'Password Expiry Days',
            name: 'passwordExpiryDays',
            type: 'Number',
            // description: 'passwords expire after X days. anything above 0 triggers',
            readable: true,
            writable: true,
            acl: acl.Inherit,
            validators: [{
              name: 'required'
            }, {
              name: 'number',
              definition: { min: 0, allowNull: false, allowDecimal: false }
            }],
            default: 0
          },
          {
            label: 'Compiled Password Validator',
            name: 'compiledPasswordValidator',
            type: 'Any',
            readable: false,
            writable: false,
            serializeData: false
          },
          {
            label: 'Password Validator',
            name: 'passwordValidator',
            type: 'String',
            acl: acl.Inherit,
            readable: true,
            writable: true,
            trim: true,
            default: '',
            dependencies: ['configuration.scriptablePasswordValidation', 'configuration.compiledPasswordValidator'],
            validators: [{
              name: 'adhoc',
              definition: {
                validator: function(ac, node, source) {
                  let maxLen = utils.rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
                  if (!_.isString(source) || source.length > maxLen) {
                    throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxLen} by ${source.length - maxLen}` })
                  }
                  return true
                }
              }
            }, {
              name: 'adhoc',
              definition: {
                message: 'A valid script.',
                validator: function(ac, node, source, callback) {

                  if (source === '') {
                    this.configuration.compiledPasswordValidator = null
                    return callback(null, true)
                  }

                  const transpileOptions = {
                    filename: `Password Validator`,
                    language: 'javascript',
                    specification: 'es6'
                  }
                  return transpiler.transpile(source, transpileOptions, (err, result) => {
                    if (!err) {
                      this.configuration.compiledPasswordValidator = {
                        requires: result.imports,
                        compiled: result.source
                      }
                    }
                    callback(err, true)
                  })
                }
              }
            }]
          },
          {
            label: 'Minimum Password Score',
            name: 'minPasswordScore',
            type: 'Number',
            // description: 'The password score required for new passwords.',
            acl: acl.Inherit,
            readable: true,
            writable: true,
            dependencies: ['configuration.scriptablePasswordValidation'],
            validators: [{
              name: 'required'
            }, {
              name: 'number',
              definition: { min: 0, max: 4, allowNull: false, allowDecimal: false }
            }, {
              name: 'adhoc',
              definition: {
                message: 'The password score is too low.',
                validator: function(ac, node, value) {
                  return value >= utils.rInt(this.minSelectablePasswordScore, 0)
                }
              }
            }],
            default: 0
          },
          {
            label: 'Allow Simultaneous Logins',
            name: 'allowSimultaneousLogins',
            acl: acl.Inherit,
            type: 'Boolean',
            // description: 'When false, account logins from another location logout all other existing logins for that account.',
            readable: true,
            writable: true,
            default: true
          },
          {
            label: 'Email',
            name: 'email',
            type: 'Document',
            // description: 'Org email settings.',
            writable: true,
            acl: acl.Inherit,
            properties: [{
              label: 'Provider',
              name: 'provider',
              type: 'String',
              // description: 'The email delivery provider',
              readable: true,
              writable: true,
              acl: acl.Inherit,
              default: 'Medable',
              validators: [{
                name: 'stringEnum',
                definition: {
                  values: ['Medable', 'SendGrid']
                }
              }]
            }, {
              label: 'Provider API Key',
              name: 'api_key',
              type: 'String',
              // description: 'The email delivery provider api key',
              readable: true,
              writable: true,
              default: '',
              validators: [{
                name: 'string',
                definition: {
                  min: 0,
                  max: 512
                }
              }]
            }, {
              label: 'From Name',
              name: 'fromName',
              type: 'String',
              // description: 'The name that appears in the From line for email addresses sent view Medable on behalf of the Org.',
              readable: true,
              writable: true,
              acl: acl.Inherit,
              validators: [{
                name: 'printableString',
                definition: { min: 0, max: 100, anyFirstLetter: false }
              }],
              stub: ''
            }, {
              label: 'From Address',
              name: 'from',
              type: 'String',
              // description: 'The "From" email address for emails sent by Medable on behalf of the Org.',
              readable: true,
              writable: true,
              acl: acl.Inherit,
              validators: [{
                name: 'email',
                definition: { allowNull: true }
              }],
              stub: ''
            }, {
              label: 'Reply To',
              name: 'replyTo',
              type: 'String',
              // description: 'The "Reply To" email address for emails sent by Medable on behalf of the Org if different from the from address.',
              readable: true,
              writable: true,
              acl: acl.Inherit,
              validators: [{
                name: 'email',
                definition: { allowNull: true }
              }],
              stub: ''
            }, {
              label: 'Provider Verifications',
              name: 'providerVerifications',
              type: 'String',
              // description: 'A list of email addresses that receive provider verification notifications when a provider account is created or updates their provider profile details.',
              array: true,
              uniqueValues: true,
              maxItems: 20,
              maxShift: false,
              canPush: true,
              canPull: true,
              readable: true,
              writable: true,
              validators: [{
                name: 'email'
              }]
            }, {
              label: 'Registrations',
              name: 'registrations',
              type: 'String',
              // description: 'A list of email addresses that receive new account registration notifications.',
              array: true,
              uniqueValues: true,
              maxItems: 20,
              maxShift: false,
              canPush: true,
              canPull: true,
              readable: true,
              writable: true
            }, {
              label: '2FA Bypass',
              name: 'locationBypass',
              type: 'String',
              // description: 'A list of email addresses that do not required two-factor authentication when signing-in from a new location.',
              array: true,
              uniqueValues: true,
              maxItems: 100,
              maxShift: false,
              canPush: true,
              canPull: true,
              readable: true,
              writable: true
            }]
          },
          {
            label: 'Billing',
            name: 'billing',
            type: 'Document',
            // description: 'Org billing settings.',
            writeAccess: acl.AccessLevels.System,
            acl: acl.Inherit,
            readable: true,
            writable: true,
            properties: [{
              label: 'Billing Id',
              name: 'billingId',
              type: 'String',
              // description: 'The identifier for this customer in the external billing system',
              writeAccess: acl.Inherit,
              readable: true,
              writable: true,
              default: ''
            }]
          },
          {
            label: 'Enable Axon',
            name: 'researchEnabled',
            type: 'Boolean',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: false
          },
          {
            label: 'Axon',
            name: 'axon',
            type: 'Document',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            properties: [
              {
                label: 'Enabled',
                name: 'enabled',
                type: 'Boolean',
                acl: acl.Inherit,
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                default: false
              },
              {
                label: 'Exports',
                name: 'exports',
                type: 'Boolean',
                acl: acl.Inherit,
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                default: false
              },
              {
                label: 'Trials',
                name: 'trials',
                type: 'Boolean',
                acl: acl.Inherit,
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                default: false
              },
              {
                label: 'Apps',
                name: 'apps',
                type: 'Document',
                array: true,
                acl: acl.Inherit,
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                canPull: true,
                canPush: true,
                maxItems: 100,
                properties: [
                  {
                    label: 'App Name',
                    name: 'name',
                    type: 'String',
                    acl: acl.Inherit,
                    writeAccess: acl.Inherit,
                    readable: true,
                    writable: true,
                    trim: true,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'string',
                      definition: { allowNull: false, min: 0, max: 255 }
                    }, {
                      name: 'uniqueInArray'
                    }]
                  },
                  {
                    label: 'Version',
                    name: 'version',
                    type: 'String',
                    acl: acl.Inherit,
                    writeAccess: acl.Inherit,
                    readable: true,
                    writable: true,
                    validators: [{
                      name: 'required'
                    }, {
                      name: 'adhoc',
                      message: 'Requires a valid semver version tag',
                      definition: {
                        validator: (ac, node, value) => {
                          return value === 'latest' || semver.valid(value) !== null
                        }
                      }
                    }]
                  },
                  {
                    label: 'Default',
                    name: 'default',
                    type: 'Boolean',
                    acl: acl.Inherit,
                    writeAccess: acl.Inherit,
                    readable: true,
                    writable: true
                  }
                ]
              }
            ]
          },
          {
            label: 'Disable Cortex',
            name: 'cortexDisabled',
            type: 'Boolean',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: false
          },
          {
            label: 'Minimum Selectable Password Score',
            name: 'minSelectablePasswordScore',
            type: 'Number',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            validators: [{
              name: 'number',
              definition: { min: 0, max: 4, allowNull: false, allowDecimal: false }
            }],
            default: 0
          },
          {
            label: 'Scriptable Password Validation',
            name: 'scriptablePasswordValidation',
            type: 'Boolean',
            acl: acl.Inherit,
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            default: false
          },
          {
            label: 'Ephemeral Org',
            name: 'ephemeral',
            type: 'Boolean',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            creatable: true,
            default: false
          },
          {
            label: 'Ephemeral Expiration Time',
            name: 'ephemeralExpireAt',
            type: 'Date',
            writeAccess: acl.AccessLevels.System,
            readable: true,
            creatable: true
          },
          {
            label: 'Notification',
            name: 'notification',
            type: 'Document',
            acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
            writeAccess: acl.AccessLevels.System,
            readable: true,
            writable: true,
            properties: [
              {
                label: 'Max payload size',
                name: 'maxPayloadSize',
                type: 'Number',
                default: config('notifications.payloadMaxSize'),
                writable: true,
                readable: true,
                acl: acl.Inherit
              },
              {
                label: 'Email configurations',
                name: 'email',
                type: 'Document',
                writable: true,
                readable: true,
                acl: acl.Inherit,
                properties: [
                  {
                    label: 'Allow attachments',
                    name: 'allowAttachments',
                    type: 'Boolean',
                    acl: acl.Inherit,
                    writable: true,
                    readable: true,
                    dependencies: ['._id'],
                    default: true
                  }, {
                    label: 'Max attachment size',
                    name: 'maxAttachmentSize',
                    type: 'Number',
                    acl: acl.Inherit,
                    writable: true,
                    readable: true,
                    dependencies: ['._id'],
                    default: 20971520
                  }
                ]
              },
              {
                label: 'APNS Notification Config',
                name: 'APNsConfig',
                type: 'Document',
                writable: true,
                readable: true,
                acl: acl.Inherit,
                properties: [
                  {
                    label: 'Use Token based notifications',
                    name: 'useToken',
                    type: 'Boolean',
                    acl: acl.Inherit,
                    writable: true,
                    readable: true,
                    dependencies: ['._id'],
                    default: false
                  }]
              }
            ]
          },
          {
            name: 'accounts',
            label: 'Accounts',
            type: 'Document',
            acl: [
              { type: acl.AccessTargets.OrgRole, target: acl.OrgSupportRole, allow: acl.AccessLevels.Read },
              { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }
            ],
            writeAccess: acl.Inherit,
            readable: true,
            writable: true,
            properties: [{
              label: 'Require Mobile',
              name: 'requireMobile',
              type: 'Boolean',
              default: true,
              writable: true,
              readable: true,
              acl: acl.Inherit
            }, {
              label: 'Require Email',
              name: 'requireEmail',
              type: 'Boolean',
              default: true,
              writable: true,
              readable: true,
              acl: acl.Inherit
            }, {
              label: 'Require Username',
              name: 'requireUsername',
              type: 'Boolean',
              default: false,
              writable: true,
              readable: true,
              acl: acl.Inherit
            }, {
              label: 'Enable Email',
              name: 'enableEmail',
              type: 'Boolean',
              default: true,
              writable: true,
              readable: true,
              acl: acl.Inherit
            }, {
              label: 'Allow Email Update',
              name: 'allowEmailUpdate',
              type: 'Boolean',
              default: false,
              writable: true,
              readable: true,
              acl: acl.Inherit

            }, {
              label: 'Enable Username',
              name: 'enableUsername',
              type: 'Boolean',
              default: false,
              writable: true,
              readable: true,
              acl: acl.Inherit
            }, {
              label: 'Username Pattern',
              name: 'usernamePattern',
              type: 'String',
              default: '/^[a-z0-9-_\\!#+\\$\\^\\=\\(\\)\\{\\}\\[\\]\\\\.]{6,255}$/i',
              writable: true,
              readable: true,
              acl: acl.Inherit,
              validators: [{
                name: 'adhoc',
                definition: {
                  message: 'A valid pattern in the form of /^\\/(.*)\\/(.*)/',
                  validator: function(ac, node, v) {
                    if (_.isString(v) && v.length > 0) {
                      const match = v.match(/^\/(.*)\/(.*)/)
                      return match && match[0].length > 0
                    }
                    return false
                  }
                }
              }]
            }]
          },
          {
            label: 'I18n',
            name: 'i18n',
            type: 'Document',
            writeAccess: acl.Inherit,
            readable: true,
            writable: true,
            properties: [
              {
                label: 'Create bundle file on aws',
                name: 'createBundleFileS3',
                type: 'Boolean',
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                default: false
              },
              {
                label: 'Pseudo localization',
                name: 'pseudoLocalization',
                type: 'Document',
                writeAccess: acl.Inherit,
                readable: true,
                writable: true,
                properties: [{
                  label: 'Enabled',
                  name: 'enabled',
                  type: 'Boolean',
                  default: false
                }, {
                  label: 'Limited',
                  name: 'limited',
                  type: 'Boolean',
                  default: false
                }, {
                  label: 'Expand',
                  name: 'expand',
                  type: 'Number',
                  default: 0
                }, {
                  label: 'Mode',
                  name: 'mode',
                  type: 'String',
                  default: 'accented'
                }]

              }
            ]
          }
        ]
      },
      {
        label: 'Code',
        name: 'code',
        type: 'String',
        // description: 'The Org\'s code, used to access the api, uniquely identifies the org.',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        lowercase: true,
        trim: true,
        creatable: true,
        nativeIndex: true,
        validators: [{
          name: 'required'
        }, {
          name: 'pattern',
          definition: {
            message: 'A string containing at least 3 letters and numbers (up to 40), without the word "medable".',
            pattern: '/^(?!.*medable.*)(?=[-_]*[a-z0-9]{3,}[a-z0-9-_]*)[a-z0-9-_]{3,40}$/i',
            skip: function() {
              return equalIds(this._id, acl.BaseOrg)
            }
          }
        }, {
          name: 'pattern',
          definition: {
            message: 'A string that does not match the signature of an ObjectId',
            pattern: '/^(?!^[0-9a-fA-F]{24}$).*$/i'
          }
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.exists',
            message: 'A unique org name',
            validator: function(ac, node, value, callback) {
              this.constructor.findOne({ code: value }).lean().select('_id').exec(function(err, doc) {
                callback(err, Boolean(!err && !doc))
              })
            }
          }
        }]
      },
      {
        label: 'Website',
        name: 'website',
        type: 'String',
        // description: '',
        dependencies: ['code'],
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: false,
        reader: function() {
          return modules.templates.appUrl(this.code)
        },
        virtual: true
      },
      {
        label: 'User Count',
        name: 'users',
        type: 'Number',
        apiType: 'Number',
        virtual: true,
        optional: true,
        dependencies: ['_id'],
        readAccess: acl.AccessLevels.System,
        groupReader: function(node, principal, entries, req, script, selection, callback) {
          const orgIds = entries.map(entry => entry.input._id),
                pipeline = [
                  { $match: { reap: false, object: 'account', org: { $in: orgIds } } },
                  { $project: { org: 1 } },
                  { $group: { _id: '$org', users: { $sum: 1 } } }
                ]
          modules.db.models.org.collection.aggregate(pipeline, { cursor: {} }).toArray(function(err, values) {
            if (!err) {
              entries.forEach(function(entry) {
                const v = utils.findIdInArray(values, '_id', entry.output._id)
                entry.output.users = v ? v.users : 0
              })
            }
            callback(err)
          })
        }

      },
      {
        label: 'Objects',
        name: 'objects',
        type: 'ObjectId',
        ref: 'object', // <-- we need this for populating the initial org load of existing contexts. @todo this may be moved to an internal document with syncing.
        // description: 'The Org\'s custom objects and object extensions.',
        array: true,
        maxItems: -1,
        public: false,
        readable: false,
        writable: false
      },
      // the current org runtime map (script-defined policies, routes, triggers, jobs, objects, exports, etc.)
      {
        label: 'Runtime environment',
        name: 'runtime',
        type: 'Any',
        readable: true,
        serializeData: false,
        set: function(v) { return encodeME(v, '$$decodedRuntime', this) },
        get: function(v) { return decodeME(v, '$$decodedRuntime', this) },
        acl: [{
          type: acl.AccessTargets.OrgRole,
          target: config('app.env') === 'development' ? acl.OrgDeveloperRole : acl.OrgAdminRole,
          allow: acl.AccessLevels.Read
        }]
      },
      {
        label: 'Service Accounts',
        name: 'serviceAccounts',
        type: 'Document',
        array: true,
        readable: true,
        canPull: true,
        canPush: true,
        maxItems: 100,
        dependencies: ['serviceAccounts'],
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        auditing: {
          updateSubcategory: 'access',
          changes: true
        },
        uniqueKey: 'name',
        export: async function(ac, doc, resourceStream, parentResource, options) {

          const resourcePath = `serviceAccount.${doc && doc.name}`

          if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
            return Undefined
          } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
            return Undefined
          } else if (!doc.name) {
            if (resourceStream.silent) {
              return Undefined
            }
            throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
              resource: ac.getResource(),
              reason: `The service account "${doc.name}" does not have a name set, therefore it can't be exported.`,
              path: `serviceAccount.${doc.label}`
            })
          } else {

            const def = _.pick(doc, [
              'name',
              'label',
              'locked'
            ])

            def.object = 'serviceAccount'
            def.roles = (await Promise.all(doc.roles.map(async(id) => {
              return resourceStream.addMappedPrincipal(ac, id, `${resourcePath}.roles`)
            }))).sort(naturalCmp)

            return resourceStream.exportResource(sortKeys(def), resourcePath)

          }

        },

        import: async function(ac, doc, resourceStream, parentResource, options) {

          const resourcePath = `serviceAccount.${doc && doc.name}`

          if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
            return Undefined
          } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
            return Undefined
          } else {

            return resourceStream.updateEnvironment(async(ac) => {

              let existing = ac.org.serviceAccounts.find(sa => sa.name && sa.name === doc.name),
                  def = _.pick(doc, [
                    'label',
                    'locked'
                  ])

              if (existing) {
                def._id = existing._id
              } else {
                def.name = doc.name
              }

              if (Array.isArray(doc.roles) && doc.roles.length > 0) {
                def.roles = []
                for (let uniqueKey of doc.roles) {
                  def.roles.push((await resourceStream.importMappedPrincipal(ac, `role.${uniqueKey}`, `${resourcePath}.roles`))._id)
                }
              } else {
                def.roles = doc.roles
              }

              ac.method = existing ? 'put' : 'post'
              await promised(this, 'aclWrite', ac, ac.org, def)

              return ac.org.serviceAccounts.find(sa => sa.name && sa.name === doc.name)

            })

          }

        },

        puller: function(ac, node, value) {
          // @todo pass the code as well as the id.

          const entry = utils.findIdInArray(this.serviceAccounts, '_id', value)

          ac.markSafeToUpdate(node) // we've include the whole array. mark as safe
          ac.hook('save').before(function(vars, callback) {
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                ac.object.fireHook('serviceAccount.removed.before', null, { ac: ac, serviceAccountId: value, serviceAccount: entry }, callback)
              }
            }
          })
          ac.hook('save').after(function(vars) {
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                ac.object.fireHook('serviceAccount.removed.after', null, { ac: ac, serviceAccountId: value }, () => {})
              }
            }
          })
          return value
        },
        properties: [
          {
            label: 'Deployment Identifiers',
            name: 'did',
            type: 'ObjectId',
            public: false,
            readable: false,
            array: true
          },
          {
            label: 'Name',
            name: 'name',
            type: 'String',
            dependencies: ['._id'],
            acl: acl.Inherit,
            writable: true,
            trim: true,
            writer: function(ac, node, value) {
              return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
            },
            validators: [{
              name: 'required'
            }, {
              name: 'customName'
            }, {
              name: 'uniqueInArray'
            }]
          },
          {
            label: 'Label',
            name: 'label',
            type: 'String',
            acl: acl.Inherit,
            writable: true,
            trim: true,
            validators: [{
              name: 'required'
            }, {
              name: 'string',
              definition: { min: 1, max: 255 }
            }]
          },
          {
            label: 'Roles',
            name: 'roles',
            type: 'ObjectId',
            array: true,
            uniqueValues: true,
            maxItems: 20,
            maxShift: false,
            canPush: true,
            canPull: true,
            writable: true,
            acl: acl.Inherit,
            dependencies: ['.roles'],
            auditing: {
              updateSubcategory: 'access',
              changes: true
            },
            validators: [{
              name: 'adhoc',
              definition: {
                asArray: true,
                validator: function(ac, node, values) {
                  if (utils.intersectIdArrays(values, toArray(ac.org.roles).map(role => role._id)).length < values.length) {
                    throw Fault.create('cortex.notFound.unspecified', { reason: 'One or more roles do not exist.' })
                  }
                  return true
                }
              }
            }]
          },
          {
            label: 'Inherited Roles',
            name: 'inheritedRoles',
            type: 'ObjectId',
            virtual: true,
            array: true,
            acl: acl.Inherit,
            dependencies: ['.roles'],
            reader: function(ac) {
              return utils.diffIdArrays(acl.expandRoles(ac.org.roles, this.roles), this.roles)
            }
          },
          {
            label: 'Locked',
            name: 'locked',
            type: 'Boolean',
            writable: true,
            acl: acl.Inherit,
            default: false,
            validators: [{
              name: 'required'
            }]
          }
        ]
      },
      new OrgRoleDefinition({
        label: 'Roles',
        name: 'roles',
        type: 'Document',
        // description: 'The Org\'s configured roles.',
        array: true,
        readable: true,
        canPull: true,
        canPush: true,
        uniqueKey: 'code',
        acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Read }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
        auditing: {
          updateSubcategory: 'access',
          changes: true
        },
        default: function() {
          return clone(Object.values(consts.defaultRoles))
        },
        pusher: function(ac, node, roles) {

          // static roles cannot be updated
          roles.forEach(function(role) {
            if (role) {
              let roleId = utils.getIdOrNull(pathTo(role, '_id'))
              if (consts.defaultRoles[roleId]) {
                throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Built-in Roles cannot be modified.' })
              }
            }
          })
          return roles

        },
        puller: function(ac, node, value) {

          if (consts.defaultRoles[utils.getIdOrNull(value)]) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Built-in Roles cannot be modified.' })
          }

          // remove the role from the roles array and all includes.
          // mongoose will make this a set operation. because we have included the entire roles array, mark as safe.
          ac.markSafeToUpdate(node)

          if (_.isArray(this.roles)) {
            this.roles.forEach(function(role) {
              role.include.pull(value)
            })
          }

          ac.hook('save').before(function(vars, callback) {
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
                ac.object.fireHook('role.removed.before', null, { ac: ac, roleId: value }, callback)
              }
            }
          })
          ac.hook('save').after(function(vars) {
            // vars.ac,  vars.modified;
            if (~vars.modified.indexOf(node.fullpath)) {
              if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {

                // @todo remove the role from object acl.
                // @todo remove the role from feed acl.
                // @todo remove the role from individual context acl.
                // @todo remove the role from individual connection acl.
                // @todo remove the role from individual post acl.
                // @todo remove the role from individual post targets.
                ac.object.fireHook('role.removed.after', null, { ac: ac, roleId: value }, () => {})
              }
            }
          })
          return value
        }
      }),
      {
        _id: consts.Properties.Files.Ids.Org.Logo,
        label: 'Logo',
        name: 'logo',
        type: 'File',
        // description: 'The Org logo.',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        urlExpirySeconds: config('uploads.s3.readUrlExpiry'),
        processors: [{
          type: 'image',
          name: 'content',
          source: 'content',
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          cropImage: false,
          allowUpload: true,
          maxFileSize: 1024 * 1000 * 5,
          maxWidth: 1024,
          maxHeight: 1024,
          passMimes: false,
          required: true
        }, {
          type: 'image',
          name: 'thumbnail',
          source: 'content',
          cropImage: false,
          maxFileSize: 1024 * 1000 * 5,
          maxWidth: 300,
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          allowUpload: true
        }]
      },
      {
        _id: consts.Properties.Files.Ids.Org.Favicon,
        label: 'Favicon',
        name: 'favicon',
        type: 'File',
        // description: 'Organization Icon',
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: true,
        urlExpirySeconds: config('uploads.s3.readUrlExpiry'),
        processors: [{
          type: 'passthru',
          name: 'content',
          source: 'content',
          mimes: ['image/x-icon'],
          maxFileSize: 1024 * 1000,
          allowUpload: true
        }]
      }
    ]
  }
}

// shared methods --------------------------------------------------------

OrgDefinition.methods = {

  /**
   *
   * callback -> err
   */
  getAvailableFileStorage: function(options, callback) {

    const Stat = modules.db.models.Stat,
          max = utils.rInt(pathTo(this, 'configuration.maxStorage'), 5) * 1073741824

    async.waterfall([

      // get the last 2 stats groups. this so we can use the one with more entries (in case we're in the middle of updating)
      callback => {

        const pipeline = [{
          $match: {
            org: this._id,
            code: consts.stats.sources.fileStorage
          }
        }, {
          $sort: {
            ending: -1
          }
        }, {
          $group: {
            _id: '$ending',
            count: { $sum: '$ending' }
          }
        }, {
          $limit: 2
        }]

        Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, results) => {
          let ending = null
          if (!err && results && results.length > 0) {
            if (results.length === 1 || results[0].count === results[1].count) {
              ending = results[0]._id
            } else {
              ending = results[1]._id
            }
          }
          callback(err, ending)
        })
      },

      // calculate the doc and file totals across types based on the selected ending
      (ending, callback) => {

        if (!ending) {
          return callback(null, max)
        }

        const pipeline = [{
          $match: {
            org: this._id,
            ending: ending,
            code: consts.stats.sources.fileStorage
          }
        }, {
          $group: {
            _id: null,
            used: { $sum: '$size' }
          }
        }]

        Stat.collection.aggregate(pipeline, { cursor: {} }).toArray((err, result) => {
          let available = max
          if (!err && result && result.length > 0) {
            available = Math.max(0, max - utils.rInt(result[0].used, 0))
          }
          callback(err, available)
        })
      }

    ], callback)

  },

  /**
   *
   * @param notificationType
   * @param options
   *
   *      queue: optional default true. if false, sends notification immediately, circumventing worker queues.
   *      priority: higher priorities go first
   *
   *      account                     // an account access subject, principal, accountId, email address, or object containing either an _id or email property. if missing, the principal option is used as the account as well as the render target.
   *          _id/email [, [name]
   *      principal                   // id or principal. templates will be rendered using the passed in principal. if missing, uses the account._id. required if account.email is used.
   *      locale                      // the desired notification locale. if not passed, attempts are made to select it from req, then from account, then default to en_US
   *      context                     // an access subject or plain object containing _id and object properties. required for persistent notifications.
   *      meta                        // arbitratry metadata, saved to persistent notifications. be careful to pass only small, plain objects (this is stringified).
   *      req                         // the request or request id. converted to a request id.
   *      created                     // optional created date for persistent notifications.
   *      message                     // optional message (for endpoints without templates)
   *
   * endpoint options
   *      number                      // optional sms endpoint phone number or identifier.
   *      apiKey                      // optional pin-to-app for push notifications.
   *      count
   *      sound
   *
   *      variables                   // custom variables to pass to templates
   * @param callback
   */
  sendNotification: function(notificationType, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    let notification,
        name = notificationType,
        payload,
        account = options.account,
        principal = options.principal,
        locale = options.locale,
        context = options.context,
        meta = options.meta,
        req = options.req,
        created = options.created
    // discern the notification type id. for now, only system types are supported.
    const types = consts.Notifications.Types
    if (_.isString(notificationType) && !utils.isIdFormat(notificationType)) {
      if (notificationType.indexOf('c_') === 0 || ~notificationType.indexOf('__')) {
        let custom = toArray(pathTo(this, 'configuration.notifications')),
            len = custom.length
        while (len--) {
          if (custom[len].name === notificationType) {
            notificationType = custom[len]._id
            break
          }
        }
      } else if (types[notificationType]) {
        notificationType = types[notificationType]._id
      } else {
        for (let key in types) {
          if (types.hasOwnProperty(key) && types[key].name === notificationType) {
            notificationType = types[key]._id
            break
          }
        }
      }
    }
    notificationType = utils.getIdOrNull(notificationType)

    // short-circuit out if we don't have the notification loaded
    if (utils.equalIds(notificationType, consts.emptyId)) {
      notification = {
        _id: notificationType
      }
    } else {
      notification = this.schema.node.findNode('configuration.notifications').loadNotification(this, notificationType)
      if (!notification || (notification.endpoints.length === 0 && !notification.persists)) {
        const err = Fault.create('cortex.notFound.object', { reason: `There is no notification ${name} registered or it does not have endpoints set.` })
        return callback(err, null)
      }
    }

    // construct the payload.
    payload = {
      type: notification._id,
      org: this._id,
      variables: utils.isSet(options.variables) ? options.variables : {},
      count: utils.rInt(options.count),
      sound: utils.rString(options.sound),
      sender: options.sender
      // account: undefined,
      // principal: undefined,
      // locale: undefined,
      // context: undefined,
      // meta: undefined,
      // req: undefined
      // created: undefined
    }

    // add options for endpoints.
    Object.keys(options).forEach(function(key) {
      if (!~RESERVED_NOTIF_OPTIONS.indexOf(key)) {
        payload[key] = options[key]
      }
    })
    // setup account/principal from other options...
    if (ap.is(account) && principal == null) {
      principal = account
    } else if (ap.is(principal) && account == null) {
      account = principal
    }

    // resolve account.
    if (acl.isAccessSubject(account) || ap.is(account)) {
      payload.account = {
        _id: account._id
      }
    } else if (modules.validation.isEmail(account)) {
      payload.account = {
        email: account
      }
    } else if (utils.isId(account) || utils.isIdFormat(account)) {
      payload.account = {
        _id: utils.getIdOrNull(account)
      }
    } else if (account) {
      if (account._id) {
        payload.account = {
          _id: utils.getIdOrNull(account._id)
        }
        if (!payload.account._id) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification invalid account._id passed.' }))
        }
      } else if (account.email) {
        let email = account.email
        if (modules.validation.isEmail(email)) {
          payload.account = {
            email: email
          }
        } else {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification invalid account.email passed.' }))
        }
      }
    }

    // resolve principal
    if (acl.isAccessSubject(principal) || ap.is(principal)) {
      payload.principal = principal._id
    } else if (utils.isId(principal) || utils.isIdFormat(principal)) {
      payload.principal = utils.getIdOrNull(principal)
    } else if (!principal) {
      payload.principal = pathTo(payload, 'account._id')
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification invalid principal passed.' }))
    }

    if (!payload.account && utils.isId(payload.principal)) {
      payload.account = {
        _id: payload.principal
      }
    }

    if (!utils.isId(payload.principal)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification invalid principal passed.' }))
    }
    if (!payload.account || (!utils.isId(payload.account._id) && !modules.validation.isEmail(payload.account.email))) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification invalid account passed.' }))
    }

    // check for an id to persist but allow it.
    if (notification.persists && !utils.isId(payload.account._id)) {
      Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification requires an _id for persistent notification: ' + notification.name })
    }

    // resolve locale
    locale = locale || pathTo(req, 'locale') || pathTo(account, 'locale') || this.locale
    if (!modules.locale.isValid(locale)) {
      locale = config('locale.defaultLocale')
    }
    payload.locale = locale

    if (utils.isPlainObjectWithSubstance(meta)) {
      payload.meta = meta
    }

    // resolve context
    if (notification.persists) {
      if (acl.isAccessSubject(context) || acl.isPostSubject(context) || acl.isPostComment(context)) {
        payload.context = {
          _id: context._id,
          object: context.constructor.objectName
        }
      } else if (utils.isPlainObject(context)) {
        payload.context = {
          _id: utils.getIdOrNull(context._id),
          object: utils.rString(pathTo(this.findObjectInfo(context.object), 'name'), null)
        }
      }
      // check for context to persist but allow it.
      if (!payload.context || !utils.isId(payload.context._id) || !payload.context.object) {
        delete payload.context
        Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification requires a context for persistent notification: ' + notification.name })
      }
    }

    // resolve created.
    created = utils.getValidDate(created)
    if (created) {
      payload.created = created
    }

    Promise.resolve(null)
      .then(() => {
        payload.endpoints = prepareEndpointsForNotification(this, payload, options)
      })
      .then(() => {
        // de-nastify payload.
        try {
          payload = utils.walk(payload, true, true, function(o) {
            if (!isSerializableInPayload(o) && o) {
              if (_.isFunction(o.toObject)) {
                return o.toObject()
              } else if (_.isFunction(o.toJSON)) {
                return o.toJSON()
              }
            }
            return o
          })
        } catch (err) {
          void err
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Notification failed to stringify: ' + notification.name })
        }
      })
      .then(() => {
        utils.roughSizeOfObject(serializeObject(payload, true), this.configuration.notification.maxPayloadSize)
      })
      .then(async() => {

        if (rBool(options.queue, true)) {
          modules.workers.send('work', 'notification', payload, {
            reqId: req,
            orgId: this._id,
            priority: options.priority
          })
          return
        }

        const worker = modules.workers.getWorker('notification'),
              WorkerMessage = require('../../../workers/worker-message'),
              message = new WorkerMessage(null, worker, { req })

        await promised(worker, 'process', message, payload, { raiseEndpointErrors: true })

      })
      .then(() => callback())
      .catch(err => callback(Fault.from(err)))

  },

  /**
   * retrieves a list of all available object lookup ids
   */
  getObjectNames: function() {

    const nativeNames = this.configuration.legacyObjects ? Object.keys(consts.NativeIds) : (_.difference(Object.keys(consts.NativeIds), Object.keys(consts.LegacyObjectIds)))
    return _.uniq(this.objects.map(function(v) { return v.name }).concat(nativeNames))
  },

  generateEmailUrl: function(name, token, clientKey) {

    const client = this.keyToClient(clientKey)

    for (const [document, path, force] of [[client, `urls.${name}`, false], [this, `configuration.urls.${name}`, true]]) {

      const node = document?.schema?.node?.findNode(path)
      if (node) {
        const template = pathTo(document, path),
              url = (template || force) && node.generateUrl(this, template, token)
        if (url) {
          return url
        }
      }

    }

    return ''

  },

  keyToClient: function(key) {

    for (const app of toArray(this.apps)) {
      for (const client of toArray(app.clients)) {
        if (client.key === key ||
            (client.allowNameMapping && key && app.name === key) ||
            equalIds(key, client._id)
        ) {
          return client
        }
      }
    }

    return null

  },

  /**
   * re-populate local object array.
   * @param callback
   */
  syncObjects: function(callback) {

    modules.db.models.object.find({ org: this._id, reap: false }).select('_id').lean().exec((err, objects) => {
      if (err) {
        return callback(err)
      }
      const objectIds = objects.map(v => v._id)
      modules.db.sequencedUpdate(this.constructor, this._id, { $set: { objects: objectIds } }, err => {
        if (err) {
          logger.error(`failed to sequence org '${this.code}' objects.`)
          return callback(err)
        }
        this.setValue('sequence', (this.getValue('sequence') || 0) + 1)
        this.setValue('objects', objectIds)
        this.populate({
          path: 'objects',
          match: { reap: false },
          select: '_id created lookup name pluralName sequence version'
        }, err => {
          void err
          callback()
        })
      })
    })

  },

  async buildRuntime(ac) {

    const { Script, Expression } = modules.db.models,
          Org = this.constructor,
          { runtime, scripts } = await Script.buildRuntime(ac),
          policies = (await promised(Org, 'aclReadPath', ac.principal, null, 'policies', { allowNullSubject: true, document: this, acOptions: { isExport: true } }))
            .filter((policy) =>
              policy.active && matchesEnvironment(policy.environment)
            )
            .map(policy => OrgPolicyDefinition.parseResources(ac.org, policy).filter(doc => doc.type === 'policy')[0])
            .concat(
              scripts.reduce((policies, script) => {
                for (const policy of toArray(script.resources).filter(doc => doc.type === 'policy')) {
                  if (policy.active && matchesEnvironment(policy.environment)) {
                    policies.push(policy)
                  }
                }
                return policies
              }, [])
            ),
          expressions = await (async() => {

            return (await Expression.collection.aggregate([{
              $match: {
                org: ac.orgId,
                object: 'expression',
                reap: false,
                active: true,
                $or: [{
                  environment: { $exists: false }
                }, {
                  environment: { $in: ['*', config('app.env')] }
                }]
              }
            }, {
              $project: {
                _id: 1,
                org: 1,
                acl: 1,
                object: 1,
                type: 1,
                sequence: 1,
                active: 1,
                label: 1,
                name: 1,
                environment: 1,
                weight: 1,
                objectHash: 1
              }
            }], { cursor: {} }))
              .toArray()
              .map(doc => {
                return {
                  metadata: {
                    runtime: false,
                    expressionId: doc._id,
                    resource: `expression#type(${doc.type}).name(${doc.name})`
                  },
                  ..._.pick(doc, 'active', 'type', 'label', 'name', 'environment', 'weight', 'objectHash')
                }
              })

          })()

    runtime.policies = []

    for (const insert of policies) {

      const pos = _.findIndex(runtime.policies, v => v.name && insert.name && v.name === insert.name),
            existing = runtime.policies[pos]

      if (!existing) {
        runtime.policies.push(insert)
      } else {
        if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          runtime.policies.splice(pos, 1, insert)
        }
      }

    }

    // policies are sorted by priority first. (higher first)
    runtime.policies.sort(
      firstBy((a, b) =>
        rNum(b.priority, 0) - rNum(a.priority, 0)
      )
        .thenBy((a, b) =>
          rNum(b.weight, 0) - rNum(a.weight, 0)
        )
    )

    for (const insert of expressions) {

      const array = runtime[`${insert.type}s`] || [], // pipelines, expressions
            pos = _.findIndex(array, v => v.name && insert.name && v.name === insert.name),
            existing = array[pos]

      if (!existing) {
        array.push(insert)
      } else {
        if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
          array.splice(pos, 1, insert)
        }
      }

    }

    return deserializeObject(serializeObject({
      ...runtime,
      build: {
        _id: createId(),
        sequence: this.getValue('sequence') || 0,
        created: new Date(),
        org: this.code,
        env: config('app.env'),
        domain: config('app.domain'),
        endpoint: config('server.apiHost')
      }
    }))

  },

  async getRuntime() {

    let { runtime } = this,
        { build: { env, domain, endpoint } = {} } = runtime || {}

    if (!(config('app.env') === env && config('app.domain') === domain && config('server.apiHost') === endpoint)) {

      const ac = new acl.AccessContext(ap.synthesizeOrgAdmin(this))
      await this.syncEnvironment(ac)
      runtime = this.runtime

    }

    return runtime
  },

  async syncEnvironment(ac, { reparseResources = false, save = true, throwError = false, logError = true, synchronizeJobs = true } = {}) {

    if (ac.option('deferSyncEnvironment')) {
      return null
    }

    let err, runtime

    try {

      // if the user wants to re-parse, re-parse scripts outside of the sequence.
      if (reparseResources) {
        const { Script } = modules.db.models
        await Script.buildRuntime(ac, { reparseResources })
      }

      // build and store the latest runtime.
      runtime = await promised(modules.db, 'sequencedFunction', callback => {

        Promise.resolve(null)
          .then(async() => {

            const Org = await promised(this, 'createObject', 'org'),
                  org = await Org.loadOrg(this._id, { cache: false }),
                  rac = new acl.AccessContext(ac.principal, org, { req: ac.req, script: ac.script }),
                  runtime = await org.buildRuntime(rac)

            if (save) {
              org.runtime = runtime
              await promised(rac, 'lowLevelUpdate')
              this.setValue('sequence', org.sequence)
              this.$$decodedRuntime = runtime
              this.setValue('runtime', org.getValue('runtime'))
              ac.updateOrg(org)
            }

            return runtime

          })
          .then(v => callback(null, v))
          .catch(e => callback(e))

      }, 10)

      if (synchronizeJobs) {

        // sync job schedules
        const { jobs: runtimeJobs } = runtime,
              { workers } = modules,
              scheduledJobs = await workers.getScheduledJobs(this)

        for (const scheduled of scheduledJobs) {
          const name = scheduled.name
          if (!runtimeJobs.find(job => name === job.metadata.resource)) {
            await workers.unscheduleJob(this, scheduled.name)
          }
        }

        try {
          for (const job of runtimeJobs) {
            const name = job.metadata.resource,
                  scheduled = scheduledJobs.find(scheduled => name === scheduled.name),
                  options = {
                    priority: 1,
                    cron: job.configuration.cron,
                    payload: {
                      script: job.metadata.resource
                    }
                  }
            if (scheduled) {
              options.resetTrigger = scheduled.schedule !== job.configuration.cron
            }
            await workers.scheduleJob(
              this,
              name,
              options
            )
          }
        } catch (err) {
          void err
        }

      }

    } catch (e) {

      err = Fault.from(e, null, true)
      err.trace = 'Error\n\tnative syncEnvironment:0'

      if (logError) {
        modules.db.models.Log.logApiErr(
          'api',
          err,
          ac
        )
      }

      logger.error(`sync environment`, { org: this.code, err: toJSON(err) })
      runtime = null
    }

    if (err && throwError) {
      throw err
    } else if (runtime) {
      logger.silly(`sync environment`, runtime.build)
    }

    return runtime

  },

  /**
   * finds object info by name, pluralname, or by id. only includes custom objects and extensions.
   * @param {string} str
   * @param {string=null} byPluralName
   * @param {boolean=false} disallowObjectId true to skip looking up by Object id. mostly used for routes.
   * @returns {*}
   */
  findObjectInfo: function(str, byPluralName = null, disallowObjectId = false) {

    const lookup = disallowObjectId ? null : utils.getIdOrNull(str)
    if (!lookup) {
      str = String(str).toLowerCase()
    }
    if (this.objectsMap && this.objectsMap[str || byPluralName]) {
      return this.objectsMap[str || byPluralName]
    }

    return _.find(this.objects, function(object) {

      if (lookup) {
        return equalIds(lookup, object.lookup)
      } else if (byPluralName == null) {
        return object.pluralName === str || object.name === str
      }
      return object[byPluralName ? 'pluralName' : 'name'] === str
    })
  },

  resolveRoles: function(roles) {

    return toArray(roles, roles)
      .map(role => {

        if (couldBeId(role)) {
          return getIdOrNull(role)
        }
        return pathTo(this.roles.find(({ code }) => role === code), '_id')
      })
      .filter(v => v)

  },

  createOO: function(input, callback) {

    const objectName = String(input).toLowerCase(),
          objectId = getIdOrNull(objectName),
          { OO } = modules.db.models,
          find = { org: this._id, name: objectName, reap: false }

    if (objectId) {
      find._id = objectId
    } else {
      find.name = objectName
    }

    if (!objectId && !isCustomName(objectName, 'o_', false)) {
      setImmediate(() => callback(Fault.create('cortex.invalidArgument.object', { path: objectName })))
      return
    }

    OO.findOne(find).lean().exec((err, objectDoc) => {
      if (!err && !objectDoc) {
        err = Fault.create('cortex.invalidArgument.object', { path: objectName })
      }
      if (err) {
        return callback(err)
      }

      // either load from cache, build from cache, or build from scratch.
      let object

      // find the object in the cache.
      if (config('contexts.cacheCustom')) {
        object = ooCache.get(this._id + '_' + objectDoc._id)
      }

      if (object && equalIds(object.objectId, objectDoc._id) && object.sequence === objectDoc.sequence && object.created.getTime() === objectDoc.created.getTime()) {
        return callback(null, object)
      }

      modules.db.definitions.generateCustomModel(objectDoc, (err, object) => {
        if (!err && config('contexts.cacheCustom')) {
          const cacheKeys = {
            _id: this._id + '_' + object.objectId,
            name: this._id + '_' + object.objectName
          }
          ooCache.set(cacheKeys, object)
        }
        callback(err, object)
      })

    })

  },

  /**
   *
   * @param objectNameOrId
   * @param options
   *  usePluralName: null.  if true, looks up the object using the pluralized object code only, false: singular only, null: singular or plural.
   *  throw: true
   * @param callback (err, object)
   */
  createObject: function(objectNameOrId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback, false, false)

    const promise = new Promise((resolve, reject) => {

      if (isCustomName(objectNameOrId, 'o_', false)) {
        return this.createOO(objectNameOrId, (err, result) => {
          err ? reject(err) : resolve(result)
        })
      }

      let value = utils.getIdOrNull(objectNameOrId),
          useLookup,
          entry

      if (value) {
        useLookup = true
      } else if (_.isObject(objectNameOrId)) {
        useLookup = true // use the lookup field instead of _id. lookup stores the shared name (stock and extensions)
        value = utils.getIdOrNull(objectNameOrId._id)
      } else {
        value = String(objectNameOrId).toLowerCase()
      }

      entry = _.find(toArray(this.objects), function(entry) {
        if (!entry) {
          return false
        } else if (useLookup) {
          return equalIds(entry.lookup, value)
        } else if (options.usePluralName == null) {
          return entry.pluralName === value || entry.name === value
        }
        return entry[options.usePluralName ? 'pluralName' : 'name'] === value
      })

      // shortcut out if we have object entries and a matching version in the local object cache
      // so only allow custom objects to shortcut
      if (entry && config('contexts.cacheCustom')) {
        const objectId = useLookup ? value : utils.getIdOrNull(entry.lookup)
        if (objectId) {
          const search = {}, searchValue = this._id + '_' + value
          if (useLookup) {
            search._id = searchValue
          } else if (options.usePluralName == null) {
            search.pluralName = searchValue
            search.name = searchValue
          } else {
            search[options.usePluralName ? 'pluralName' : 'name'] = searchValue
          }
          let object = objectCache.search(search)
          if (object && equalIds(objectId, object.objectId) && object.sequence === entry.sequence && object.created.getTime() === entry.created.getTime()) { // @todo change to version. only the active version should be cached. @critical for versioning.
            return setImmediate(resolve, object)
          }
        }
      }

      // use the native models for built-in objects when:
      // 1. they are non-extensible.
      // 2. they have no objects entry (this assumes the org's populated 'objects' array is caught up).
      const objDef = modules.db.definitions.getBuiltInObjectDefinition(value, options.usePluralName),
            find = { org: this._id, reap: false }

      if (objDef && (!objDef.isExtensible || !entry)) {
        let object

        if (!this.configuration.legacyObjects && consts.LegacyObjectIds[objDef.objectName]) {
          return reject(Fault.create('cortex.invalidArgument.object', { path: value }))
        }

        try {
          object = modules.db.models[objDef.objectName]
        } catch (e) {
          return reject(Fault.create('cortex.invalidArgument.object', { path: value }))
        }
        return resolve(object)
      }

      // load the object configuration.
      if (useLookup) {
        find['lookup'] = value
      } else if (options.usePluralName === null || options.usePluralName === undefined) {
        find.$or = [{ name: value }, { pluralName: value }]
      } else {
        find[options.usePluralName ? 'pluralName' : 'name'] = value
      }

      modules.db.models.Object.findOne(find).lean().exec((err, objectDoc) => {
        if (!err && !objectDoc) {
          if (isCustomName(value) || !(objDef)) { // custom object with no config or base with no default.
            return this.createOO(objectNameOrId, (err, result) => {
              err ? reject(err) : resolve(result)
            })
          }
        }
        if (err) {
          return reject(err)
        }

        // either load from cache, build from cache, or build from scratch.
        let object

        // if there is no configuration, it means we're still using the defaults. go ahead and return the stock model.
        if (!objectDoc) {
          try {
            object = modules.db.models[objDef.objectName]
          } catch (e) {
            err = Fault.create('cortex.invalidArgument.object', { path: value })
          }
          return err ? reject(err) : resolve(object)
        }

        // find the object in the cache.
        if (config('contexts.cacheCustom')) {
          object = objectCache.get(this._id + '_' + objectDoc.lookup)
        }

        if (object && equalIds(objectDoc.lookup, object.objectId) && object.sequence === objectDoc.sequence && object.created.getTime() === objectDoc.created.getTime()) {
          return resolve(object)
        }

        modules.db.definitions.generateCustomModel(objectDoc, (err, object) => {
          if (!err && config('contexts.cacheCustom')) {
            const cacheKeys = {
              _id: this._id + '_' + object.objectId,
              name: this._id + '_' + object.objectName,
              pluralName: this._id + '_' + object.pluralName
            }
            objectCache.set(cacheKeys, object)
          }
          err ? reject(err) : resolve(object)
        })

      })

    })

    if (callback) {
      promise
        .then(v => callback(null, v))
        .catch(e => callback(rBool(options.throw, true) ? e : null))
    }

    if (!rBool(options.throw, true)) {
      promise.catch(err => {
        void err
        return null
      })
    }

    return promise

  }
}

// shared statics --------------------------------------------------------

OrgDefinition.statics = {

  aclInit: function() {

    modules.db.models.Template.hook('delete').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err, notifications = vars.principal.org.configuration.notifications.reduce((notifications, notif) => {
        return notif.endpoints.reduce((notifications, endpoint) => {
          if (consts.Notifications.EndpointMap[endpoint._id].name === vars.template.type && endpoint.template === vars.template.name) {
            notifications.push(notif.label)
          }
          return notifications
        }, notifications)
      }, [])

      if (notifications.length) {
        const { template } = vars,
              { type, name } = template
        err = Fault.create('cortex.accessDenied.inUse', { resource: `template#${type}.name(${name})`, reason: 'This template is in use by the following notifications(s): ' + notifications })
      }

      callback(err)

    })

    this.hook('app.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err = null,
          policies = vars.ac.org.policies.filter(policy => utils.inIdArray(policy.appWhitelist, vars.appId) || utils.inIdArray(policy.appBlacklist, vars.appId))

      if (!err && policies.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This app is in use by the following policies(s): ' + policies.map(policy => policy.label) })
      }

      callback(err)

    })

    this.hook('role.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err = null,
          policies = vars.ac.org.policies.filter(policy => utils.findIdInArray(policy.aclWhitelist, 'target', vars.roleId) || utils.findIdInArray(policy.aclBlacklist, 'target', vars.roleId)),
          serviceAccounts = vars.ac.org.serviceAccounts.filter(sa => utils.inIdArray(sa.roles, vars.roleId))

      if (!err && policies.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This role is in use by the following policies(s): ' + policies.map(policy => policy.label) })
      }
      if (!err && serviceAccounts.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This role is in use by the following serviceAccounts(s): ' + serviceAccounts.map(sa => sa.label) })
      }

      callback(err)

    })

    this.hook('serviceAccount.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err,
          apps = vars.ac.org.apps.filter(app => equalIds(app.clients[0].principalId, vars.serviceAccountId)),
          policies = vars.ac.org.policies.filter(policy => policy.script && toArray(policy.script.serviceAccounts).includes(vars.serviceAccount.name))

      if (apps.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This service account is in use by the following apps(s): ' + policies.map(policy => policy.label) })
      } else if (policies.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This service account is in use by the following policies(s): ' + policies.map(policy => policy.label) })
      }

      callback(err)

    })

    this.hook('storageLocation.removed').before((vars, callback) => {

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err = null

      if (vars.storageId === vars.ac.subject.configuration.storage.defaultLocation) {
        err = Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'The default storage location cannot be deleted.' })
      } else if (vars.storageId === vars.ac.subject.configuration.storage.exportLocation) {
        err = Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'The export storage location cannot be deleted.' })
      }

      callback(err)

    })

    modules.db.models.Script.hook('delete').before((vars, callback) => {

      const customExport = pathTo(vars.ac.subject, 'configuration.export')

      if (!customExport) {
        return callback()
      }

      if (config('debug.skipInUseTriggers')) {
        return callback()
      }

      let err = null,
          policies = vars.ac.org.policies.filter(policy =>
            (policy.script && toArray(policy.script.requires).includes(customExport))
          )

      if (!err && policies.length) {
        err = Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This script is in use by the following policies(s): ' + policies.map(policy => policy.label) })
      }

      callback(err)

    })

  },

  isAclReady: function(org) {
    return (
      modules.db.isModelInstance(org) &&
        org.constructor.__ObjectSchema__ &&
        org.constructor.objectName === 'org' &&
        org.isSelected('code') &&
        org.isSelected('objects') &&
        org.isSelected('roles') &&
        org.isSelected('reap') &&
        !org.reap
    )
  },

  /**
   * @param orgOrId org instance or id
   * @param callback err, Org model
   */
  prepareForAcl: function(orgOrId, callback) {

    if (this.isAclReady(orgOrId)) {
      setImmediate(callback, null, orgOrId)
      return
    }

    this.loadOrg(utils.getIdOrNull(orgOrId, true), function(err, org) {
      if (!err) {
        if (!org || org.reap) {
          err = Fault.create('cortex.notFound.org')
        }
      }
      callback(err, org)
    })

  },

  /**
   *
   * @param objectNameOrId
   * @param orgDocumentOrCodeOrId
   * @param {object|function=} options
   *  usePluralName: false.  if true, looks up the object using the pluralized object code.
   *  cache: true. set to false to force a new org document to load.
   * @param {function=} callback (err, {model, org})
   */
  createObject: function(objectNameOrId, orgDocumentOrCodeOrId, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    options = utils.extend({
      paths: ''
    }, options)

    this.loadOrg(orgDocumentOrCodeOrId, { cache: options.cache }, (err, org) => {
      if (err) {
        return callback(err, {})
      }
      org.createObject(objectNameOrId, options, function(err, model) {
        callback(err, { model, org })
      })
    })

  },

  loadOrg: function(orgDocumentOrCodeOrId, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback, false, true)

    const promise = new Promise((resolve, reject) => {

      let cached = null

      if (this.isAclReady(orgDocumentOrCodeOrId)) {
        return resolve(orgDocumentOrCodeOrId)
      }

      const orgId = utils.getIdOrNull(orgDocumentOrCodeOrId),
            cache = utils.rBool(options.cache, true),
            reap = utils.rBool(options.reap, false),
            match = { reap }
      if (orgId) {
        match._id = orgId
      } else if (_.isString(orgDocumentOrCodeOrId)) {
        match.code = orgDocumentOrCodeOrId
      } else {
        return reject(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Expected an ObjectId/String Org code.' }))
      }
      cached = cache && orgCache.search(match)
      if (cached) {
        this.collection.find(Object.assign({ reap: false, object: 'org' }, match)).limit(1).project({ _id: 1, sequence: 1 }).toArray((err, docs) => {
          const doc = docs && docs[0]
          if (!err && doc && cached.sequence === doc.sequence) {
            resolve(cached)
          } else {
            return _loadOrgDocument(this, match)
          }
        })
      } else {
        return _loadOrgDocument(this, match)
      }

      async function _lookupOrg(match) {
        return new Promise((resolve, reject) => {
          let org = null,
              notFoundOrgError = Fault.create('cortex.notFound.org')

          modules.db.models.Org.collection.find(Object.assign({ reap: false, object: 'org' }, match)).limit(1).project({ _id: 1, code: 1 }).toArray((err, data = []) => {
            try {
              if (err) {
                reject(err)
                return
              }

              org = data && data[0]
              if (!org || !org._id) {
                reject(notFoundOrgError)
                return
              }

              resolve(org)
            } catch (err) {
              reject(notFoundOrgError)
            }
          })
        })
      }

      function inlineOrgRoles(roles, org) {
        roles.forEach(v => {
          org.inlinedRoles[v._id.toString()] = v
          if (v.include && v.include.length) {
            inlineOrgRoles(v.include, org)
          }
        })
      }

      async function _loadOrgDocument(Org, match) {

        let org = null
        try {
          org = await _lookupOrg(match)
        } catch (err) {
          reject(err)
          return
        }

        Org.findOne({ _id: org._id }).populate({ path: 'objects', match: { reap: false }, select: '_id created lookup name pluralName sequence version' }).exec(function(err, org) {
          if (err || !org) {
            return reject(err || Fault.create('cortex.notFound.org'))
          }

          org.objectsMap = {}
          org.objects.forEach(object => {
            if (object.pluralName) org.objectsMap[object.pluralName] = object
            org.objectsMap[object.name] = object
          })

          org.inlinedRoles = {}
          inlineOrgRoles(org.roles, org)

          if (!org.i18n) {
            org.i18n = new modules.i18n()
            if (cache) {
              orgCache.set({ _id: org._id, code: org.code }, org)
            }
          }
          return resolve(org)
        })
      }

    })

    if (callback) {
      promise
        .then(v => callback(null, v))
        .catch(e => callback(e))
    }

    return promise

  }

}

// indexes ---------------------------------------------------------------

OrgDefinition.indexes = [
  [{ code: 1 }, { unique: true, name: 'idxUniqueOrgCode', partialFilterExpression: { code: { $exists: true } } }],
  [{ 'apps.clients.key': 1 }, { unique: true, name: 'idxUniqueOrgClientKey', partialFilterExpression: { 'apps.clients.key': { $exists: true } } }]
]

// hooks -----------------------------------------------------------------

OrgDefinition.apiHooks = [
  {
    name: 'validate',
    before: function(vars, callback) {
      let document = vars.ac.subject
      if (document.isNew) {
        document.org = document._id
      }
      if (!equalIds(document._id, document.org)) {
        callback(Fault.create('cortex.error.unspecified', { resource: vars.ac.getResource(), reason: 'org id must match org property.' }))
        return
      }
      callback()
    }
  }, {
    name: 'save',
    before: function(vars, callback) {

      const context = vars.ac.subject,
            targets = toArray(pathTo(context, 'deployment.targets'))

      targets.forEach(function(target) {
        if (target.isNew) {
          target.token = modules.authentication.genAlphaNumString(32)
        }
      })

      if (!context.isNew) {
        return callback()
      }

      // set default roles.
      context.roles = Object.values(consts.defaultRoles)

      // add hub api keys and rsa key pair
      modules.authentication.genRsaKeypair(2048, (err, { pub, priv } = {}) => {
        if (!err) {
          context.hub = {
            enabled: true,
            envKey: modules.authentication.genAlphaNumString(consts.API_KEY_LENGTH),
            envSecret: modules.authentication.genAlphaNumString(consts.API_SECRET_LENGTH),
            clientKey: modules.authentication.genAlphaNumString(consts.API_KEY_LENGTH),
            clientRsa: {
              timestamp: Math.floor(Date.now() / 1000),
              public: pub,
              private: priv
            }
          }
        }
        callback(err)
      })
    }
  }, {
    name: 'update',
    after: function(vars, callback) {

      async.series([
        callback => {
          this.loadOrg(vars.ac.subjectId, (err, document) => {
            if (!err && document) {
              vars.ac.updateOrg(document)
              if (config('__is_mocha_test__')) {
                require('../../../../../test/lib/server').updateOrg(callback)
              } else {
                callback()
              }
            } else {
              callback()
            }
          })
        },
        async() => {
          try {
            if (~vars.modified.indexOf('policies')) {
              let org = vars.ac.org,
                  ac = vars.ac
              if (!equalIds(vars.ac.org._id, vars.ac.subject._id)) {
                org = await this.loadOrg(vars.ac.subject._id, { cache: false })
                ac = new acl.AccessContext(ap.synthesizeOrgAdmin(org))
              }
              await org.syncEnvironment(ac)
            }
          } catch (err) {
            void 0
          }
        }

      ], callback)

    }
  }, {
    name: 'delete',
    before: function(vars, callback) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Cannot delete an organization.' }))
    }
  }, {
    name: 'create',
    before: function(vars, callback) {
      if (!vars.ac.principal.isSysAdmin()) {
        callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'An org can only be provisioned at the System level' }))
        return
      }
      callback()
    },
    after: function(vars, callback) {

      async.series([
        async() => {
          try {
            if (~vars.modified.indexOf('policies')) {
              let org = vars.ac.org,
                  ac = vars.ac
              if (!equalIds(vars.ac.org._id, vars.ac.subject._id)) {
                org = await this.loadOrg(vars.ac.subject._id, { cache: false })
                ac = new acl.AccessContext(ap.synthesizeOrgAdmin(org))
              }
              await org.syncEnvironment(ac)
            }
          } catch (err) {
            void 0
          }
        },
        callback => {
          modules.db.models.template.installOrgTemplates(vars.ac.subjectId, function(err) {
            if (err) {
              logger.error('Org.postCreate failed to install installing org templates for org ' + vars.ac.subjectId.toString())
            }
            callback()
          })
        }
      ], callback)

    }
  }
]

OrgDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  // export top-level resources without a parent path to avoid dependency issues linking them to the env
  const resourcePath = `env`,
        topLevel = [
          'configuration.notifications', 'configuration.sms.numbers',
          'configuration.storage.locations', 'apps', 'roles', 'policies', 'serviceAccounts'
        ],
        omitted = [
          'deployment', 'acl', 'code'
        ]

  for (const path of topLevel) {

    const values = toArray(pathTo(doc, path)),
          node = this.findNode(path)

    await Promise.all(
      values.map(
        async(doc) => node.export(ac, doc, resourceStream, '', options)
      )
    )

  }

  // omit top-level exported resources from the instance export
  topLevel.concat(omitted).forEach(path => {
    pathDel(doc, path)
  })

  let object = await ModelDefinition.prototype.export.call(this, ac, doc, resourceStream, resourcePath, options)

  if (object !== Undefined) {

    resourceStream.addPath(resourcePath, parentResource, { ...options, required: true })

    object.object = resourcePath

    // omitted paths will have re-appeared with defaults.
    topLevel.concat(omitted).forEach(path => {
      pathDel(doc, path)
    })

    return resourceStream.exportResource(object, resourcePath)

  }

  return Undefined

}

OrgDefinition.prototype.import = async function(ac, value, resourceStream, parentResource, options) {

  return resourceStream.updateEnvironment(async(ac) => {

    const resourcePath = `env`,
          omittedPaths = Object.values(modules.developer.consts.envResourcePaths),
          input = value && omittedPaths.reduce((input, omit) => {
            pathDel(input, omit)
            return input
          }, clone(value)),
          doc = await ModelDefinition.prototype.import.call(this, ac, input, resourceStream, resourcePath, options),
          { _id, code } = ac.org

    if (doc !== Undefined) {

      ac.method = 'put'
      await promised(ac.object.schema.node, 'aclWrite', ac, ac.org, doc, { mergeDocuments: true })
      return { _id, code }
    }

    return Undefined

  })

}

module.exports = OrgDefinition
