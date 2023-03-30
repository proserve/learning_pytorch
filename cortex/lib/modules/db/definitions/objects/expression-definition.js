'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      hasher = require('object-hash'),
      modules = require('../../../index'),
      { path: pathTo } = require('../../../../utils')

function ExpressionDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(ExpressionDefinition, BuiltinContextModelDefinition)

ExpressionDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ExpressionDefinition.statics
  options.methods = ExpressionDefinition.methods
  options.indexes = ExpressionDefinition.indexes
  options.options = { collection: ExpressionDefinition.collection }
  options.apiHooks = ExpressionDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ExpressionDefinition.collection = 'contexts'

ExpressionDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.expression,
    isDeployable: false,
    objectLabel: 'Expression',
    objectName: 'expression',
    pluralName: 'expressions',
    collection: 'contexts',
    auditing: {
      enabled: true,
      all: true,
      category: 'configuration'
    },
    isExtensible: false,
    allowConnections: false,
    uniqueKey: 'name',
    allowConnectionsOverride: false,
    requiredAclPaths: ['objectHash'],
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    isFavoritable: false,
    properties: [
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        writable: true,
        nativeIndex: true,
        trim: true,
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 100
          }
        }]
      },
      {
        label: 'Description',
        name: 'description',
        type: 'String',
        // description: 'The description',
        writable: true,
        trim: true,
        validators: [{
          name: 'printableString',
          definition: {
            min: 0,
            max: 512
          }
        }]
      },
      {
        _id: consts.Properties.Ids.Expression.Name,
        indexed: true,
        indexSlot: 0,
        label: 'Name',
        name: 'name',
        type: 'String',
        writable: true,
        nativeIndex: true,
        writer: function(ac, node, v) {
          return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
        },
        validators: [{
          name: 'customName'
        }, {
          name: 'adhoc',
          definition: {
            errCode: 'cortex.conflict.exists',
            message: 'A unique expression name',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, object: 'expression', name: v }).lean().select('_id').exec(function(err, doc) {
                callback(err, !(err || doc))
              })
            },
            skip: function(ac, node) {
              return ac.option(`skip.validator:${node.fqpp}`)
            }
          }
        }]
      },
      {
        label: 'Active',
        name: 'active',
        type: 'Boolean',
        writable: true,
        default: true
      },
      {
        label: 'Environment',
        name: 'environment',
        type: 'String',
        writable: true,
        default: '*',
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: {
            values: ['production', 'development', '*']
          }
        }]
      },
      {
        // higher goes first
        label: 'Runtime Weight',
        name: 'weight',
        type: 'Number',
        writable: true,
        default: 0,
        validators: [{
          name: 'required'
        }, {
          name: 'number',
          definition: {
            allowNull: false,
            allowDecimal: true
          }
        }]
      },
      {
        label: 'Object Hash',
        name: 'objectHash',
        type: 'String',
        readable: false
      }
    ],
    objectTypes: [
      {
        _id: consts.expressions.types.expression,
        label: 'Expression Operator',
        name: 'expression',
        properties: [
          {
            label: 'Expression',
            name: 'expression',
            type: 'Expression',
            writable: true,
            maxSize: 32 * 1024,
            dependencies: ['objectHash'],
            writer: function(ac, node, value) {
              this.objectHash = hasher(value, { algorithm: 'sha256', encoding: 'hex' })
              return value
            }
          }
        ]
      },
      {
        _id: consts.expressions.types.pipeline,
        label: 'Pipeline Stage',
        name: 'pipeline',
        properties: [
          {
            label: 'Pipeline',
            name: 'pipeline',
            type: 'Expression',
            writable: true,
            pipeline: true,
            maxSize: 32 * 1024,
            dependencies: ['objectHash'],
            writer: function(ac, node, value) {
              this.objectHash = hasher(value, { algorithm: 'sha256', encoding: 'hex' })
              return value
            }
          }
        ]
      }
    ]
  }

}

// shared methods --------------------------------------------------------

ExpressionDefinition.methods = {}

// shared statics --------------------------------------------------------

ExpressionDefinition.statics = {}

// indexes ---------------------------------------------------------------

ExpressionDefinition.indexes = []

// shared hooks  ---------------------------------------------------------

ExpressionDefinition.apiHooks = [{
  name: 'create',
  after: function(vars, callback) {

    vars.ac.org.syncEnvironment(vars.ac)
      .catch(err => {
        void err
      })
      .then(() => callback())
  }
}, {
  name: 'update',
  after: function(vars, callback) {
    vars.ac.org.syncEnvironment(vars.ac)
      .catch(err => {
        void err
      })
      .then(() => callback())
  }
}, {
  name: 'delete',
  before: function(vars) {
    // unset unique name
    const subject = vars.ac.subject
    pathTo(subject, 'name', undefined)
  }
}, {
  name: 'delete',
  after: function(vars, callback) {
    vars.ac.org.syncEnvironment(vars.ac)
      .catch(err => {
        void err
      })
      .then(() => callback())
  }
}]

// exports --------------------------------------------------------

module.exports = ExpressionDefinition
