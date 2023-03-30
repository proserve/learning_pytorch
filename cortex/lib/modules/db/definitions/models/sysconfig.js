'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      { promised } = require('../../../../utils'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      OrgPolicyDefinition = require('../org-policy-definition'),
      modules = require('../../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      configCache = modules.cache.memory.add('cortex.system.config', { maxItems: 10 })

function SysconfigDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(SysconfigDefinition, BuiltinContextModelDefinition)

SysconfigDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = SysconfigDefinition.statics
  options.methods = SysconfigDefinition.methods
  options.indexes = SysconfigDefinition.indexes
  options.options = { collection: SysconfigDefinition.collection }
  options.apiHooks = SysconfigDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

SysconfigDefinition.collection = 'sysconfigs'

SysconfigDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeModels.sysconfig,
    objectLabel: 'Sysconfig',
    objectName: 'sysconfig',
    pluralName: 'sysconfigs',
    collection: 'sysconfigs',
    isExtensible: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    defaultAcl: [],
    hasCreator: false,
    hasOwner: false,
    createAclOverwrite: false,
    createAclExtend: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    isVersioned: false,
    isDeletable: false,
    isUnmanaged: false,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    isFavoritable: false,
    allowConnectionOptionsOverride: false,
    properties: [
      new OrgPolicyDefinition({
        label: 'Global Policies',
        name: 'policies',
        type: 'Document',
        optional: true,
        canPull: true,
        canPush: true,
        array: true,
        maxItems: 50,
        default: []
      }, true),
      {
        label: 'Last Consumed Log File',
        name: 'lastConsumedLogFile',
        type: 'String',
        public: false,
        readable: true,
        writable: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System,
        default: null
      }
    ]
  }

}

// shared methods --------------------------------------------------------

SysconfigDefinition.methods = {}

// shared statics --------------------------------------------------------

SysconfigDefinition.statics = {

  async getConfigId() {

    const SysConfig = this

    let doc = await SysConfig.findOne({}).lean().select('_id').exec()

    if (!doc) {
      doc = new SysConfig()
      doc.org = acl.BaseOrg
      doc.object = SysConfig.objectName
      doc.type = null
      await doc.save()
    }

    return doc._id

  },

  async loadConfig() {

    let sysConfig = configCache.get('sysConfig')

    if (!sysConfig) {

      const _id = await this.getConfigId()

      sysConfig = await this.findOne({ _id }).exec()

      if (!sysConfig) {
        throw Fault.create('cortex.notFound.unspecified', { reason: 'sysConfig not found' })
      }
      configCache.set('sysConfig', sysConfig)

    }

    return sysConfig
  },

  async updateConfig(principal, payload, { grant = acl.AccessLevels.Update } = {}) {

    const SysConfig = this,
          _id = await SysConfig.getConfigId(),
          writeOptions = { method: 'patch', grant }

    await promised(SysConfig, 'aclPatch', principal, _id, payload, writeOptions)
    await promised(modules.services.api, 'command', 'caches.flush', { body: { name: 'cortex.system.config' } })

    return true
  }

}

// indexes ---------------------------------------------------------------

SysconfigDefinition.indexes = []

// shared hooks  ---------------------------------------------------------

SysconfigDefinition.apiHooks = []

// exports --------------------------------------------------------

module.exports = SysconfigDefinition
