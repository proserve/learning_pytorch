'use strict'

const _ = require('underscore'),
      acl = require('../../../../acl'),
      utils = require('../../../../utils'),
      { encodeME, decodeME } = utils,
      consts = require('../../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

let Undefined

module.exports = class AuditDefinition extends BuiltinContextModelDefinition {

  constructor(options = {}) {
    super(options)
  }

  generateMongooseSchema(options) {

    options = options || {}
    options.statics = AuditDefinition.statics
    options.methods = AuditDefinition.methods
    options.indexes = AuditDefinition.indexes
    options.options = { collection: AuditDefinition.collection }
    options.apiHooks = AuditDefinition.apiHooks

    return super.generateMongooseSchema(options)
  }

  getNativeOptions() {

    return {
      _id: consts.NativeIds.audit,
      objectLabel: 'Audit',
      objectName: 'audit',
      pluralName: 'audits',
      collection: 'audits',
      isExtensible: false,
      defaultAclOverride: false,
      defaultAclExtend: false,
      defaultAcl: [],
      createAclOverwrite: false,
      createAclExtend: false,
      allowConnections: false,
      allowConnectionsOverride: false,
      isVersioned: false,
      isDeletable: true,
      isUnmanaged: true,
      shareChainOverride: false,
      shareAclOverride: false,
      createAcl: [],
      shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
      isFavoritable: false,
      allowConnectionOptionsOverride: false,
      properties: [
        // the associated request.
        {
          label: 'Request Id',
          name: 'req',
          type: 'ObjectId',
          nativeIndex: true
        },
        {
          label: 'Principal',
          name: 'principal',
          type: 'ObjectId',
          nativeIndex: true
        },
        {
          label: 'IP Address',
          name: 'ipv4',
          type: 'Number',
          nativeIndex: true
        },
        {
          // the event category
          label: 'Category',
          name: 'cat',
          type: 'String',
          nativeIndex: true,
          validators: [
            {
              name: 'required'
            }, {
              name: 'stringEnum',
              definition: {
                values: Object.keys(consts.audits.categories)
              }
            }
          ]
        },
        {
          // the event sub-category
          label: 'Sub Category',
          name: 'sub',
          type: 'String',
          nativeIndex: true,
          dependencies: ['.cat'],
          validators: [
            {
              name: 'required'
            }, {
              name: 'adhoc',
              definition: {
                code: 'cortex.invalidArgument.enumValue',
                message: 'Select a valid event category and sub category',
                validator: function(ac, node, value) {
                  const [, sub] = modules.audit.findCategory(this.cat, value)
                  return sub !== null
                }
              }
            }
          ]
        },
        {
          label: 'Context',
          name: 'context',
          type: 'Document',
          forceId: true,
          autoId: false,
          properties: [
            {
              // the originating context object
              label: 'Object',
              name: 'object',
              type: 'String',
              nativeIndex: true
            },
            {
              // the originating context identifier
              label: 'Identifier',
              name: '_id',
              type: 'ObjectId',
              nativeIndex: true
            }
          ]
        },
        {
          label: 'Access Context',
          name: 'ac',
          type: 'Any',
          serializeData: false,
          set: ac => {

            const script = ac.script && _.pick(ac.script.environment.script, 'access', 'depth', 'label', 'type', '_id')
            if (script) {
              script.principal = _.pick(ac.script.principal, '_id', 'object')
              script.trace = ac.script.lastTrace || Undefined
            }

            return encodeME({
              principal: ac.principalId,
              access: ac.resolved,
              roles: ac.roles,
              script: script || Undefined
            }, true)

          },
          get: function(v) { return decodeME(v) }
        },
        {
          label: 'Metadata',
          name: 'metadata',
          type: 'Any',
          serializeData: false,
          set: function(v) { return encodeME(v) },
          get: function(v) { return decodeME(v) }
        },
        {
          label: 'Error',
          name: 'err',
          type: 'Any',
          serializeData: false,
          set: (v) => {
            const err = encodeME(utils.toJSON(Fault.from(v)))
            if (err && err.stack) {
              delete err.stack // NEVER include the stack in an audit record.
            }
            return err
          },
          get: decodeME
        }
      ]
    }

  }

  // ------------------------------------------

  static get collection() {
    return 'audits'
  }

  static get methods() {
    return {}
  }

  static get statics() {

    return {}

  }

  static get indexes() {
    return [

      [{ 'org': 1, 'object': 1, 'type': 1, 'cat': 1, 'sub': 1, 'req': 1 }, { name: 'idxAuditCategories' }],
      [{ 'org': 1, 'object': 1, 'type': 1, 'req': 1, 'cat': 1, 'sub': 1 }, { name: 'idxAuditRequests' }],
      [{ 'org': 1, 'object': 1, 'type': 1, 'ipv4': 1, 'cat': 1, 'sub': 1, 'req': 1 }, { name: 'idxAuditSourceIp' }],
      [{ 'org': 1, 'object': 1, 'type': 1, 'principal': 1, 'cat': 1, 'sub': 1, 'req': 1 }, { name: 'idxAuditPrincipal' }],
      [{ 'org': 1, 'object': 1, 'type': 1, 'context.object': 1, 'cat': 1, 'sub': 1, 'req': 1, 'context._id': 1 }, { name: 'idxAuditContext' }]

    ]
  }

  static get apiHooks() {
    return {}
  }

}
