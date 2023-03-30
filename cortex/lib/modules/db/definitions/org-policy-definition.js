'use strict'

const DocumentDefinition = require('./types/document-definition'),
      AclDefinition = require('./acl-definition'),
      { naturalCmp, rBool, path: pathTo, array: toArray,
        findIdInArray, rString, sortKeys, extend, promised,
        isSet, equalIds
      } = require('../../../utils'),
      util = require('util'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules'),
      transpiler = modules.services.transpiler,
      pathToRegExp = require('path-to-regexp'),
      acl = require('../../../acl'),
      validUrl = require('valid-url'),
      _ = require('underscore')

let Undefined

function OrgPolicyDefinition(options, system) {

  let properties = [
    {
      label: 'Label',
      name: 'label',
      type: 'String',
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }, {
        name: 'uniqueInArray'
      }, {
        name: 'string',
        definition: { min: 1, max: 100 }
      }]
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
      // policy type
      label: 'Type',
      name: 'type',
      type: 'String',
      writable: true,
      default: 'api',
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }, {
        name: 'stringEnum',
        definition: {
          values: ['api']
        }
      }]
    },
    {
      // policy is active
      label: 'Active',
      name: 'active',
      type: 'Boolean',
      writable: true,
      default: true,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }]
    },
    {
      // trace output
      label: 'Trace',
      name: 'trace',
      type: 'Boolean',
      writable: true,
      default: false,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }]
    },
    {
      // policy halts after applying the action
      label: 'Halt',
      name: 'halt',
      type: 'Boolean',
      writable: true,
      default: false,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }]
    },
    {
      // higher goes first
      label: 'Priority',
      name: 'priority',
      type: 'Number',
      writable: true,
      default: 0,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }, {
        name: 'number',
        definition: {
          allowNull: false,
          allowDecimal: false
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
      acl: acl.Inherit,
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
      label: 'Environment',
      name: 'environment',
      type: 'String',
      readable: true,
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
      // trigger match conditions.
      label: 'Condition',
      name: 'condition',
      type: 'String',
      writable: true,
      acl: acl.Inherit,
      default: 'and',
      validators: [{
        name: 'required'
      }, {
        name: 'stringEnum',
        definition: {
          values: ['and', 'or']
        }
      }]
    },
    {
      // method(s) that will trigger the policy
      label: 'Methods',
      name: 'methods',
      type: 'String',
      writable: true,
      lowercase: true,
      trim: true,
      array: true,
      minItems: 0,
      uniqueValues: true,
      acl: acl.Inherit,
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['get', 'patch', 'post', 'put', 'delete']
        }
      }]
    },
    {
      // paths that trigger the policy. applies to api requests
      label: 'Paths',
      name: 'paths',
      type: 'String',
      writable: true,
      canPush: false,
      canPull: false,
      array: true,
      uniqueValues: true,
      lowercase: true,
      acl: acl.Inherit,
      trim: true,
      dependencies: ['.regexps'],
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 1,
          max: 255
        }
      }, {
        name: 'adhoc',
        definition: {
          asArray: true,
          message: 'A valid route path',
          validator: function(ac, node, values) {
            this.regexp = pathToRegExp(values)
            return true
          }
        }
      }]
    },
    // generated by the paths property
    {
      label: 'regexp',
      name: 'regexp',
      type: 'Any',
      serializeData: false,
      reader: function() {
        return this.regexp ? this.regexp.toString() : Undefined
      }
    },
    {
      label: 'IP Whitelist',
      name: 'ipWhitelist',
      type: 'String',
      array: true,
      uniqueValues: true,
      maxItems: 50,
      maxShift: false,
      canPush: true,
      canPull: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'IPv4AddrOrCidr'
      }]
    },
    {
      label: 'IP Blacklist',
      name: 'ipBlacklist',
      type: 'String',
      array: true,
      uniqueValues: true,
      maxItems: 50,
      canPush: true,
      canPull: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'IPv4AddrOrCidr'
      }]
    },
    {
      label: 'Script',
      name: 'script',
      type: 'Any',
      serializeData: false,
      acl: acl.Inherit,
      writable: true,
      dependencies: ['.action'],
      reader: function(ac) {
        return ac.option('isExport') ? (this && this.script) : (this && this.script && this.script.script)
      },
      writer: function(ac, node, value) {
        if (value || system || rBool(pathTo(ac.org, 'configuration.scripting.enableApiPolicies'), config('sandbox.limits.enableApiPolicies'))) {
          return {
            script: value
          }
        }
        return Undefined
      },
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'Policy scripting is not available.',
          validator: function(ac) {
            return system || rBool(pathTo(ac.org, 'configuration.scripting.enableApiPolicies'), config('sandbox.limits.enableApiPolicies'))
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            const script = rString(value.script, '').trim()
            if (!script) {
              this.script = Undefined
              return callback()
            }
            transpiler.transpile(
              value.script,
              {
                filename: `Policy Script`,
                language: 'javascript',
                specification: 'es6'
              },
              (err, result) => {
                if (!err) {
                  this.script = {
                    script: value.script,
                    serviceAccounts: result.serviceAccounts,
                    requires: toArray(result.imports),
                    compiled: result.source,
                    compiledHash: result.scriptHash,
                    classes: result.classes
                  }
                }
                callback(err, true)
              }
            )
          }
        }
      }]
    },
    {
      label: 'Expression Pipeline Transformation',
      name: 'pipeline',
      type: 'Expression',
      pipeline: true,
      readAccess: acl.Inherit,
      writable: true,
      removable: true
    },
    {
      // trigger action.
      label: 'Action',
      name: 'action',
      type: 'String',
      writable: true,
      default: 'Deny',
      acl: acl.Inherit,
      dependencies: ['.redirectUrl', '.script'],
      writer: function(ac, node, value) {
        if (value === 'Redirect') {
          this.markModified('redirectUrl')
        } else if (value === 'Script') {
          this.markModified('script')
        } else if (value === 'Transform') {
          this.markModified('script')
        }
        return value
      },
      validators: [{
        name: 'required'
      }, {
        name: 'stringEnum',
        definition: {
          values: ['Allow', 'Deny', 'Redirect', 'Script', 'Transform', 'Pipeline']
        }
      }]
    },
    {
      label: 'Fault Code',
      name: 'faultCode',
      type: 'String',
      writable: true,
      acl: acl.Inherit,
      trim: true,
      default: 'cortex.accessDenied.policy',
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 1,
          max: 100
        }
      }]
    },
    {
      label: 'Fault Status Code',
      name: 'faultStatusCode',
      type: 'Number',
      acl: acl.Inherit,
      writable: true,
      default: 403,
      validators: [{
        name: 'numberEnum',
        definition: {
          values: [400, 401, 403, 404, 405, 410, 451, 501, 503]
        }
      }]
    },
    {
      label: 'Fault Reason',
      name: 'faultReason',
      type: 'String',
      acl: acl.Inherit,
      writable: true,
      trim: true,
      default: 'Access denied by policy.',
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 1,
          max: 100
        }
      }]
    },
    {
      label: 'Redirect URL',
      name: 'redirectUrl',
      type: 'String',
      default: '',
      acl: acl.Inherit,
      writable: true,
      trim: true,
      dependencies: ['.action'],
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 0,
          max: 100
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'When redirecting, a valid api path or https:// url must be defined',
          asArray: false,
          validator: function(ac, node, value) {
            if (this.action !== 'redirect' && !value) {
              return true
            }
            if (value[0] === '/') {
              return validUrl.isUri(modules.templates.apiUrl(ac.org.code, value))
            }
            return validUrl.isHttpsUri(value)
          }
        }
      }]
    },
    {
      label: 'Redirect',
      name: 'redirectStatusCode',
      type: 'Number',
      acl: acl.Inherit,
      default: 307,
      writable: true,
      validators: [{
        name: 'numberEnum',
        definition: {
          values: [301, 303, 307, 308]
        }
      }]
    },
    {
      label: 'Rate Limit',
      name: 'rateLimit',
      type: 'Boolean',
      writable: true,
      default: false,
      acl: acl.Inherit,
      validators: [{
        name: 'required'
      }]
    },
    {
      label: 'Rate Limit Elements',
      name: 'rateLimitElements',
      type: 'String',
      writable: true,
      default: ['ip'],
      acl: acl.Inherit,
      uniqueValues: true,
      array: true,
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['ip', 'app', 'principal']
        }
      }]
    },
    {
      label: 'Rate Limit Reason',
      name: 'rateLimitReason',
      type: 'String',
      acl: acl.Inherit,
      writable: true,
      trim: true,
      default: 'Too many requests.',
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 1,
          max: 100
        }
      }]
    },
    {
      label: 'rateLimitCount',
      name: 'rateLimitCount',
      type: 'Number',
      acl: acl.Inherit,
      writable: true,
      default: 300,
      validators: [{
        name: 'number',
        definition: {
          allowNull: false,
          min: 1
        }
      }]
    },
    {
      label: 'rateLimitWindow',
      name: 'rateLimitWindow',
      type: 'Number',
      acl: acl.Inherit,
      writable: true,
      default: 300,
      validators: [{
        name: 'number',
        definition: {
          allowNull: false,
          min: 1
        }
      }]
    },
    {
      label: 'If conditional',
      name: 'if',
      type: 'Expression',
      writable: true,
      removable: true
    }
  ]

  if (!system) {

    properties = [
      ...properties,
      {
        label: 'Deployment Identifiers',
        name: 'did',
        type: 'ObjectId',
        public: false,
        array: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System,
        canPush: true,
        writable: true,
        canPull: true
      },
      {
        label: 'App Whitelist',
        name: 'appWhitelist',
        type: 'ObjectId',
        writable: true,
        array: true,
        maxItems: 10,
        default: [],
        writer: function(ac, node, value) {
          return value.map(value => {
            const doc = ac.org.apps.find(app => equalIds(app._id, value) || app.name === value)
            return doc ? doc._id : value
          })
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'An existing app',
            asArray: false,
            validator: function(ac, node, value) {
              return !!findIdInArray(ac.org.apps, '_id', value)
            }
          }
        }]
      },
      {
        label: 'App Blacklist',
        name: 'appBlacklist',
        type: 'ObjectId',
        writable: true,
        array: true,
        maxItems: 10,
        default: [],
        writer: function(ac, node, value) {
          return value.map(value => {
            const doc = ac.org.apps.find(app => equalIds(app._id, value) || app.name === value)
            return doc ? doc._id : value
          })
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'An existing app',
            asArray: false,
            validator: function(ac, node, value) {
              return !!findIdInArray(ac.org.apps, '_id', value)
            }
          }
        }]
      },
      new AclDefinition({
        label: 'Acl Whitelist',
        name: 'aclWhitelist',
        type: 'Document',
        public: true,
        array: true,
        readable: true,
        writable: true,
        maxItems: 50,
        canPush: true,
        canPull: true,
        includeId: true,
        forCreate: true,
        withExpressions: true,
        default: []
      }),
      new AclDefinition({
        label: 'Acl Blacklist',
        name: 'aclBlacklist',
        type: 'Document',
        public: true,
        array: true,
        readable: true,
        writable: true,
        maxItems: 50,
        canPush: true,
        canPull: true,
        includeId: true,
        forCreate: true,
        withExpressions: true,
        default: []
      })
    ]
  }

  DocumentDefinition.call(this, extend({}, options, {
    uniqueKey: 'name',
    properties: properties
  }))
}
util.inherits(OrgPolicyDefinition, DocumentDefinition)

OrgPolicyDefinition.parseResources = function(org, policy) {

  const { compiledHash: scriptHash, requires = [], serviceAccounts = [] } = policy.script || {}

  return [{
    metadata: {
      runtime: false,
      policyId: policy._id,
      resource: `org.code(${org.code}).policies[]._id(${policy._id})`,
      scriptId: (['Transform', 'Script'].includes(policy.action)) ? policy._id : Undefined,
      scriptHash,
      requires,
      serviceAccounts
    },
    ..._.omit(policy, 'script'),
    type: 'policy'
  }]

}

OrgPolicyDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `policy.${doc && doc.name}`

  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!doc.name) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
      resource: ac.getResource(),
      path: `policy.${doc && doc.label}`
    })
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else {
    const def = await this.exportDefinition(ac, doc, resourceStream, resourcePath, options)
    return resourceStream.exportResource(sortKeys(def), resourcePath)
  }

}

OrgPolicyDefinition.prototype.exportDefinition = async function(ac, doc, resourceStream, resourcePath, options) {

  const def = _.pick(doc, [
    'label',
    'name',
    'type',
    'active',
    'trace',
    'halt',
    'priority',
    'environment',
    'weight',
    'condition',
    'action',
    'script',
    'pipeline',
    'faultCode',
    'faultStatusCode',
    'faultReason',
    'redirectURL',
    'redirectStatusCode',
    'rateLimit',
    'rateLimitReason',
    'rateLimitCount',
    'rateLimitWindow',
    'if',
    'pipeline'
  ])

  def.object = 'policy'
  def.methods = doc.methods.slice().sort()
  def.paths = doc.paths.slice().sort()
  def.ipWhitelist = doc.ipWhitelist.slice().sort()
  def.ipBlacklist = doc.ipBlacklist.slice().sort()
  def.rateLimitElements = doc.rateLimitElements.slice().sort()

  def.appWhitelist = (await Promise.all(doc.appWhitelist.map(async(id) => {
    return resourceStream.addMappedApp(ac, id, `${resourcePath}.appWhitelist`)
  }))).sort(naturalCmp)

  def.appBlacklist = (await Promise.all(doc.appBlacklist.map(async(id) => {
    return resourceStream.addMappedApp(ac, id, `${resourcePath}.appBlacklist`)
  }))).sort(naturalCmp)

  def.aclWhitelist = await this.findNode('aclWhitelist').export(ac, doc.aclWhitelist, resourceStream, resourcePath, { ...options, required: true })
  def.aclBlacklist = await this.findNode('aclBlacklist').export(ac, doc.aclBlacklist, resourceStream, resourcePath, { ...options, required: true })

  if (resourceStream.includeDependencies(resourcePath)) {

    // add script and service account dependencies to the manifest (but we don't need to store them)
    if (def.script) {

      await Promise.all(toArray(def.script.requires).map(async(scriptExport) => {
        return resourceStream.addMappedInstance(
          ac,
          'script',
          { type: 'library', 'configuration.export': scriptExport },
          `${resourcePath}.script`
        )
      }))

      await Promise.all(toArray(def.script.serviceAccounts).map(async(serviceAccount) => {
        return resourceStream.addMappedServiceAccount(ac, serviceAccount, `${resourcePath}.script`)
      }))

    }
  }

  if (def.script) {
    def.script = def.script.script
  }

  return def

}

OrgPolicyDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `policy.${doc && doc.name}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {

    return Undefined

  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {

    return Undefined

  } else {

    return resourceStream.updateEnvironment(async(ac) => {

      let existing = ac.org.policies.find(role => role.name && role.name === doc.name),
          def = await this.importDefinition(ac, doc, resourceStream, resourcePath, options)

      if (existing) {
        def._id = existing._id
        delete def.name
      }

      ac.method = existing ? 'put' : 'post'
      await promised(this, 'aclWrite', ac, ac.org, def)

      return ac.org.policies.find(policy => policy.name && policy.name === doc.name)

    })

  }

}

OrgPolicyDefinition.prototype.importDefinition = async function(ac, doc, resourceStream, resourcePath, options) {

  let def = _.pick(doc, [
    'label',
    'name',
    'type',
    'active',
    'trace',
    'halt',
    'priority',
    'environment',
    'weight',
    'condition',
    'action',
    'script',
    'faultCode',
    'faultStatusCode',
    'faultReason',
    'redirectURL',
    'redirectStatusCode',
    'rateLimit',
    'rateLimitReason',
    'rateLimitCount',
    'rateLimitWindow',
    'methods',
    'paths',
    'ipWhitelist',
    'ipBlacklist',
    'rateLimitElements',
    'if',
    'pipeline'
  ])

  if (isSet(doc.appWhitelist)) {
    def.appWhitelist = []
    for (const app of toArray(doc.appWhitelist, _.isString(doc.appWhitelist))) {
      def.appWhitelist.push(
        (await resourceStream.importMappedApp(ac, app, `${resourcePath}.appWhitelist`))._id
      )
    }
  }

  if (isSet(doc.appBlacklist)) {
    def.appBlacklist = []
    for (const app of toArray(doc.appBlacklist, _.isString(doc.appBlacklist))) {
      def.appBlacklist.push(
        (await resourceStream.importMappedApp(ac, app, `${resourcePath}.appBlacklist`))._id
      )
    }
  }

  if (isSet(doc.aclWhitelist)) {
    def.aclWhitelist = await this.findNode('aclWhitelist').import(ac, doc.aclWhitelist, resourceStream, resourcePath, { ...options, required: true })
  }

  if (isSet(doc.aclBlacklist)) {
    def.aclBlacklist = await this.findNode('aclBlacklist').import(ac, doc.aclBlacklist, resourceStream, resourcePath, { ...options, required: true })
  }

  return def

}

module.exports = OrgPolicyDefinition
