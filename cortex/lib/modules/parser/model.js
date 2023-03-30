'use strict'

const _ = require('underscore'),
      utils = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../acl'),
      DocumentDefinition = require('../db/definitions/types/document-definition'),
      ContextModelDefinition = require('../db/definitions/context-model-definition')

/**
 *  A parser model might have typing information, but not after a
 */

class ParserDefinition extends ContextModelDefinition {

  constructor(stage, options) {

    super(utils.extend({}, options, {

    }))

    this.stage = stage
  }

  aclRead(ac, document, selection, callback) {

    // sometimes, we cannot throw out the selection, like when the caller is a list that's reading input variables.
    if (!selection.getOption('important')) {
      // throw out the selections and use what we've grouped in expressions.
      const build = this.stage.value.build(),
            paths = utils.flattenObjectPaths(build, true, true)
      if (this.stage.type === '$group' && build._id === null) {
        delete paths._id
      }
      selection = selection.cloneWithSelections({
        ignoreMissing: true,
        paths: Object.keys(paths)
      })
    }

    // re-resolve access based on actual model's default acl.
    try {
      const source = document.sourceConstructor(),
            defaultAcl = source ? source.defaultAcl : null
      if (acl.isObjectModel(source)) {
        ac.object = source
      }
      ac.resolve(true, acl.mergeAndSanitizeEntries(ac.option('$defaultAcl') || defaultAcl, ac.option('$defaultAclOverride') || defaultAcl, document.acl))
    } catch (err) {
      return callback(err)
    }

    // a parser model reads everything from it's raw document
    if (!this.hasReadAccess(ac)) {
      return callback(Fault.create('cortex.accessDenied.propertyRead', { resource: ac.getResource() }))
    }

    // go over ModelDefinition's head to avoid headaches around inclusions.
    let err, doc
    try {
      ac.initPath(ac.object && ac.object.pluralName, document._id)
      ac.beginResource(ac.object.schema.node.getResourcePath(ac, document, selection))

      doc = DocumentDefinition.prototype.aclRead.call(this, ac, document, selection)
    } catch (e) {
      err = e
    }
    setImmediate(() => {
      if (err || selection.getOption('deferGroupReads')) {
        callback(err, doc)
      } else {
        this.readGrouped(ac.principal, [doc], ac.req, ac.script, err => callback(err, doc))
      }
    })
  }

  _adjustSkippedPaths(skipped) {
    return _.without(skipped, 'type', 'creator', 'owner')
  }

  addProperty(prop) {

    // if no _id is present, don't force one.
    if (prop && !prop.__PropDef__ && prop.name === '_id') {
      return this.properties._id
    }
    return super.addProperty(prop)
  }

  hasReadAccess(ac) {

    if (!this._parserModel.getNativeSources().every(
      model => {

        if (!ac.inAuthScope(`object.read.${model.schema.node.fqpparts[0]}.${ac.subjectId}`)) {
          return false
        }

      })) {

      return true
    }

  };

}

class ParserModel {

  static create(stage, properties) {

    const candidateModels = stage.isFirst ? stage.parser.models : stage.prev.models,
          options = {
            label: 'Model',
            name: 'model',
            objectName: candidateModels[0].objectName,
            modelName: candidateModels[0].modelName,
            properties: properties,
            isFavoritable: true,
            isVersioned: true,
            allowConnections: true,
            isDeployable: false,
            wasCreated: true,
            source_models: candidateModels
          },
          def = new ParserDefinition(stage, options),
          modelMethods = {
            sourceConstructor: function() {
              if (this._sourceConstructor === undefined) {
                try {
                  this._sourceConstructor = stage.parser.discernDocumentModel(this, null, candidateModels)
                } catch (err) {
                  this._sourceConstructor = null
                }
              }
              return this._sourceConstructor
            },
            sourceConstructorNode: function() {
              const c = this.sourceConstructor()
              return c ? c.schema.node.root : null
            }
          }

    let model = def.generateMongooseModel('dummy_collection', {
      statics: {
        __ParserModel__: true,
        defaultAcl: [{ type: acl.AccessTargets.Account, target: acl.AnonymousIdentifier, allow: acl.AccessLevels.Public }]
      },
      methods: modelMethods
    })

    model.decorateSubject = function(subject) {
      Object.keys(modelMethods).forEach(method => {
        subject[method] = modelMethods[method]
      })
    }

    def._parserModel = model

    model.requiredAclPaths = candidateModels.reduce((required, model) => {
      return _.union(required, model.requiredAclPaths)
    }, [])

    model.prototype.isAccessSubject = function() {
      return true
    }

    model.source_models = candidateModels

    model.getNativeSources = function() {
      if (!this._nativeSources) {
        const native = this._nativeSources = []
        this.source_models.forEach(model => {
          if (model.__ParserModel__) {
            model.getNativeSources().forEach(model => {
              if (!native.includes(model)) {
                native.push(model)
              }
            })
          } else if (!native.includes(model)) {
            native.push(model)
          }
        })
      }
      return this._nativeSources
    }

    model.getSourceObjectName = function() {
      if (!this._getSourceObjectName) {
        let name = null
        for (let model of this.source_models) {
          let t = model.getSourceObjectName ? model.getSourceObjectName() : model.objectName
          if (name == null) {
            name = t
            if (name === false) {
              break
            }
          } else if (t !== name) { // documents and references may have differences, force to unknown.
            name = false
            break
          }
        }
        this._getSourceObjectName = name
      }
      return this._getSourceObjectName
    }

    model.getSourceObjectType = function() {
      if (!this._getSourceObjectType) {
        let type = null
        for (let model of this.source_models) {
          let t = model.getSourceObjectType ? model.getSourceObjectType() : model.objectTypeName
          if (type === null) {
            type = t
            if (type === false) {
              break
            }
          } else if (type !== t) { // documents and references may have differences, force to unknown.
            type = false
            break
          }
        }
        this._getSourceObjectType = type
      }
      return this._getSourceObjectType
    }

    Object.defineProperties(model, {
      defaultAcl: {
        get: () => {
          return utils.path(candidateModels[0], 'defaultAcl') || []
        }
      }
    })

    return model

  }

}

module.exports = ParserModel
