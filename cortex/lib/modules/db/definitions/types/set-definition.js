'use strict'

const util = require('util'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      clone = require('clone'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      PropertyDefinition = require('../property-definition'),
      DocumentDefinition = require('./document-definition')

let Undefined

function SetDefinition(options) {

  options = options || {}

  let indexed = options.indexed,
      discriminatorKey,
      uniqueProp,
      countLimits = {},
      documents,
      countKeys,
      properties = options.properties

  delete options.properties

  options.array = true
  options.virtual = false
  options.indexed = false
  options.mergeOverwrite = utils.rBool(options.mergeOverwrite, false)

  PropertyDefinition.call(this, options)
  options.indexed = indexed // undo write because this may get re-used by an object type.

  this._updateAccess = (options.updateAccess === acl.Inherit) ? acl.Inherit : acl.fixAllowLevel(options.updateAccess, true, acl.AccessLevels.Update)

  discriminatorKey = this.discriminatorKey = utils.rString(options.discriminatorKey, 'name')
  uniqueProp = this.uniqueProp = utils.rString(options.uniqueProp)
  countLimits = {}

  this.documents = {}

  documents = utils.array(utils.option(options, 'documents'))
  documents.forEach(def => {

    def = this._addDocument(def, properties, indexed)

    // store up min/max segment settings in case we need a validator.
    const minRequired = utils.rInt(def.minRequired, 0),
          maxAllowed = utils.rInt(def.maxAllowed, -1)

    if (minRequired > 0 || maxAllowed >= 0) {
      countLimits[def[discriminatorKey]] = { minRequired: minRequired, maxAllowed: maxAllowed }
    }

  })

  // implement uniqueProp, minSegments/maxSegments in one go.
  countKeys = Object.keys(countLimits)

  if (uniqueProp || countKeys.length > 0) {
    (this.validators || (this.validators = [])).push({
      name: 'adhoc',
      definition: {
        code: '',
        message: '',
        asArray: true,
        validator: function(ac, node, values) {
          let i, a, j, b
          if (uniqueProp) {
            for (i = 0; i < values.length; i++) {
              a = utils.path(values[i], uniqueProp)
              for (j = i + 1; j < values.length; j++) {
                b = utils.path(values[j], uniqueProp)
                if (a && b && a === b) {
                  throw Fault.create('cortex.conflict.uniqueInArray', { reason: 'A duplicate key was found in the set: ' + uniqueProp, path: node.fullpath })
                }
              }
            }
          }
          if (countKeys.length > 0) {
            // count careabouts.
            const counts = values
              .map(function(v) { return v[discriminatorKey] })
              .filter(function(v) { return ~countKeys.indexOf(v) })
              .reduce(function(counts, discriminatorValue) {
                counts[discriminatorValue] = utils.rInt(counts[discriminatorValue], 0) + 1
                return counts
              }, {})

            // throw on the first error.
            Object.keys(counts.forEach(function(key) {
              const count = counts[key],
                    limit = countLimits[key]
              if (count < limit.minRequired) {
                throw Fault.create('cortex.invalidArgument.minRequired', { reason: 'segment: ' + key, path: node.fullpath })
              } else if (limit.maxAllowed > -1 && count > limit.maxAllowed) {
                throw Fault.create('cortex.invalidArgument.maxAllowed', { reason: 'segment: ' + key, path: node.fullpath })
              }
            }))
          }
          return true
        }
      }
    })
  }

  if (this.reader || this.groupReader) {
    throw new Error('sets cannot have async readers or group readers!')
  }

}
util.inherits(SetDefinition, PropertyDefinition)
SetDefinition.typeName = 'Set'
SetDefinition.mongooseType = 'Set'

Object.defineProperties(SetDefinition.prototype, {
  updateAccess: {
    get: function() {
      if (this._updateAccess === acl.Inherit) {
        return this.parent ? (this.parent.updateAccess || this.parent.writeAccess) : acl.AccessLevels.Update
      }
      return this._updateAccess
    },
    set: function() {
      logger.error('update access set for ' + this.name)
    }
  }
})

SetDefinition.prototype.isIndexable = false

SetDefinition.prototype.getTypeName = function() {
  return SetDefinition.typeName
}

SetDefinition.prototype.apiSchema = function(options) {

  let prop, schema = PropertyDefinition.prototype.apiSchema.call(this, options)
  if (schema) {

    schema.type = 'Document[]' // override type for api visibility.

    schema.discriminator = this.discriminatorKey

    if (this.uniqueProp) {
      schema.uniqueProp = this.uniqueProp
    }

    let documents = []
    for (let name in this.documents) {
      if (this.documents.hasOwnProperty(name)) {
        prop = this.documents[name].apiSchema(options)
        if (prop) {
          documents.push(prop)
        }
      }
    }
    if (documents.length) {
      schema.documents = documents
    }
  }
  return schema

}

SetDefinition.getProperties = function(depth, props, Type, { exclude = [] } = {}) {

  return [
    { name: 'array', default: true, writable: false },
    { name: 'indexed', default: false, writable: true, public: true },
    { name: 'history', default: false, writable: false },
    { name: 'unique', default: false, writable: false },
    { name: 'auditable', default: false, writable: false },
    { name: 'virtual', default: false, writable: false },
    {
      label: 'Unique Property',
      name: 'uniqueProp',
      type: 'String',
      // description: 'Validation fails if there is more than one item value for the named property',
      readable: true,
      writable: true,
      trim: true,
      dependencies: ['.properties'],
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'uniqueProp must exist as a property in at least one set document definition.',
          validator: function(ac, node, value) {
            return _.find(node.documents, function(docDef) {
              return _.find(docDef.properties, function(property) {
                return property.name === value
              })
            })
          }
        }
      }]
    }, {
      // update validators.
      name: 'minItems',
      validators: [{
        name: 'number',
        definition: { min: 0, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
      }],
      default: 1
    }, {
      // update validators
      name: 'maxItems',
      dependencies: ['.minItems'],
      default: config('feeds.maxSegments'),
      validators: [{
        name: 'number',
        definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
      }, {
        name: 'adhoc',
        definition: {
          message: 'maxItems must be >= minItems',
          validator: function(ac, node, value) {
            return value === -1 || value >= this.minItems
          }
        }
      }]
    }, {
      label: 'Documents',
      name: 'documents',
      type: 'Document',
      // description: 'The document configuration. The name property of each set is used to differentiate between document types at runtime; Schema names must unique in the definition.',
      array: true,
      uniqueValues: true,
      minItems: 0,
      maxItems: 20,
      readable: true,
      canPull: true,
      canPush: true,
      uniqueKey: 'name',
      properties: [{
        label: 'Identifier',
        name: '_id',
        auto: true,
        readable: true,
        type: 'ObjectId'
      }, {
        label: 'Deployment Identifiers',
        name: 'did',
        type: 'ObjectId',
        readable: false,
        array: true
      }, {
        label: 'Label',
        name: 'label',
        type: 'String',
        readable: true,
        writable: true,
        trim: true,
        stub: '',
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: { min: 1, max: 100 }
        }],
        localization: {
          enabled: true,
          strict: false,
          fallback: true
        }
      }, {
        label: 'Name',
        name: 'name',
        type: 'String',
        // description: 'The set name. The name is used as a discriminator.',
        readable: true,
        writable: true,
        trim: true,
        validators: [{
          name: 'required'
        }, {
          name: 'customName'
        }],
        writer: function(ac, node, v) {
          return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
        }
      }, {
        label: 'Min Required',
        name: 'minRequired',
        type: 'Number',
        // description: 'The minimum number of segments of this type that must appear in the set.',
        readable: true,
        writable: true,
        default: 0,
        validators: [{
          name: 'number',
          min: 0,
          max: config('feeds.maxSegments'),
          allowNull: false,
          allowDecimal: false
        }]
      }, {
        label: 'Max Allowed',
        name: 'maxAllowed',
        type: 'Number',
        // description: 'The maximum number of segments of this type allowed in the set.',
        readable: true,
        writable: true,
        default: -1,
        dependencies: ['.minRequired'],
        validators: [{
          name: 'number',
          min: -1,
          max: config('feeds.maxSegments'),
          allowNull: false,
          allowDecimal: false
        }, {
          name: 'adhoc',
          definition: {
            name: 'adhoc',
            message: 'maxAllowed must be >= minRequired',
            validator: function(ac, node, value) {
              return value === -1 || value >= this.minRequired
            }
          }
        }]
      }, {
        label: 'Properties',
        name: 'properties',
        type: 'Set',
        // description: 'The properties available in the set. These are keyed by "name", which must be unique when creating the set definition.',
        maxItems: 50,
        readable: true,
        canPush: true,
        canPull: true,
        discriminatorKey: 'type',
        uniqueProp: 'name',
        uniqueKey: 'name',
        documents: modules.db.definitions.createSetProperties(depth - 1, false, { exclude }),
        puller: function(ac, node, value) {
          const property = utils.findIdInArray(utils.path(this, node.docpath), '_id', value)
          if (property) {

            const container = utils.path(this, node.docpath),
                  instancePath = modules.db.definitions.getInstancePath(property, node)

            ac.hook('save').before(function(vars, callback) {
              if (~vars.modified.map(path => utils.normalizeObjectPath(path, true, true)).indexOf(node.fullpath)) {
                if (!~utils.array(container).indexOf(value)) {
                  ac.object.fireHook('property.removed.before', null, { ac: ac, instancePath: instancePath, property: property, node: node }, callback)
                }
              }
            })
            ac.hook('save').after(function(vars) {
              if (~vars.modified.map(path => utils.normalizeObjectPath(path, true, true)).indexOf(node.fullpath)) {
                if (!~utils.array(container).indexOf(value)) {
                  ac.object.fireHook('property.removed.after', null, { ac: ac, instancePath: instancePath, property: property, node: node }, () => {})
                }
              }
            })
          }
          return value
        }
      }],
      validators: [{
        name: 'adhoc',
        definition: {
          code: 'cortex.conflict.uniqueInArray',
          message: 'Duplicate discriminator name found in set',
          asArray: true,
          validator: function(ac, node, values) {
            for (let i = 0; i < values.length; i++) {
              let a = utils.path(values[i], 'name')
              for (let j = i + 1; j < values.length; j++) {
                let b = utils.path(values[j], 'name')
                if (a && b && a === b) {
                  return false
                }
              }
            }
            return true
          }
        }
      }]
    }]

}

SetDefinition.prototype._addDocument = function(def, properties, indexed) {

  def = def || []
  if (!(def instanceof DocumentDefinition)) {

    def = utils.extend({}, def, { array: false })

    // common properties?
    if (Array.isArray(properties)) {
      properties = clone(properties)
      if (!Array.isArray(def.properties) || def.properties.length === 0) {
        def.properties = properties
      } else {
        const names = properties.map(v => v.name)
        for (let property of def.properties) {
          if (names.includes(property.name)) {
            throw new Error(`cannot include common property in document definition ${def.name}`)
          }
        }
        def.properties = [...properties, ...def.properties]
      }
    }
    def = new DocumentDefinition(def)
  }
  def.array = false

  // force an _id field for sets.
  def.addProperty({
    label: 'Identifier',
    name: '_id',
    auto: true,
    readable: true,
    type: 'ObjectId'
  })

  // add the discriminator, if it does not exist.
  if (!def.properties[this.discriminatorKey]) {
    def.addProperty({
      _id: this._id, // <-- this is for use in discriminator indexing
      label: 'Discriminator',
      name: this.discriminatorKey,
      readable: true,
      creatable: true,
      indexed: indexed,
      type: 'String'
    })
  }

  // add the _id, discriminator key, and parent deps to each property.
  for (let name in def.properties) {
    if (def.properties.hasOwnProperty(name)) {
      def.properties[name].addDependency('.' + this.discriminatorKey)
    }
  }

  this.documents[def.name] = def
  return def

}

SetDefinition.prototype.generateMongooseProperty = function(inSet) {

  return {
    ...PropertyDefinition.prototype.generateMongooseProperty.call(this, inSet),
    type: 'Set' // force to Set type. getMongooseType() does not always work
  }

}

/**
 * @param ac
 * @param parentDocument
 * @param value
 * @param index a specific index. if not present and an array, assume a pull was made and all matching items will be removed, affecting multiple indexes.
 */
SetDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index) {

  const documentNode = this.documents[utils.path(value, this.discriminatorKey)]
  if (!documentNode) {
    logger.error('onRemovingValue() failed to find discriminator document for ' + ac.objectName + ':' + this.fullpath)
  }
  documentNode.onRemovingValue(ac, parentDocument, value, index)
}

SetDefinition.prototype._discernNode = function(document, path) {

  let parts = utils.pathParts(path), prefix = parts[0], suffix = parts[1]

  if (utils.isIdFormat(prefix) || utils.isInteger(prefix)) {
    document = utils.digIntoResolved(document, this.docpath + '.' + prefix, true, true)
  } else {
    document = null
  }
  if (document) {

    parts = utils.pathParts(suffix); prefix = parts[0]; suffix = parts[1]

    // find the correct node using the discriminator.
    const discriminatorKey = this.discriminatorKey, discriminatorValue = document[discriminatorKey]
    if (discriminatorValue) {
      let node = this.documents[discriminatorValue]
      if (node) {
        node = node.properties[prefix]
        if (!suffix) {
          return node
        }
        if (node) {
          return node._discernNode(document, suffix)
        }
      }
    }
  }
  return null

}

SetDefinition.prototype.findNodeById = function(id) {
  for (let docName in this.documents) {
    if (this.documents.hasOwnProperty(docName)) {
      const node = this.documents[docName],
            property = node && node.findNodeById(id)
      if (property) {
        return property
      }
    }
  }
}

SetDefinition.prototype.findNodeByFqpp = function(fqpp) {
  for (let docName in this.documents) {
    if (this.documents.hasOwnProperty(docName)) {
      const node = this.documents[docName],
            property = node && node.findNodeByFqpp(fqpp)
      if (property) {
        return property
      }
    }
  }
}

/**
 * returns the first node match.
 *
 * @param path
 * @returns {*}
 */
SetDefinition.prototype.findNode = function(path) {
  for (let docName in this.documents) {
    if (this.documents.hasOwnProperty(docName)) {
      const doc = this.documents[docName],
            node = doc && doc.findNode(path)
      if (node) {
        return node
      }
    }
  }
}

/**
 *
 * @param path
 * @param into array to accept matching nodes.
 * @param options
 * @returns {*}
 */
SetDefinition.prototype.findNodes = function(path, into, options) {
  for (let docName in this.documents) {
    if (this.documents.hasOwnProperty(docName)) {
      this.documents[docName].findNodes(path, into, options)
    }
  }
  return into
}

// borrow from DocumentDefinition. the result reader logic is identical.
SetDefinition.prototype._readArrayResult = DocumentDefinition.prototype._readArrayResult
SetDefinition.prototype._readDocument = DocumentDefinition.prototype._readDocument
SetDefinition.prototype._writeArrayValues = DocumentDefinition.prototype._writeArrayValues
SetDefinition.prototype._removeElement = DocumentDefinition.prototype._removeElement
SetDefinition.prototype._orderedWrite = DocumentDefinition.prototype._orderedWrite
SetDefinition.prototype._pullDocument = DocumentDefinition.prototype._pullDocument
SetDefinition.prototype._doRemoveDocument = DocumentDefinition.prototype._doRemoveDocument
SetDefinition.prototype._pullDocumentElement = DocumentDefinition.prototype._pullDocumentElement
SetDefinition.prototype.aclWrite = DocumentDefinition.prototype.aclWrite
SetDefinition.prototype.aclRead = DocumentDefinition.prototype.aclRead
SetDefinition.prototype.hasUpdateAccess = DocumentDefinition.prototype.hasUpdateAccess
SetDefinition.prototype.hasScopeReadAccess = DocumentDefinition.prototype.hasScopeReadAccess
SetDefinition.prototype.hasScopeUpdateAccess = DocumentDefinition.prototype.hasScopeUpdateAccess

SetDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  parts = utils.normalizeAcPathParts(parts)

  if (parts.length === 0) {
    PropertyDefinition.prototype.aclAccess.call(this, ac, parentDocument, parts, options, callback)
  } else {
    callback(Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'aclAccess for sets is not implemented.', path: this.fqpp }))
  }

}

SetDefinition.prototype._getDocNode = function(doc) {
  if (doc) {
    let discriminator = doc[this.discriminatorKey]
    if (!discriminator && _.isFunction(doc.toObject)) {
      discriminator = utils.path(doc.toObject(), this.discriminatorKey)
    }
    return this.documents[discriminator]
  }
  return null

}

SetDefinition.prototype.getResourcePath = function(ac, document, selection) {

  let discriminator = document[this.discriminatorKey],
      identifier = document._id,
      path = PropertyDefinition.prototype.getResourcePath.call(this, ac, document, selection)

  if (discriminator) {
    path += `#${this.discriminatorKey}(${discriminator})`
  }
  if (identifier) {
    path += `._id(${identifier})`
  }

  return path
}

SetDefinition.prototype._writeSingleValue = function(ac, parentDocument, value, options, callback) {

  return callback(Fault.create('cortex.error.unspecified', { resource: ac.getResource(), reason: 'Sets non array write', path: this.fullpath })) // nested path write expects and object payload.

}

SetDefinition.prototype.assertPayloadValueIsSane = function(ac, value) {

  // for a set, accept any document and let the document writer figure it out.
  if (!utils.isPlainObject(value)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Expected an object payload.', path: this.fullpath })
  }

}

SetDefinition.prototype.findDocumentTargetNode = function(doc) {

  const discriminatorValue = utils.path(doc, this.discriminatorKey)
  if (discriminatorValue) {
    return this.documents[discriminatorValue]
  }
}

SetDefinition.prototype._writeDocument = function(ac, parentDocument, currentArray, payload, options, callback) {

  let docId,
      arrayDocument,
      added,
      docIdx,
      discriminatorValue = utils.path(payload, this.discriminatorKey), // we must have a discriminator value. if this is a new document, it must be present. allow the value to be changed at this low level.
      discriminatorInPayload = !!discriminatorValue,
      foundUsingUniquekey = false,
      uniqueKeyNode = this.uniqueKey && this.findNode(this.uniqueKey)

  arrayDocument = utils.findIdInArray(currentArray, '_id', utils.path(payload, '_id'), true)
  if (!arrayDocument && uniqueKeyNode && Array.isArray(currentArray)) {
    arrayDocument = currentArray.find(v => uniqueKeyNode.equals(v && v[this.uniqueKey], utils.path(payload, this.uniqueKey)))
    foundUsingUniquekey = !!arrayDocument
  }
  if (!discriminatorInPayload && arrayDocument) {
    discriminatorValue = arrayDocument.get(this.discriminatorKey)
  }

  if (!discriminatorValue) {
    return callback(Fault.validationError('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Missing discriminator key "' + this.discriminatorKey + '" for ' + this.fullpath, path: this.fullpath }))
  }

  const documentType = this.documents[discriminatorValue]
  if (!documentType) {
    return callback(Fault.validationError('cortex.notFound.unspecified', { resource: ac.getResource(), reason: 'Invalid discriminator key "' + this.discriminatorKey + '" is not configured.,' + payload[this.discriminatorKey] + ',path,' + this.fullpath, path: this.fullpath }))
  }

  // delete the discriminator from the payload. if someone is trying to update it (which is not allowed) leave it in so an error can be thrown.
  // unless it's a match.
  if (discriminatorInPayload && (!arrayDocument || payload[this.discriminatorKey] === arrayDocument[this.discriminatorKey])) {
    delete payload[this.discriminatorKey]
  }

  // lookup or add the array document (after we know there are no obvious path errors)
  docId = arrayDocument ? arrayDocument._id : payload._id

  added = !docId
  if (added) {
    const doc = {
      _id: (docId = utils.createId())
    }
    doc[this.discriminatorKey] = discriminatorValue
    currentArray.push(doc)
    if (this.maxItems >= 0) {
      while (currentArray.length > 0 && this.maxShift && currentArray.length > this.maxItems) {
        currentArray.shift()
      }
    }
  }

  docIdx = utils.findIdPos(currentArray, '_id', docId)
  arrayDocument = docIdx === -1 ? undefined : currentArray[docIdx]

  if (!arrayDocument) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), reason: 'path,' + this.fullpath + '.' + docId, path: this.fullpath + '.' + docId }))
  }

  ac.setResource(this.getResourcePath(ac, arrayDocument))

  if (options.onWrite) {
    options.onWrite(ac, this, parentDocument, arrayDocument, docIdx)
  }

  this._orderedWrite(
    ac,
    documentType,
    arrayDocument,
    payload,
    path => payload.hasOwnProperty(path) && !(path === '_id' || (foundUsingUniquekey && path === this.uniqueKey)),
    options,
    (err, result) => {
      if (!err && added) {
        this.onValueAdded(ac, parentDocument, arrayDocument, Undefined, docIdx)
      }
      callback(err, result)
    }
  )

}

SetDefinition.prototype.walkDocument = function(doc, fn, options) {

  let disciminator = doc ? doc[this.discriminatorKey] : null,
      property = disciminator ? this.documents[disciminator] : null

  if (property) {
    return property.walkDocument(doc, fn, options)
  }

}

SetDefinition.prototype.walk = function(fn) {
  let ret
  for (let name in this.documents) {
    if (this.documents.hasOwnProperty(name)) {
      ret = this.documents[name].walk(fn)
      if (ret === -1 || ret === false || ret === -3) {
        return ret
      }
    }
  }
  return ret
}

SetDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {
  PropertyDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)
  for (let name in this.documents) {
    if (this.documents.hasOwnProperty(name)) {
      this.documents[name].collectRuntimePathSelections(principal, selections, path, options)
    }
  }
}

SetDefinition.prototype.eachChild = function(fn) {
  for (let name in this.documents) {
    if (this.documents.hasOwnProperty(name)) {
      this.documents[name].eachChild(fn)
    }
  }
}

SetDefinition.prototype.castForQuery = function(ac, value) {
  throw Fault.create('cortex.invalidArgument.castError', { resource: ac.getResource(), reason: 'Could not cast "' + value + '" to Set.', path: this.fullpath })
}

SetDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  DocumentDefinition.prototype.initNode.call(this, root, parent, initializingASetDocument, isSetProperty)
  for (let name in this.documents) {
    if (this.documents.hasOwnProperty(name)) {

      this.documents[name].initNode(root, this, true)

      // add local dependencies to each document.
      if (this._dependencies) {
        for (let dep in this._dependencies) {
          if (this._dependencies.hasOwnProperty(dep)) {
            this.documents[name].addDependency(dep)
          }
        }
      }

      this.documents[name].addDependency(this.fullpath + '.' + this.discriminatorKey)
      if (this.uniqueProp) {
        this.documents[name].addDependency(this.fullpath + '.' + this.uniqueProp)
      }

    }
  }

}

SetDefinition.getMappingProperties = function(depth) {
  return [{
    label: 'Documents',
    name: 'documents',
    type: 'Document',
    array: true,
    properties: [{
      label: 'Identifier',
      name: '_id',
      type: 'ObjectId',
      auto: false
    }, {
      label: 'Label',
      name: 'label',
      type: 'String'
    }, {
      label: 'Name',
      name: 'name',
      type: 'String'
    }, {
      label: 'Properties',
      name: 'properties',
      type: 'Set',
      discriminatorKey: 'type',
      uniqueProp: 'name',
      documents: modules.db.definitions.createSetMappingProperties(depth - 1)
    }]
  }]
}

/**
 *
 * @param ac
 * @param docs
 * @param resourceStream
 * @param parentPath
 * @param options
 *  required
 *  resourcePath - static resourcePath
 * @returns {Promise<*>}
 */
SetDefinition.prototype.export = async function(ac, docs, resourceStream, parentPath, options) {

  const resourcePath = this.getExportResourcePath(parentPath, options),
        required = this.isExportable(ac, docs, resourceStream, resourcePath, parentPath, options)

  let index = 0,
      results = [],
      allRejected = null

  options = { ...options, required }

  for (const val of utils.array(docs)) {

    if (allRejected === null) {
      allRejected = true
    }

    const key = val && val.hasOwnProperty(this.discriminatorKey) && val[this.discriminatorKey],
          node = this.documents.hasOwnProperty(key) && this.documents[key],
          documentPath = utils.joinPaths(resourcePath, this.uniqueKey ? val[this.uniqueKey] : index),
          result = await node.export(ac, val, resourceStream, documentPath, options)

    if (result) {
      allRejected = false
      index++
      results.push(result)
    }

  }

  if (this.uniqueKey) {
    results = results.sort((a, b) => utils.naturalCmp(a[this.uniqueKey], b[this.uniqueKey]))
  }

  return allRejected ? Undefined : results
}

SetDefinition.prototype.import = async function(ac, docs, resourceStream, parentPath, options) {

  const resourcePath = this.getExportResourcePath(parentPath, options),
        required = this.isImportable(ac, docs, resourceStream, resourcePath, parentPath, options)

  options = { ...options, nodePath: Undefined, required }

  let index = 0,
      results = [],
      allRejected = null

  for (const val of utils.array(docs, true)) {

    if (allRejected === null) {
      allRejected = true
    }

    const key = val && val.hasOwnProperty(this.discriminatorKey) && val[this.discriminatorKey],
          node = this.documents.hasOwnProperty(key) && this.documents[key],
          documentPath = utils.joinPaths(resourcePath, (val && this.uniqueKey) ? val[this.uniqueKey] : index),
          result = node && await node.import(ac, val, resourceStream, documentPath, options)

    if (result) {
      allRejected = false
      index++
      results.push(result)
    }

  }

  return allRejected ? Undefined : results

}

module.exports = SetDefinition
