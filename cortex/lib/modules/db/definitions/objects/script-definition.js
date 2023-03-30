'use strict'

const Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      {
        array: toArray, sortKeys, equalIds,
        rInt, rString, path: pathTo, extend, isSet,
        isPlainObject, sleep, inIdArray,
        isId, joinPaths, promised, profile, rBool,
        encodeME, decodeME
      } = require('../../../../utils'),
      acl = require('../../../../acl'),
      ap = require('../../../../access-principal'),
      modules = require('../../../../modules'),
      Memo = require('../../../../classes/memo'),
      config = require('cortex-service/lib/config'),
      transpiler = modules.services.transpiler,
      { omit, pick, isString, uniq, groupBy } = require('underscore'),
      consts = require('../../../../consts'),
      { SystemVariableFactory } = require('../../../expressions/factory'),
      util = require('util'),
      { createHash } = require('crypto'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      DocumentDefinition = require('../types/document-definition')

let Undefined

function ScriptDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(ScriptDefinition, BuiltinContextModelDefinition)

ScriptDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ScriptDefinition.statics
  options.methods = ScriptDefinition.methods
  options.indexes = ScriptDefinition.indexes
  options.options = { collection: ScriptDefinition.collection }
  options.apiHooks = ScriptDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ScriptDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  BuiltinContextModelDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  // always select configuration and scriptHash (for update and delete hook);
  selections.scriptHash = true
  selections.configuration = true

}

ScriptDefinition.collection = 'contexts'

// -----------------------------------------------------------------------

ScriptDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `script.${doc.name}`

  if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else if (!doc.name) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
      resource: ac.getResource(),
      path: `script.${doc.label}`
    })
  } else {

    const def = await this.exportDefinition(ac, doc, resourceStream, resourcePath, options)

    return resourceStream.exportResource(sortKeys(def), resourcePath)

  }

}

ScriptDefinition.prototype.exportDefinition = async function(ac, doc, resourceStream, resourcePath, options) {

  const def = pick(doc, [
          'object',
          'active',
          'optimized',
          'label',
          'description',
          'language',
          'script',
          'type',
          'principal',
          'name',
          'weight',
          'if',
          'environment'
        ]),
        principalIdentifier = doc.principal,
        parseResources = rBool(options && options.parseResources, true),
        excludeDependencies = rBool(options && options.excludeDependencies, false),
        resources = doc.resources || (parseResources && await modules.sandbox.ScriptTypes.library.parseResources(ac, doc))

  def.principal = await resourceStream.addMappedPrincipal(ac, principalIdentifier, `${resourcePath}.principal`, { includeResourcePrefix: true })
  def.configuration = await this.getDefinitionForType(doc.type).findNode('configuration').export(ac, doc.configuration, resourceStream, resourcePath, { ...options, required: true })

  // add script and service account dependencies.
  if (!excludeDependencies && resourceStream.includeDependencies(resourcePath)) {

    await Promise.all(toArray(doc.serviceAccounts).map(async(serviceAccount) => {

      return resourceStream.addMappedServiceAccount(
        ac,
        serviceAccount,
        resourcePath
      )

    }))

    await Promise.all(toArray(doc.requires).map(async(scriptExport) => {

      return resourceStream.addMappedInstance(
        ac,
        'script',
        { type: 'library', 'configuration.export': scriptExport },
        resourcePath
      )

    }))

  }

  function exportRuntime(runtime, def, runtimePath) {
    const metadata = omit(runtime.metadata, 'scriptId')
    resourceStream.addPath(runtimePath, '', { required: true })
    resourceStream.exportResource(sortKeys({ ...def, metadata, object: 'runtime-resource' }), runtimePath, { excludeFromExports: true })
  }

  if (resources) {

    const { object: objects = [], job: jobs = [], trigger: triggers = [], route: routes = [], policy: policies = [], transform: transforms = [] } = groupBy(resources, resource => resource.type),
          policiesNode = ac.org.schema.node.properties.policies

    for (const policy of policies) {
      const runtimePath = `${resourcePath}.@policy(${policy.metadata.className}.${policy.metadata.propertyName || policy.metadata.methodName})`,
            def = await policiesNode.exportDefinition(
              ac,
              policy,
              resourceStream,
              runtimePath,
              options
            )
      exportRuntime(policy, def, runtimePath)
    }

    for (const object of objects) {
      const runtimePath = `${resourcePath}.@object(${object.metadata.className})`,
            def = await resourceStream.addMappedObject(
              ac,
              object.metadata.objectName,
              runtimePath
            )
      exportRuntime(object, def, runtimePath)
    }

    for (const script of transforms) {
      const runtimePath = `${resourcePath}.@${script.type}(${script.metadata.className})`,
            def = await this.getDefinitionForType('library').exportDefinition(
              ac,
              script,
              resourceStream,
              runtimePath,
              { ...options, required: true, excludeDependencies: true, parseResources: false })
      exportRuntime(script, def, runtimePath)
    }

    for (const scripts of [jobs, triggers, routes]) {
      for (const script of scripts) {
        if (script.metadata.runtime === true) {
          const runtimePath = `${resourcePath}.@${script.type}(${script.metadata.className}.${script.metadata.methodName})`,
                def = await this.getDefinitionForType(script.type).exportDefinition(
                  ac,
                  script,
                  resourceStream,
                  runtimePath,
                  { ...options, required: true, parseResources: false })
          exportRuntime(script, def, runtimePath)
        }
      }
    }
  }

  return def

}

ScriptDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `script.${doc && doc.name}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else {
    return this.importDefinition(ac, doc, resourceStream, resourcePath, options)
  }

}

ScriptDefinition.prototype.importDefinition = async function(ac, doc, resourceStream, resourcePath, options) {

  const def = pick(doc, [
          'active',
          'optimized',
          'label',
          'description',
          'language',
          'script',
          'principal',
          'environment',
          'weight',
          'if'
        ]),
        scriptModel = modules.db.models.script,
        isRuntime = rBool(options && options.isRuntime, false)

  let subject

  if (isSet(doc.principal)) {
    def.principal = (await resourceStream.importMappedPrincipal(ac, doc.principal, `${resourcePath}.principal`, { guessResourcePrefix: isRuntime }))._id
  }

  def.configuration = await this.getDefinitionForType(doc.type).findNode('configuration').import(ac, doc.configuration, resourceStream, resourcePath, { ...options, required: true })

  // before adding potentially circular dependencies, save new scripts. because scripts can create circular dependencies on other
  // scripts through "requires", wait until after the script is saved to import script import deps.
  //
  // however, runtime dependencies have to be resolved before the script is written. so, when including runtime dependencies,
  // transpile the script and pull out its runtime elements prior to saving to ensure they exist during save validation.

  if (!isRuntime) {

    subject = await promised(
      scriptModel,
      'aclReadOne',
      ac.principal,
      null,
      { req: ac.req, script: ac.script, allowNullSubject: true, throwNotFound: false, internalWhere: { name: doc.name }, paths: ['_id', 'name'] }
    )

    const languageParts = (def.language || 'javascript/es6').split('/'),
          transpileOptions = {
            filename: rString(def.label, '').replace(/[\s\t\n\r]/g, '_'),
            language: languageParts[0],
            specification: languageParts[1]
          },
          transpilerResult = await transpiler.transpile(def.script, transpileOptions),
          { serviceAccounts, imports: requires, source: compiled, scriptHash: compiledHash, classes } = transpilerResult,
          scriptType = modules.sandbox.ScriptTypes[doc.type]

    if (scriptType) {

      const resources = await scriptType.parseResources(
              ac,
              { ...doc, serviceAccounts, requires, compiled, compiledHash, classes },
              { includeSelf: false, writeAndValidate: false } // prevent the parser from validating runtime elements that may not yet exist.
            ),
            { object: objects = [], job: jobs = [], trigger: triggers = [], route: routes = [], policy: policies = [], transform: transforms = [] } = groupBy(resources, resource => resource.type),
            policiesNode = ac.org.schema.node.properties.policies

      for (const policy of policies) {
        await policiesNode.importDefinition(
          ac,
          policy,
          resourceStream,
          `${resourcePath}.@policy(${policy.metadata.className}.${policy.metadata.propertyName || policy.metadata.methodName})`,
          options
        )
      }

      for (const object of objects) {
        await resourceStream.importMappedObject(
          ac,
          object.metadata.objectName,
          `${resourcePath}.@object(${object.metadata.className})`
        )
      }

      for (const transform of transforms) {
        void transform
      }

      for (const scripts of [jobs, triggers, routes]) {
        for (const script of scripts) {
          await this.getDefinitionForType(script.type).importDefinition(
            ac,
            script,
            resourceStream,
            `${resourcePath}.@${script.type}(${script.metadata.className}.${script.metadata.methodName})`,
            { ...options, required: true, isRuntime: true })
        }
      }
    }
  }

  if (!isRuntime) {
    const writeOptions = {
      passive: true,
      method: subject ? 'put' : 'post',
      req: ac.req,
      mergeDocuments: true,
      script: ac.script,
      disableTriggers: resourceStream.disableTriggers,
      acOptions: {
        isImport: ac.option('isImport'),
        deferSyncEnvironment: ac.option('deferSyncEnvironment')
      }
    }
    if (subject) {
      def._id = subject._id
      subject = (await promised(scriptModel, 'aclUpdate', ac.principal, subject._id, def, writeOptions)).ac.subject
    } else {
      def.name = doc.name
      def.type = doc.type
      subject = (await promised(scriptModel, 'aclCreate', ac.principal, def, writeOptions)).ac.subject
    }
  }

  // import possibly circular dependencies. only do this when parsing a runtime.
  if (subject) {

    for (let serviceAccount of toArray(subject.serviceAccounts)) {
      await resourceStream.importMappedServiceAccount(ac, `serviceAccount.${serviceAccount}`, resourcePath)
    }

    for (let scriptExport of toArray(subject.requires)) {
      if (!(subject.type === 'library' && subject.configuration.export === scriptExport)) {
        await resourceStream.importMappedInstance(ac, 'script', { type: 'library', 'configuration.export': scriptExport }, resourcePath)
      }
    }

  }

  return subject
}

ScriptDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: false,
    hasOwner: false,
    _id: consts.NativeIds.script,
    objectLabel: 'Script',
    objectName: 'script',
    pluralName: 'scripts',
    collection: 'contexts',
    isExtensible: false,
    auditing: {
      enabled: true,
      all: true,
      category: 'configuration'
    },
    isFavoritable: false,
    isDeployable: true,
    uniqueKey: 'name',
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    requiredAclPaths: ['_id', 'org', 'type', 'active', 'principal', 'configuration', 'script', 'scriptHash', 'resources', 'classes'],
    defaultAcl: [
      { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Delete : acl.AccessLevels.Read) },
      { type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }
    ],
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: config('app.env') === 'development'
      ? [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }, { type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Min }]
      : [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Min }],
    shareChain: [],
    objectTypes: [
      {
        _id: consts.scripts.types.job,
        label: 'Job',
        name: 'job',
        properties: [{
          label: 'Configuration',
          name: 'configuration',
          type: 'Document',
          writable: true,
          properties: modules.sandbox.ScriptTypes.job.getTypeProperties(),
          export: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }
            const def = pick(doc, [
              'cron'
            ])
            return sortKeys(def)

          },
          import: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }
            return pick(doc, [
              'cron'
            ])

          }
        }]
      },
      {
        _id: consts.scripts.types.library,
        label: 'Library',
        name: 'library',
        properties: [{
          label: 'Configuration',
          name: 'configuration',
          type: 'Document',
          writable: true,
          properties: modules.sandbox.ScriptTypes.library.getTypeProperties(),
          export: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }
            const def = pick(doc, [
              'export'
            ])
            return sortKeys(def)

          },
          import: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)
            if (doc === Undefined) {
              return Undefined
            }
            return pick(doc, [
              'export'
            ])

          }

        }]
      },
      {
        _id: consts.scripts.types.route,
        label: 'Route',
        name: 'route',
        properties: [{
          label: 'Configuration',
          name: 'configuration',
          type: 'Document',
          writable: true,
          properties: modules.sandbox.ScriptTypes.route.getTypeProperties(),
          export: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }

            const resourcePath = joinPaths(parentPath, this.path),
                  def = pick(doc, [
                    'urlEncoded',
                    'plainText',
                    'apiKey',
                    'path',
                    'method',
                    'priority',
                    'acl',
                    'authValidation',
                    'system'
                  ])

            if (isSet(def.apiKey)) {
              def.apiKey = await resourceStream.addMappedApp(ac, def.apiKey, joinPaths(resourcePath, 'apiKey'))
            }

            return sortKeys(def)

          },
          import: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)
            if (doc === Undefined) {
              return Undefined
            }

            const resourcePath = joinPaths(parentPath, this.path),
                  def = pick(doc, [
                    'urlEncoded',
                    'plainText',
                    'apiKey',
                    'path',
                    'method',
                    'priority',
                    'acl',
                    'authValidation',
                    'system'
                  ])

            if (isSet(def.apiKey)) {
              def.apiKey = (await resourceStream.importMappedApp(ac, def.apiKey, joinPaths(resourcePath, 'apiKey')))._id
            }

            return def

          }

        }]
      },
      {
        _id: consts.scripts.types.trigger,
        label: 'Trigger',
        name: 'trigger',
        properties: [{
          label: 'Configuration',
          name: 'configuration',
          type: 'Document',
          writable: true,
          properties: modules.sandbox.ScriptTypes.trigger.getTypeProperties(),
          export: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }

            const resourcePath = joinPaths(parentPath, this.path),
                  def = pick(doc, [
                    'inline',
                    'event',
                    'object',
                    'paths'
                  ])

            if (isSet(def.object)) {
              if (!['*', 'system'].includes(def.object)) {
                def.object = await resourceStream.addMappedObject(ac, def.object, joinPaths(resourcePath, 'object'))
              }
            }

            return sortKeys(def)

          },
          import: async function(ac, doc, resourceStream, parentPath, options) {

            doc = await DocumentDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)

            if (doc === Undefined) {
              return Undefined
            }

            const resourcePath = joinPaths(parentPath, this.path),
                  def = pick(doc, [
                    'inline',
                    'event',
                    'object',
                    'paths'
                  ])

            if (isSet(def.object)) {
              if (!['*', 'system'].includes(def.object)) {
                def.object = (await resourceStream.importMappedObject(ac, def.object, joinPaths(resourcePath, 'object'))).name
              }
            }

            return sortKeys(def)

          }
        }]
      }
    ],
    properties: [
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        readable: true,
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
        // description: 'The script description',
        readable: true,
        writable: true,
        trim: true,
        nativeIndex: true,
        validators: [{
          name: 'printableString',
          definition: {
            min: 0,
            max: 512
          }
        }]
      },
      {
        label: 'Script Name',
        name: 'name',
        type: 'String',
        readable: true,
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
            message: 'A unique script name',
            validator: function(ac, node, v, callback) {
              this.constructor.findOne({ org: this.org, object: 'script', name: v }).lean().select('_id').exec(function(err, doc) {
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
        readable: true,
        writable: true,
        default: true
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
        label: 'Run Optimized',
        name: 'optimized',
        type: 'Boolean',
        readable: true,
        writable: true,
        default: false,
        dependencies: ['bytecode', 'bytecodeVersion', 'script'],
        writer: function(ac, node, value) {
          if (value !== this.optimized || this.isNew) {
            if (value) {
              this.markModified('bytecode')
            } else {
              this.bytecode = Undefined
              this.bytecodeVersion = Undefined
            }
          }
          return value
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'Please contact support to enable optimized scripts.',
            validator: function(ac, node, value) {
              return (!value || ac.org.configuration.scripting.allowBytecodeExecution)
            }
          }
        }]
      },
      {
        label: 'Language',
        name: 'language',
        type: 'String',
        readable: true,
        writable: true,
        default: 'javascript/es6',
        dependencies: ['script'],
        writer: function(ac, node, value) {
          if (value !== this.language) {
            this.markModified('script')
          }
          return value
        },
        validators: [{
          name: 'stringEnum',
          definition: {
            values: ['javascript/es6']
          }
        }]
      },
      {
        label: 'Unique Script Hash',
        name: 'scriptHash',
        type: 'String',
        readable: false,
        writable: false
      },
      {
        label: 'Principal',
        name: 'principal',
        type: 'ObjectId',
        default: null,
        writable: true,
        writer: function(ac, node, value, options, callback) {
          if (value === null) {
            return callback(null, value)
          }
          ap.create(ac.org, value, (err, principal) => {
            if (!err) {
              value = principal._id
            }
            callback(null, value)
          })
        },
        validators: [{
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {
              if (value === null || value === undefined) {
                return callback()
              }
              // account principal?
              if (equalIds(value, acl.AnonymousIdentifier) || equalIds(value, acl.PublicIdentifier)) {
                return callback()
              }
              ap.create(ac.org, value, (err, principal) => {
                if (!err && principal && principal.role) {
                  err = Fault.validationError('cortex.invalidArgument.unspecified', { reason: 'Script principal cannot be a role.' })
                } else if (err && err.code === 'kNotFound') {
                  err = Fault.validationError('cortex.notFound.principal', { reason: 'Script principal account not found.' })
                }
                callback(err)

              })

            }
          }
        }]
      }, {
        label: 'Script',
        name: 'script',
        type: 'String',
        // description: 'The script code',
        readable: true,
        writable: true,
        trim: true,
        deferWrites: true, // ensure we know the optimized value.
        set: function(script) {
          if (this.isNew || script !== this.script) {
            if (this.optimized) {
              this.markModified('bytecode')
            } else {
              this.bytecode = Undefined
              this.bytecodeVersion = Undefined
            }
          }
          return script
        },
        dependencies: [
          'resources', 'configuration', 'requires', 'serviceAccounts', 'optimized', 'compiled', 'compiledHash', 'classes', 'bytecode', 'bytecodeVersion', 'language', 'label', 'type', 'principal',
          'active', 'label', 'name'
        ],
        validators: [{
          name: 'required'
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, source) {
              let maxLen = rInt(ac.org.configuration.scripting.maxScriptSize, 1024 * 50)
              if (!isString(source) || source.length > maxLen) {
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

              const languageParts = (this.language || 'javascript/es6').split('/'),
                    transpileOptions = {
                      filename: rString(this.label, '').replace(/[\s\t\n\r]/g, '_'),
                      language: languageParts[0],
                      specification: languageParts[1]
                    }

              transpiler.transpile(source, transpileOptions, (err, result) => {

                if (err) {
                  return callback(err)
                }

                this.serviceAccounts = result.serviceAccounts
                this.requires = toArray(result.imports)
                this.compiled = result.source
                this.compiledHash = result.scriptHash
                this.classes = result.classes

                this.updateBytecode(ac, err => {
                  callback(err, true)
                })

              })
            }
          }
        }]
      },
      {
        label: 'Compiled',
        name: 'compiled',
        type: 'String',
        readable: true,
        readAccess: acl.AccessLevels.System,
        writable: false
      },
      {
        label: 'Compiled Hash',
        name: 'compiledHash',
        type: 'String',
        readable: true,
        readAccess: acl.AccessLevels.System,
        writable: false
      },
      {
        label: 'Classes',
        name: 'classes',
        type: 'Any',
        readable: true,
        writable: false,
        serializeData: false,
        set: function(v) { return encodeME(v) },
        get: function(v) { return decodeME(v) }
      },
      {
        label: 'Bytecode',
        name: 'bytecode',
        type: 'Binary',
        readable: true,
        readAccess: acl.AccessLevels.System,
        writable: false,
        dependencies: ['optimized', 'compiled', 'bytecodeVersion', 'type'],
        validators: [{
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              void value

              // if the script was edited, it will compile from its own validator.
              // we cannot guarantee the order of validation.
              // this is how we ensure we always have the latest bytecode
              if (this.isModified('script')) {
                return callback(null, true)
              }

              this.updateBytecode(ac, callback)

            }
          }
        }]
      },
      {
        label: 'Bytecode Version',
        name: 'bytecodeVersion',
        type: 'String',
        readable: true,
        readAccess: acl.AccessLevels.System,
        writable: false
      },
      // library scripts imported by the script.
      {
        label: 'Requires',
        name: 'requires',
        type: 'String',
        array: true
      },
      // services accounts used by the script ( script.as() )
      {
        label: 'Service Accounts',
        name: 'serviceAccounts',
        type: 'String',
        array: true
      },
      {
        label: 'If conditional',
        name: 'if',
        type: 'Expression',
        writable: true,
        removable: true
      },
      {
        // always marked as modified
        label: 'Runtime Resources',
        name: 'resources',
        type: 'Any',
        serializeData: false,
        readable: true,
        set: function(v) { return encodeME(v, '$$decodedResources', this) },
        get: function(v) { return decodeME(v, '$$decodedResources', this) },
        dependencies: [
          'configuration', 'requires', 'serviceAccounts', 'optimized', 'compiled', 'compiledHash', 'classes', 'bytecode', 'bytecodeVersion', 'language', 'label', 'type', 'principal', 'active', 'label', 'name', 'environment', 'weight'
        ],
        validators: [{
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              // don't pollute the resource with 'resources'
              const resource = ac.popResource(),
                    type = modules.sandbox.ScriptTypes[this.type]

              type.parseResources(ac, this)
                .then(resources => {
                  this.resources = resources
                  ac.pushResource(resource)
                  callback()
                })
                .catch(err => {
                  ac.pushResource(resource)
                  callback(err)
                })
            }
          }
        }]
      }]
  }

}

// shared methods --------------------------------------------------------

ScriptDefinition.methods = {

  /**
     * @param ac
     * @param inputScriptOptions
     * @param runtimeArguments
     *      these get merged into the script env arguments objects.
     * @returns {*}
     */
  createOptions: async function(ac, inputScriptOptions, runtimeArguments) {

    inputScriptOptions = inputScriptOptions || {}
    runtimeArguments = runtimeArguments || {}

    let isInline = false

    const runtimeContext = inputScriptOptions.runtimeContext || this.runtimeContext,
          scriptId = (runtimeContext && runtimeContext.metadata.scriptId) || this._id,
          { type: scriptType, label: scriptLabel, configuration: runtimeConfiguration = {} } = runtimeContext || this,
          { source, format } = modules.sandbox.getExecutableSource(ac, this, { runtime: runtimeContext }),
          req = ac.req || {},
          scriptOptions = extend(inputScriptOptions || {}, {
            source,
            format
          }),
          { runtime } = inputScriptOptions

    scriptOptions.configuration = {
      _id: scriptId,
      type: scriptType,
      org: {
        _id: ac.orgId,
        code: ac.org ? ac.org.code : '',
        object: 'org'
      },
      apis: {},
      limits: ac.org.configuration.scripting.toObject(),
      maxOps: pathTo(ac.org, `configuration.scripting.types.${scriptType}.maxOps`),
      timeoutMs: pathTo(ac.org, `configuration.scripting.types.${scriptType}.timeoutMs`),
      filename: rString(scriptLabel, '').replace(/[\s\t\n\r]/g, '_'),
      includes: scriptOptions.includes || {},
      locale: scriptOptions.parentScript ? scriptOptions.parentScript.locale : ac.getLocale()
    }

    // adjust timeout is a parent script is running.
    if (scriptOptions.parentScript) {
      scriptOptions.configuration.timeoutMs = Math.max(0, Math.min(scriptOptions.configuration.timeoutMs, scriptOptions.parentScript.timeLeft))
    }

    delete scriptOptions.includes

    scriptOptions.environment = {

      runtime: {
        objects: toArray(pathTo(ac.org, 'runtime.objects')),
        context: runtimeContext
      },

      script: await modules.sandbox.getEnvironmentScript(ac, { _id: scriptId, type: scriptType, label: scriptLabel }, { runtime, parentScript: scriptOptions.parentScript, runtimeArguments }),

      session: {
        exists: !!pathTo(ac, 'req.session')
      },

      request: SystemVariableFactory.get('REQUEST').toObject(req),

      consts: {
        emptyId: consts.emptyId,
        connectionStates: consts.connectionStates,
        accountStates: consts.accountStates,
        objects: ac.org.objects.reduce(
          (objects, object) => {
            objects[object.pluralName] = object.lookup
            return objects
          },
          {
            posts: consts.NativeObjects.post,
            comments: consts.NativeObjects.comment,
            connections: consts.NativeObjects.connection,
            accounts: consts.NativeIds.account,
            orgs: consts.NativeIds.org,
            scripts: consts.NativeIds.script,
            objects: consts.NativeIds.object,
            views: consts.NativeIds.view,
            exports: consts.NativeIds.export
          }
        ),
        audits: consts.audits,
        logs: consts.logs,
        stats: consts.stats,
        media: consts.media,
        http: consts.http,
        accessTargets: {
          account: 1,
          role: 3
        },
        accessPrincipals: {
          self: 2,
          creator: 3,
          owner: 4
        },
        accessLevels: {
          public: 1,
          connected: 2,
          read: 4,
          share: 5,
          update: 6,
          delete: 7,
          script: 8
        },
        accessTypes: {
          account: acl.EntryTypes.Account,
          self: acl.EntryTypes.Self,
          role: acl.EntryTypes.Role,
          owner: acl.EntryTypes.Owner,
          access: acl.EntryTypes.Access
        },
        events: {
          states: consts.events.states,
          retention: consts.events.retention
        },
        roles: extend(
          ac.org.roles.reduce(
            (roles, role) => {
              if (role.code) {
                roles[role.code] = role._id
              }
              return roles
            },
            {}
          ),
          ac.org.roles.reduce(
            (roles, role) => {
              roles[role.name] = role._id
              return roles
            },
            {}
          ),
          consts.roles
        ),
        serviceAccounts: ac.org.serviceAccounts.reduce(
          (serviceAccounts, serviceAccount) => {
            if (serviceAccount.name) {
              serviceAccounts[serviceAccount.name] = serviceAccount._id
            }
            return serviceAccounts
          },
          {}
        ),
        principals: consts.principals,
        notifications: {
          endpoints: {
            email: consts.Notifications.Endpoints.Email._id,
            sms: consts.Notifications.Endpoints.Sms._id,
            push: consts.Notifications.Endpoints.Push._id
          },
          states: {
            enabled: 0,
            disabled: 1,
            user: 2
          },
          types: extend(
            Object.keys(consts.Notifications.Types).reduce(
              (notifications, key) => {
                const type = consts.Notifications.Types[key]
                notifications[type.name] = type._id
                return notifications
              },
              {}
            ),
            ac.org.configuration.notifications.reduce(
              (notifications, notification) => {
                if (notification.name) {
                  notifications[notification.name] = notification._id
                }
                return notifications
              },
              {}
            )
          )
        }
      }
    }
    if (ac.org.configuration.legacyObjects) {
      scriptOptions.environment.consts.objects.patientfiles = consts.NativeIds.patientfile
      scriptOptions.environment.consts.objects.conversations = consts.NativeIds.conversation
    }

    // in runtime contexts, use a request body that can be updated, but only in routes and policies, or when explicit.
    if (runtimeContext) {

      const readOnlyApi = !(['route', 'policy'].includes(runtimeContext.type) || scriptOptions.addBodyApi),
            data = scriptOptions.requestBody || req.body,
            memo = new Memo({
              data,
              additiveSize: true,
              initialSize: null,
              readOnlyApi
            })
      scriptOptions.api = extend(scriptOptions.api, {
        body: memo.getScriptApi()
      })
    } else {
      scriptOptions.environment.request.body = scriptOptions.requestBody || req.body
    }

    // dynamic script api
    if (isPlainObject(scriptOptions.api)) {
      scriptOptions.configuration.apis.script = modules.sandbox.createRemoteApi(scriptOptions.api)
    }

    if (config('__is_mocha_test__')) {

      scriptOptions.environment.consts.mocha = require('clone')(config('sandbox.mocha') || {})

      const server = require('../../../../../test/lib/server')
      scriptOptions.environment.consts.mocha.principals = Object.keys(server.principals).reduce((principals, name) => {
        principals[name] = server.principals[name].toObject()
        return principals
      }, {})

      scriptOptions.environment.consts.mocha.__mocha_test_uuid__ = server.__mocha_test_uuid__
      scriptOptions.environment.consts.mocha.payload = server._current_script_payload || {}
      scriptOptions.environment.consts.mocha.org = server.org.toObject()

    }

    delete scriptOptions.requestBody

    if (scriptOptions.parentScript) {
      let child = scriptOptions.environment.script,
          parent = scriptOptions.parentScript
      while (parent) {
        const parentScriptEnv = parent.environment.script
        if (!parentScriptEnv) break
        child.parent = {
          _id: parentScriptEnv._id,
          depth: parentScriptEnv.depth,
          type: parentScriptEnv.type,
          label: parentScriptEnv.label,
          arguments: parentScriptEnv.arguments
        }
        if (parent.lastTrace) {
          child.trace = parent.lastTrace
        }
        child = child.parent
        parent = parent.parent
      }
    }

    if (config('__is_mocha_test__')) {
      let server = require('../../../../../test/lib/server')
      scriptOptions.environment.script.__mocha_test_uuid__ = server.__mocha_test_uuid__
      scriptOptions.environment.script.mochaCurrentTestUuid = server.mochaCurrentTestUuid
      scriptOptions.environment.script.__mocha_app_key__ = server.sessionsClient.key
      scriptOptions.environment.script.__mocha_principals__ = {}
      Object.keys(server.principals).forEach(name => {
        let p = server.principals[name]
        scriptOptions.environment.script.__mocha_principals__[name] = {
          _id: p._id,
          roles: p.roles,
          email: p.email,
          name: p.name
        }
      })
    }

    // if there is an attached subject, the sandbox script runtime module will augment context/arguments.new with updater methods.
    scriptOptions.configuration.hasAttachedSubject = acl.isAnySubject(scriptOptions.attachedSubject)
    if (scriptOptions.context) { // forced context?
      scriptOptions.environment.script.context = scriptOptions.context
    } else if (scriptOptions.configuration.hasAttachedSubject) {
      scriptOptions.environment.script.context = pathTo(scriptOptions.environment.script, 'arguments.new') || {
        _id: scriptOptions.attachedSubject._id,
        object: scriptOptions.attachedSubject.object,
        version: scriptOptions.attachedSubject.version
      }
    }

    // add script info for triggers and @other types
    if (scriptType === 'trigger') {
      const event = runtimeConfiguration.event,
            isBefore = event.indexOf('.before') === event.length - 7
      scriptOptions.environment.script.event = event
      isInline = scriptOptions.environment.script.inline = isBefore ? true : !!runtimeConfiguration.inline
    }
    scriptOptions.configuration.isInline = isInline

    // if the script principal has been changed from the runtime.
    if (isId(ac.option('originalPrincipal'))) {
      scriptOptions.environment.script.originalPrincipal = {
        _id: ac.option('originalPrincipal')
      }
    }

    return scriptOptions

  },

  updateBytecode: function(ac, callback) {

    if (!this.optimized) {
      this.bytecode = Undefined
      this.bytecodeVersion = Undefined
      return callback(null, true)
    }

    modules.sandbox.compile(
      ac,
      this.type,
      this.type === 'library' ? this.configuration.export : rString(this.label, '').replace(/[\s\t\n\r]/g, '_'),
      modules.sandbox.wrapForExecution(this),
      (err, result) => {
        if (!err && result) {
          this.bytecode = result.bytecode
          this.bytecodeVersion = result.version
        }
        callback(err, true)
      }
    )

  }

}

// shared statics --------------------------------------------------------

ScriptDefinition.statics = {

  aclInit: function() {

    modules.db.models.Object.hook('delete').before((vars, callback) => {

      const objectName = vars.ac.subject.name,
            $or = [
              { 'configuration.object': objectName },
              { 'resources.configuration.object': objectName },
              { 'resources.metadata.objectName': objectName }
            ]

      this.find({ org: vars.ac.orgId, object: 'script', reap: false, $or }).select('_id object type name configuration resources').lean().exec()
        .then(docs => {

          const resources = uniq(
            docs
              .reduce((resources, doc) => resources.concat(Array.isArray(doc.resources) ? doc.resources : [doc]), [])
              .filter(resource => [ pathTo(resource, 'configuration.object'), pathTo(resource, 'metadata.objectName') ].includes(objectName))
              .map(resource => pathTo(resource, 'metadata.resource') || this.getModelForType(resource.type).schema.node.getResourcePath(vars.ac, resource))
          )

          if (resources.length > 0) {
            if (config('debug.skipInUseTriggers')) {
              return logger.warn('deleting in-use resource', { resource: vars.ac.getResource(), resources })
            }
            throw Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This object definition is in use by the following resources(s): ' + resources.sort() })
          }

        })
        .then(v => callback(null, v))
        .catch(callback)

    })

    modules.db.models.Script.hook('delete').before((vars, callback) => {

      const subjectId = vars.ac.subject._id,
            scriptExport = pathTo(vars.ac.subject, 'configuration.export'),
            $or = [
              { 'requires': scriptExport },
              { 'resources.metadata.requires': scriptExport }
            ]

      if (!scriptExport) {
        return callback()
      }

      this.find({ org: vars.ac.orgId, object: 'script', reap: false, $or, _id: { $ne: subjectId } }).select('_id object type name requires resources').lean().exec()
        .then(docs => {

          const resources = uniq(
            docs
              .reduce((resources, doc) => resources.concat(Array.isArray(doc.resources) ? doc.resources : [doc]), [])
              .filter(resource => [...toArray(resource.requires), ...toArray(pathTo(resource, 'metadata.requires'))].includes(scriptExport))
              .map(resource => pathTo(resource, 'metadata.resource') || this.getModelForType(resource.type).schema.node.getResourcePath(vars.ac, resource))
          )

          if (resources.length > 0) {
            if (config('debug.skipInUseTriggers')) {
              return logger.warn('deleting in-use resource', { resource: vars.ac.getResource(), resources })
            }
            throw Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This script is in use by the following resources(s): ' + resources.sort() })
          }

        })
        .then(v => callback(null, v))
        .catch(callback)

    })

    modules.db.models.Org.hook('role.removed').before((vars, callback) => {

      const { roleId } = vars,
            $or = [
              { 'principal': roleId }, // route, job, trigger
              { 'configuration.acl.target': roleId }, // route
              { 'configuration.acl.allow': roleId }, // route
              { 'resources.principal': roleId }, // @route, @job, @trigger, @transform
              { 'resources.configuration.acl.target': roleId }, // @route
              { 'resources.configuration.acl.allow': roleId }, // @route
              { 'resources.aclWhitelist.target': roleId }, // @policy
              { 'resources.aclWhitelist.allow': roleId }, // @policy
              { 'resources.aclBlacklist.target': roleId }, // @policy
              { 'resources.aclBlacklist.allow': roleId } // @policy
            ]

      this.find({ org: vars.ac.orgId, object: 'script', reap: false, $or }).select('_id object type name principal aclWhitelist aclBlacklist configuration resources').lean().exec()
        .then(docs => {

          const resources = uniq(
            docs
              .reduce((resources, doc) => resources.concat(Array.isArray(doc.resources) ? doc.resources : [doc]), [])
              .filter(resource => {
                const targets = [
                  ...toArray(pathTo(resource, 'configuration.acl')).reduce((targets, { target, allow }) => targets.concat(target, allow), []),
                  ...toArray(resource.aclWhitelist).reduce((targets, { target, allow }) => targets.concat(target, allow), []),
                  ...toArray(resource.aclBlacklist).reduce((targets, { target, allow }) => targets.concat(target, allow), [])
                ]
                return equalIds(resource.principal, roleId) || targets.find(id => equalIds(id, roleId))
              })
              .map(resource => pathTo(resource, 'metadata.resource') || this.getModelForType(resource.type).schema.node.getResourcePath(vars.ac, resource))
          )

          if (resources.length > 0) {
            if (config('debug.skipInUseTriggers')) {
              return logger.warn('deleting in-use resource', { resource: vars.ac.getResource(), resources })
            }
            throw Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This role is in use by the following resources(s): ' + resources.sort() })
          }

        })
        .then(v => callback(null, v))
        .catch(callback)

    })

    modules.db.models.Org.hook('serviceAccount.removed').before((vars, callback) => {

      const { serviceAccountId, serviceAccount: { name: serviceAccountName } } = vars,
            $or = [
              { 'principal': serviceAccountId },
              { 'serviceAccounts': serviceAccountName },
              { 'resources.principal': serviceAccountId },
              { 'resources.metadata.serviceAccounts': serviceAccountId }
            ]

      this.find({ org: vars.ac.orgId, object: 'script', reap: false, $or }).select('_id object type name principal serviceAccounts resources').lean().exec()
        .then(docs => {

          const resources = uniq(
            docs
              .reduce((resources, doc) => resources.concat(Array.isArray(doc.resources) ? doc.resources : [doc]), [])
              .filter(resource => [...toArray(resource.serviceAccounts), ...toArray(pathTo(resource, 'metadata.serviceAccounts'))].includes(serviceAccountName) || equalIds(resource.principal, serviceAccountId))
              .map(resource => pathTo(resource, 'metadata.resource') || this.getModelForType(resource.type).schema.node.getResourcePath(vars.ac, resource))
          )

          if (resources.length > 0) {
            if (config('debug.skipInUseTriggers')) {
              return logger.warn('deleting in-use resource', { resource: vars.ac.getResource(), resources })
            }
            throw Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This service account is in use by the following resources(s): ' + resources.sort() })
          }

        })
        .then(v => callback(null, v))
        .catch(callback)

    })

    modules.db.models.Org.hook('app.removed').before((vars, callback) => {

      const { appId } = vars,
            $or = [
              { 'configuration.apiKey': appId }, // route
              { 'resources.configuration.apiKey': appId }, // @route
              { 'resources.appWhitelist': appId }, // @policy
              { 'resources.appBlacklist': appId } // @policy
            ]

      this.find({ org: vars.ac.orgId, object: 'script', reap: false, $or }).select('_id object type name configuration resources').lean().exec()
        .then(docs => {

          const resources = uniq(
            docs
              .reduce((resources, doc) => resources.concat(Array.isArray(doc.resources) ? doc.resources : [doc]), [])
              .filter(resource => equalIds(pathTo(resource, 'configuration.apiKey'), appId) || inIdArray(resource.appWhitelist, appId) || inIdArray(resource.appBlacklist, appId))
              .map(resource => pathTo(resource, 'metadata.resource') || this.getModelForType(resource.type).schema.node.getResourcePath(vars.ac, resource))
          )

          if (resources.length > 0) {
            if (config('debug.skipInUseTriggers')) {
              return logger.warn('deleting in-use resource', { resource: vars.ac.getResource(), resources })
            }
            throw Fault.create('cortex.accessDenied.inUse', { resource: vars.ac.getResource(), reason: 'This app is in use by the following resources(s): ' + resources.sort() })
          }

        })
        .then(v => callback(null, v))
        .catch(callback)

    })

  },

  async buildRuntime(ac, { reparseResources = false } = {}) {

    if (reparseResources) {

      const { ScriptTypes } = modules.sandbox,
            { Script } = modules.db.models,
            { principal } = ac,
            cursor = await promised(Script, 'aclCursor', principal, { paths: ['_id'], skipAcl: true, grant: acl.AccessLevels.Read })

      while (await promised(cursor, 'hasNext')) {

        const { _id } = await promised(cursor, 'next')

        await promised(modules.db, 'sequencedFunction', callback => {

          Promise.resolve(null)
            .then(async() => {

              const script = await promised(Script, 'aclLoad', principal, { where: { _id }, forceSingle: true, json: false, skipAcl: true, grant: acl.AccessLevels.Read }),
                    ac = new acl.AccessContext(principal, script),
                    resource = ac.replaceResource(this.getModelForType(script.type).schema.node.getResourcePath(ac, script)),
                    languageParts = (script.language || 'javascript/es6').split('/'),
                    transpileOptions = {
                      filename: rString(script.label, '').replace(/[\s\t\n\r]/g, '_'),
                      language: languageParts[0],
                      specification: languageParts[1]
                    }

              try {

                const result = await transpiler.transpile(script.script, transpileOptions)

                script.serviceAccounts = result.serviceAccounts
                script.requires = toArray(result.imports)
                script.compiledHash = result.scriptHash
                script.classes = result.classes
                script.compiled = result.source
                script.resources = await ScriptTypes[script.type].parseResources(ac, script)

                await promised(ac, 'lowLevelUpdate')
              } finally {
                ac.replaceResource(resource)
              }

            })
            .then(v => callback(null, v))
            .catch(e => callback(e))

        }, 10)

      }

    }

    // read all scripts and transpiled code where the hashes are missing. the runtime stored the hashes to conserve memory
    // and scripts will be loaded as needed from a universal cortex.scripts.cache
    const start = profile.start(),
          { ScriptTypes } = modules.sandbox,
          { Script } = modules.db.models,
          Definitions = modules.db.definitions,
          $project = {
            _id: 1,
            org: 1,
            acl: 1,
            object: 1,
            type: 1,
            sequence: 1,
            active: 1,
            language: 1,
            label: 1,
            principal: 1,
            name: 1,
            optimized: 1,
            resources: 1,
            classes: 1,
            configuration: 1,
            requires: 1,
            serviceAccounts: 1,
            environment: 1,
            weight: 1,
            compiledHash: 1,
            compiled: { $cond: [
              { $eq: [ { $ifNull: ['$compiledHash', true] }, true ] },
              '$compiled', null
            ] },
            script: { $cond: [
              { $eq: [ { $ifNull: ['$classes', true] }, true ] },
              '$script', null
            ] }
          },
          raw = await Script.collection.aggregate([{
            $match: {
              org: ac.orgId,
              object: 'script',
              reap: false,
              active: true,
              $or: [{
                environment: { $exists: false }
              }, {
                environment: { $in: ['*', config('app.env')] }
              }]
            }
          }, {
            $project
          }], { cursor: {} }).toArray(),
          selections = Object.keys($project).reduce((selections, field) => ({ ...selections, [field]: 1 }), {}),
          documents = raw.map(raw => Definitions.makeLightweightSubject(raw, Script.getModelForType(raw.type), selections)),
          result = await promised(
            Script,
            'aclList',
            ac.principal,
            {
              skipAcl: true,
              grant: acl.AccessLevels.System,
              documents
            }
          ),
          scripts = result.data,
          runtime = {
            objects: [],
            libraries: [],
            triggers: [],
            jobs: [],
            routes: [],
            transforms: [],
            envs: [],
            events: [],
            expressions: [],
            pipelines: []
          }

    for (const script of scripts) {

      // fill in missing hashes and dump the scripts, waiting for a cycle to allow other processes to run.
      if (!script.classes || (!script.compiledHash && !script.compiled)) {

        const languageParts = (script.language || 'javascript/es6').split('/'),
              transpileOptions = {
                filename: rString(script.label, '').replace(/[\s\t\n\r]/g, '_'),
                language: languageParts[0],
                specification: languageParts[1]
              },
              result = await transpiler.transpile(script.script, transpileOptions)

        script.serviceAccounts = result.serviceAccounts
        script.requires = toArray(result.imports)
        script.compiledHash = result.scriptHash
        script.classes = result.classes
        delete script.script
        delete script.compiled

      } else if (!script.compiledHash) {

        script.compiledHash = createHash('sha256').update(script.compiled).digest('hex')
        delete script.compiled
        await sleep(0)

      }

      // re-parse missing resources properties and re-save. note that libraries are runtime aware for static decorators as
      // of 2.13.0 so re-parsing results aren't necessary, only the exports (which are in the script configuration).
      if (!script.resources) {
        const resource = ac.replaceResource(this.getModelForType(script.type).schema.node.getResourcePath(ac, script))
        try {
          script.resources = await ScriptTypes[script.type].parseResources(ac, script)
        } finally {
          ac.replaceResource(resource)
        }
      }
    }

    for (const ScriptType of Object.values(ScriptTypes)) {
      await ScriptType.buildRuntime(ac, runtime, scripts)
    }

    profile.end(start, 'Script.buildRuntime')

    return { runtime, scripts }

  }

}

// indexes ---------------------------------------------------------------

ScriptDefinition.indexes = [

  [{ org: 1, object: 1, type: 1, scriptHash: 1 }, { unique: true, name: 'idxUniqueScript', partialFilterExpression: { scriptHash: { $exists: true } } }]

]

ScriptDefinition.apiHooks = [{
  name: 'create',
  after: function(vars, callback) {

    vars.ac.org.syncEnvironment(vars.ac)
      .catch(err => {
        void err
      })
      .then(() => callback())
  }
}, {
  name: 'validate',
  before: function(vars, callback) {
    vars.ac.subject.resetModifiedPaths()
    vars.ac.subject.markModified('resources')
    callback()
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
    // unset unique hashes.
    const subject = vars.ac.subject
    pathTo(subject, 'scriptHash', undefined)
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

module.exports = ScriptDefinition
