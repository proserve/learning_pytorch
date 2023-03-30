'use strict'

const util = require('util'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      { path: pathTo, array: toArray, promised, rBool, isSet, isCustomName, isPlainObject, isPlainObjectWithSubstance } = require('../../../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      toposort = require('toposort'),
      UnhandledResult = require('../classes/unhandled-result'),
      PropertyDefinition = require('../property-definition'),
      makeUniqueKey = require('../properties/uniqueKey').definition

let Undefined

/**
 * @param options
 * @constructor
 */
function DocumentDefinition(options) {

  options = options || {}

  // documents, by default do not overwrite on merge.
  options.mergeOverwrite = rBool(options.mergeOverwrite, false)

  PropertyDefinition.call(this, options)

  this._updateAccess = (options.updateAccess === acl.Inherit) ? acl.Inherit : acl.fixAllowLevel(options.updateAccess, true, acl.AccessLevels.Update)

  this.properties = {}

  utils.array(utils.option(options, 'properties')).forEach(prop => this.addProperty(prop))

  this.docWriter = options.docWriter

  // documents only get an id field when they are arrays.
  if ((this.array || utils.option(options, 'forceId', false)) && !utils.option(options, 'noId', false)) {
    this.addProperty({
      label: 'Identifier',
      name: '_id',
      auto: utils.option(options, 'autoId', true),
      readable: true,
      readAccess: acl.AccessLevels.None,
      nativeIndex: utils.option(options, 'nativeIndexId', false),
      type: 'ObjectId'
    })
  } else {
    this.removeProperty('_id')
  }

  if (this.validators.length && !this.array) {
    // logger.error('validator on nested document.', {name: this.name});
  }

}
util.inherits(DocumentDefinition, PropertyDefinition)

DocumentDefinition.typeName = 'Document'
DocumentDefinition.mongooseType = null

Object.defineProperties(DocumentDefinition.prototype, {
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

DocumentDefinition.prototype.isIndexable = false

DocumentDefinition.prototype.getTypeName = function() {
  return DocumentDefinition.typeName
}

DocumentDefinition.prototype.isPrimitive = function() {
  return false
}

DocumentDefinition.prototype.addProperty = function(prop) {

  if (prop) {
    if (!prop.__PropDef__) {
      const Type = modules.db.definitions.typeDefinitions[prop.type]
      if (Type) {
        prop = new Type(prop)
      }
    }
    if (prop) {
      // when the property is an array, all the child properties should also have the id as a dependency.
      if (this.array) {
        prop.addDependency('._id')
      }
      if (this.properties[prop.name]) {
        // logger.warn('Not overwriting '+prop.name+' property for '+this.name);
      } else {
        this.properties[prop.name] = prop
      }
      return prop
    }
  }
  throw Fault.create('cortex.notFound.unspecified', { reason: 'property definition type not found.' })
}

DocumentDefinition.prototype.removeProperty = function(name) {
  delete this.properties[name]
}

/**
 * Generates a runtime property definition.
 */
DocumentDefinition.prototype.generateMongooseProperty = function(inSet) {

  // nested/composite property
  if (!this.array) {
    const schemaProperties = {}
    for (let name in this.properties) {
      if (this.properties.hasOwnProperty(name)) {
        utils.path(schemaProperties, name, this.properties[name].generateMongooseProperty(false))
      }
    }
    return schemaProperties
  }

  // document array.
  const property = PropertyDefinition.prototype.generateMongooseProperty.call(this, inSet)
  property.type = [this.generateMongooseSchema({ inSet: false })]
  return property

}

DocumentDefinition.prototype.apiSchema = function(options) {

  const schema = PropertyDefinition.prototype.apiSchema.call(this, options)
  if (schema) {
    const properties = []
    for (let name in this.properties) {
      if (this.properties.hasOwnProperty(name)) {
        const prop = this.properties[name].apiSchema(options)
        if (prop) {
          properties.push(prop)
        }
      }
    }
    if (properties.length) {
      schema.properties = properties
    }
  }
  return schema

}

/**
 * @param options
 *      indexes: null If true, adds the indexes to the schema.
 *      options: null schema options
 *      statics: null statics
 *      methods: null methods
 *      inSet: true if the properties in the schema are being generated for a Set/MultiSchema. if so, they'll have discriminator and name properties.
 *      properties: if set, uses the passed in properties.
 *      exclude: exclude properties
 */
DocumentDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}

  let schema

  // build schema properties.
  const inSet = utils.option(options, 'inSet', false),
        exclude = utils.array(options.exclude, isSet(options.exclude)),
        schemaOptions = utils.extend({ _id: false }, options.options),
        schemaProperties = {},
        refs = [],
        properties = options.properties || this.properties

  for (const name in properties) {
    if (properties.hasOwnProperty(name)) {
      if (!exclude.includes(name)) {
        const def = properties[name],
              prop = def.generateMongooseProperty(this, inSet)

        if (prop) {

          // hack in the refs. mongoose doesn't pick them up for array types the way we've got them formatted.
          if (prop.ref && def.array) {
            refs.push(name)
          }
          utils.path(schemaProperties, name, prop)
        }
      }
    }
  }
  schema = new modules.db.mongoose.Schema(schemaProperties, schemaOptions)

  refs.forEach(function(ref) {
    const s = schema.path(ref)
    s.caster.options.ref = s.options.ref
  })

  schema.static(options.statics || {})
  schema.method(options.methods || {})
  utils.array(options.indexes).forEach(function(args) {
    schema.index.apply(schema, args)
  })

  schema.node = this

  return schema
}

DocumentDefinition.prototype.hasScopeReadAccess = function(ac) {
  return !this.scoped || ac.inAuthScope(`object.read.${this.fqpparts[0]}.${ac.subjectId}.${this.fqpparts[1]}`, true)
}

DocumentDefinition.prototype.hasScopeWriteAccess = function(ac) {
  return !this.scoped || ac.inAuthScope(`object.update.${this.fqpparts[0]}.${ac.subjectId}.${this.fqpparts[1]}`, true)
}

DocumentDefinition.prototype.hasScopeUpdateAccess = function(ac) {
  return !this.scoped || ac.inAuthScope(`object.update.${this.fqpparts[0]}.${ac.subjectId}.${this.fqpparts[1]}`, true)
}

DocumentDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  parts = utils.normalizeAcPathParts(parts)

  if (parts.length === 0) {
    return PropertyDefinition.prototype.aclAccess.call(this, ac, parentDocument, parts, options, callback)
  }

  if (!this.readable) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fqpp }))
  } else if (this.groupReader || this.virtual) {
    return callback(Fault.create('cortex.unsupportedOperation.unspecified', { resource: ac.getResource(), reason: 'Cannot determine access for virtual paths.', path: this.fqpp }))
  } else if (this.array) {
    callback(Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'aclAccess for document arrays is not implemented.', path: this.fqpp }))
  }

  const part = parts.shift(),
        node = this.properties.hasOwnProperty(part) && this.properties[part]

  if (!node) {
    callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fqpp}.${part}` }))
  } else {
    node.aclAccess(ac, parentDocument, parts, options, callback)
  }

}

DocumentDefinition.prototype.aclRead = function(ac, parentDocument, selection) {

  if (selection.getTreatAsIndividualProperty() === true || !this.array) {
    return PropertyDefinition.prototype.aclRead.call(this, ac, parentDocument, selection)
  }

  if (!this.readable) {
    if (ac.passive || selection.passive) {
      return undefined
    }
    throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath })
  }
  if (!this.hasReadAccess(ac)) {
    if (ac.passive || selection.passive) {
      return undefined
    }
    throw Fault.create('cortex.accessDenied.propertyRead', { resource: ac.getResource(), path: this.fullpath })
  }

  ac.addPath(this.name)
  ac.pushResource(`${this.name}[]`)

  // always bypass getters and apply them here, because we don't know if we have a mongoose or plain doc.
  let result

  if (this.groupReader) {

    result = this._readerGroupReader.call(parentDocument, ac, this, selection)

  } else {

    // always bypass getters and apply them here, because we don't know if we have a mongoose or plain doc.
    let value = (parentDocument.getValue && parentDocument.getValue(this.docpath)) || utils.path(parentDocument, this.docpath)
    this.get.length && (value = this.get.reduce((v, fn) => fn.call(parentDocument, v), value))

    result = this._readArrayResult(ac, parentDocument, value, false, selection)
  }
  ac.delPath()
  ac.popResource()
  return result

}

DocumentDefinition.prototype._discernNode = function(document, path) {

  let node, parts = utils.pathParts(path), prefix = parts[0], suffix = parts[1]

  if (this.array) {

    if (utils.isIdFormat(prefix) || utils.isInteger(prefix)) {
      document = utils.digIntoResolved(document, (this.docpath ? (this.docpath + '.' + prefix) : prefix), true, true)
      if (document) {
        if (!suffix) {
          return this
        }
        parts = utils.pathParts(suffix); prefix = parts[0]; suffix = parts[1]
        node = this.properties.hasOwnProperty(prefix) && this.properties[prefix]
        if (!suffix) {
          return node
        }
        if (node) {
          return node._discernNode(document, suffix)
        }
        return null
      }
    }
    return null

  }

  node = this.properties.hasOwnProperty(prefix) && this.properties[prefix]

  if (!suffix) {
    return node
  }
  if (node) {
    return node._discernNode(document, suffix)
  }

  return null
}

DocumentDefinition.prototype._readSingleResult = function(ac, parentDocument, result, handled, selection) {

  if (handled) {
    return result
  }

  let doc = {}

  selection.eachSelection(this, parentDocument, (path, selection) => {

    const node = this.properties.hasOwnProperty(path) && this.properties[path]
    if (!node) {
      if (ac.passive || selection.parent.passive || selection.parent.ignoreMissing) {
        return true
      }
      throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
    }

    let value = doc[path] = node.aclRead(ac, parentDocument, selection)

    if (!ac.passive && !selection.parent.passive && !selection.parent.ignoreMissing && !selection.getOption('forgiving') && ~['Reference', 'Document', 'Set'].indexOf(node.constructor.typeName)) {
      if (value) {
        // allow empty arrays.
        if (node.array && value.length === 0) {
          return true
        }
        for (let key in value) {
          if (value.hasOwnProperty(key) && value[key] !== undefined) {
            return true
          }
        }
      }
      throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: node.fullpath + (selection.keys.length > 0 ? '[' + selection.keys.join(',') + ']' : '') })
    }

    return true

  }, { skipIndexes: true, skipIds: true })

  return doc
}

DocumentDefinition.prototype._readArrayResult = function(ac, parentDocument, docs, handled, selection) {

  if (handled) {
    return docs
  }

  if (!_.isArray(docs)) {
    if (docs) {
      docs = [docs]
    } else if (this.stub !== undefined) {
      docs = utils.array(this.stub(), true)
    } else if (!parentDocument.getValue && this.default !== undefined) {
      if (_.isFunction(this.default)) {
        docs = utils.array(this.default(), true)
      } else {
        docs = utils.array(this.default, true)
      }
    } else {
      docs = []
    }
  }

  let hasPlainKeys = false, i, index, doc, path, seen = new Set(), entries = []

  // see if there are any ids or array indices. if so, ONLY those documents will be read if the reader is passive, meaning explicit paths from all other documents
  // were not requested. for example, stuff.0.thing + stuff.bar means only get thing from idx 0 but get bar from all stuff docs.
  for (i = 0; i < selection.keys.length; i++) {
    path = selection.keys[i]
    if (utils.isIdFormat(path)) {
      doc = utils.findIdInArray(docs, '_id', path)
      if (!doc) {
        throw Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
      } else if (seen.has(doc)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}`, reason: 'Cannot mix _id and index lookups on the same document.' })
      } else {
        index = docs.indexOf(doc)
        seen.add(doc._id)
        entries.push({ doc: doc, selection: selection.selections[path], index: index, node: this._getDocNode(doc) })
      }

    } else if (utils.isInteger(path)) {

      index = parseInt(path)
      if (index < 0) index = docs.length + index // support negative indexes
      doc = docs[index]
      if (!doc) {
        throw Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
      } else if (seen.has(doc)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}`, reason: 'Cannot mix _id and index lookups on the same document.' })
      } else {
        seen.add(doc._id)
        entries.push({ doc: doc, selection: selection.selections[path], index: index, node: this._getDocNode(doc) })
      }
    } else {
      hasPlainKeys = true
    }
  }

  // if we have indexed or id lookup and are passive, it means we're not going to select any more documents
  if (hasPlainKeys || selection.passive) {
    for (i = 0; i < docs.length; i++) {
      doc = docs[i]
      if (!seen.has(doc._id)) {
        entries.push({ doc: doc, selection: selection, index: i, node: this._getDocNode(doc) })
      }
    }
  }

  ac.addPath('')
  entries.forEach(entry => {

    ac.setPath(entry.doc._id)
    ac.setResource(this.getResourcePath(ac, entry.doc, selection))

    if (this._compiledReader) {
      const result = this._compiledReader.call(entry.doc, ac, this, selection)
      if (result instanceof UnhandledResult) {
        entry.doc = result.result
      } else {
        entry.result = result
        return
      }
    }

    this._readDocument(ac, entry, parentDocument)

  })
  ac.delPath()

  return entries.sort(function(a, b) {
    return a.index - b.index
  }).map(function(entry) {
    return entry.result
  }).filter(function(result) {
    return isPlainObjectWithSubstance(result)
  })

}

DocumentDefinition.prototype.getResourcePath = function(ac, document, selection) {

  const uniqueKeyName = this.uniqueKey,
        uniqueKeyNode = uniqueKeyName && this.findNode(uniqueKeyName)

  let identifier,
      path = PropertyDefinition.prototype.getResourcePath.call(this, ac, document, selection)

  if (this.array) {

    try {
      identifier = uniqueKeyNode
        ? (uniqueKeyNode.reader
          ? uniqueKeyNode.reader.call(document, ac, uniqueKeyNode, selection)
          : utils.path(document, uniqueKeyNode.docpath)
        )
        : null
      if (identifier) {
        identifier = `${uniqueKeyName}(${identifier})`
      }
    } catch (e) {}

    if (!identifier) {
      identifier = `_id(${document._id})`
    }

    if (identifier) {
      path += `.${identifier}`
    }

  }

  return path

}

DocumentDefinition.prototype._getDocNode = function(doc) {
  void doc
  return this
}

DocumentDefinition.prototype._readDocument = function(ac, entry, parentDocument) {

  let result = {}, has

  if (entry.node) {
    entry.selection.eachSelection(entry.node, parentDocument, (path, selection) => {

      let val, propNode = entry.node.properties[path]
      if (!propNode) {
        if (ac.passive || entry.selection.passive || entry.selection.ignoreMissing) {
          return true
        } else {
          throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` })
        }
      }
      result[path] = val = propNode.aclRead(ac, entry.doc, selection)
      if (val !== undefined) {
        has = true
      }
      return true

    }, { skipIndexes: true, skipIds: true })
  }
  entry.result = has ? result : undefined

  return entry

}

DocumentDefinition.prototype.hasUpdateAccess = function(ac) {

  if (!this.hasScopeUpdateAccess(ac)) {
    return false
  }

  const required = acl.fixAllowLevel(utils.rVal(this.updateAccess, this.writeAccess), true, acl.AccessLevels.Update)
  let resolved = ac ? ac.resolved : acl.AccessLevels.None
  // augmenting acl? this acl can grant greater/lesser access at the property level.
  if (this.acl.length > 0 && ac) {
    const access = ac.resolveAccess({ acl: this.acl, withGrants: true })
    if (access.allow > resolved || this.aclOverride) resolved = Math.min(access.allow, acl.AccessLevels.Max)
  }
  return resolved >= required
}

DocumentDefinition.prototype.aclWrite = function(ac, parentDocument, values, options, callback_) {

  [options, callback_] = utils.resolveOptionsCallback(options, callback_, true, false)

  const callback = (err) => {
    ac.popResource()
    callback_(err)
  }
  ac.pushResource(this.getResourcePath(ac, parentDocument))

  let adding = [],
      updating = []

  if (!this.readable) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath }))
  } else if (!this.isWritable(ac)) {
    return callback(ac.passive ? null : Fault.create('cortex.accessDenied.notWritable', { resource: ac.getResource(), path: this.fullpath }))
  } else if (
    !this.array &&
    !_.isObject(values) &&
    !((ac.method === 'put' || !this.array || options.mergeDocuments) ? this.writer : this.pusher) // write or pusher must exist
  ) {
    return callback(ac.passive ? null : Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'Illegal primitive. Expected an object.' })) // nested path write expects and object payload.
  } else if (this.array) {

    // determine the targets. anything with an _id assumes we're looking to update properties.
    // anything without an id acts on the document array (push or write)
    // if no items are being updated and we're a 'put', then see if we can overwrite.
    values = utils.array(values, true)

    const hasIds = _.some(values, value => utils.getIdOrNull(utils.path(value, '_id'))),
          isPutting = !options.mergeDocuments && !hasIds && ac.method === 'put' && this.writable,
          isOverwriting = options.mergeDocuments && this.mergeOverwrite && !hasIds,
          current = toArray(pathTo(parentDocument, this.docpath)),
          forceOverwrite = rBool(options.overwrite, options.updating === false && (isPutting || isOverwriting))

    for (let i = 0; i < values.length; i += 1) {

      const value = values[i],
            uniqueKeyNode = this.uniqueKey && this.findNode(this.uniqueKey),
            uniqueKey = uniqueKeyNode && value && value[this.uniqueKey]

      if (!_.isObject(value)) {
        if (!ac.passive) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Expected object document.', path: this.fullpath }))
        }
      } else if (utils.getIdOrNull(value._id)) {
        updating.push(value)
      } else if (value._id) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Invalid document _id. Expected an ObjectId.', path: this.fullpath }))
      } else if (uniqueKey && current.find(v => uniqueKeyNode.equals(v && v[this.uniqueKey], uniqueKey))) {
        forceOverwrite ? adding.push(value) : updating.push(value)
      } else {
        adding.push(value)
      }
    }

    if (!options.mergeDocuments) {

      // for the time being, don't allow pushing and updating at the same time.
      if (adding.length && updating.length) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'Pushed document has an _id and/or updated document is missing an _id.', path: this.fullpath }))
      }

      // are we acting on the document array?
      // adding could still be 0. if the array is empty and we allow overwrite, assume the caller wants to set to empty.
      // check to see if we are allowing the reset/additions.
      if (!updating.length) {
        const canUseWriter = this.writeOnCreate && !!utils.path(parentDocument, 'isNew') && (this.writable || this.creatable)
        if (!((ac.method === 'post' && (this.canPush || canUseWriter)) || (ac.method === 'put' && this.writable))) {
          return callback(Fault.create('cortex.unsupportedOperation.unspecified', { resource: ac.getResource(), reason: 'Unsupported request method ' + ac.method, path: this.fullpath }))
        }
      }
    }

  }

  // split up documents into groups. detect updates using unique keys.
  if (options.mergeDocuments && this.array) {

    if (adding.length === 0 && updating.length === 0) {
      return callback()
    }

    if (this.mergeOverwrite && adding.length > 0 && updating.length > 0) {
      return callback(Fault.create('cortex.unsupportedOperation.unspecified', { resource: ac.getResource(), reason: 'This property only overwrites when merging' + ac.method, path: this.fullpath }))
    }

    Promise.resolve(null)
      .then(async() => {
        if (updating.length) {
          let err
          if (!this.hasUpdateAccess(ac)) {
            err = ac.passive ? null : Fault.create('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: this.fullpath })
          } else if (!parentDocument.isNew && this.creatable) {
            err = ac.passive ? null : Fault.validationError('cortex.invalidArgument.creatableOnly', { resource: ac.getResource(), path: this.fullpath })
          }
          if (err) {
            throw err
          }
          return promised(this, '_writeArrayValues', ac, parentDocument, updating, { ...options, updating: true })
        }
      })
      .then(async() => {
        if (adding.length) {
          return promised(this, '_doPropertyWrite', ac, parentDocument, adding, options)
        }
      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  } else if (this.array && updating.length) {

    // updating individual documents so don't run through writer/pusher, skip right to _writeDocument.
    if (!this.hasUpdateAccess(ac)) {
      return callback(ac.passive ? null : Fault.create('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: this.fullpath }))
    }
    if (!parentDocument.isNew && this.creatable) {
      return callback(ac.passive ? null : Fault.validationError('cortex.invalidArgument.creatableOnly', { resource: ac.getResource(), path: this.fullpath }))
    }

    this._writeArrayValues(ac, parentDocument, updating, { ...options, updating: true }, callback)

  } else {

    this._doPropertyWrite(ac, parentDocument, values, options, callback)
  }

}

DocumentDefinition.prototype._getLocalSortedNodes = function(uniqueKeyNode) {

  if (!this._localSortedNodes) {

    const groups = {
            keys: [], // sort by writePriority
            native: [], // sort by writePriority
            custom: [], // sort by dependencies
            deferred: [] // sort by writePriority
          },
          { keys, native, custom, deferred } = groups,
          entries = Object.entries(this.properties)

    // group nodes by trivial write order.
    for (const [name, node] of entries) {
      if (node.deferWrites) {
        deferred.push(node)
      } else if ((node === uniqueKeyNode && !isPlainObjectWithSubstance(node.dependencies)) || node.name === '_id') {
        keys.push(node)
      } else if (isCustomName(name)) {
        custom.push(node)
      } else {
        native.push(node)
      }
    }

    // sort groups by writeOrder and (sometimes) by dependencies
    for (const [group, nodes] of Object.entries(groups)) {

      // custom properties should not have horrible cyclic dependency issues
      if (group === 'custom') {

        let sorted

        const names = Object.keys(this.properties),
              propertyNames = new Set(names),
              graph = []

        for (const node of nodes) {

          const { name, path, fullpath } = node,
                prefix = fullpath.slice(0, fullpath.length - path.length), // can be ""
                visited = new Set([name]),
                dependencies = Object.keys(node.dependencies || {})
                  .filter(dependency => dependency.startsWith(prefix))
                  .map(dependency => dependency.slice(prefix.length).split('.')[0])
                  .filter(local => isCustomName(local) && propertyNames.has(local) && !visited.has(local))

          graph.push(...dependencies.map(dep => [name, dep]))
        }

        sorted = toposort(graph)
        nodes.sort((a, b) => {
          return sorted.indexOf(b.name) - sorted.indexOf(a.name)
        })

      } else {

        nodes.sort((a, b) => b.writePriority - a.writePriority)

      }

    }

    this._localSortedNodes = [keys, native, custom, deferred].reduce(
      (array, group) => array.concat(group),
      []
    )

  }

  return this._localSortedNodes

}

DocumentDefinition.prototype._orderedWrite = function(ac, documentNode, document, input, filter, options, callback) {

  input = isSet(input) ? input : {}

  if (!isSet(document.$wroteDefaults)) {
    document.$wroteDefaults = {}
  }

  const { isNew } = document,
        { properties } = documentNode,
        defaults = (isNew && !document.$wroteDefaults[this.docpath]) ? documentNode._getNodesWithDefaults() : null,
        map = new Map(),
        uniqueKeyNode = this.uniqueKey && documentNode.findNode(this.uniqueKey)

  let writes,
      sorted

  // for new documents, write defaults prior to values.
  if (defaults) {
    for (const { node, defaultValue, defaults: subDefaults } of defaults) {
      if (isSet(defaultValue) || isSet(subDefaults)) {
        const entry = { node, defaultValue, defaults: subDefaults }
        if (isSet(subDefaults) && !isPlainObject(input[node.name])) {
          entry.value = {}
        }
        map.set(node.name, entry)
      }
    }
    document.$wroteDefaults[this.docpath] = true
  }

  // add nodes from input
  for (const [path, value] of Object.entries(input)) {
    if (!filter || filter(path)) {
      const node = properties.hasOwnProperty(path) && properties[path]
      if (!node) {
        if (!ac.passive) {
          return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: `${this.fullpath}${this.fullpath ? '.' : ''}${path}` }))
        }
      } else {
        const entry = map.get(path)
        if (!entry) {
          map.set(node.name, { node, value })
        } else {
          entry.value = value
        }
      }
    }
  }

  writes = Array.from(map.values())

  // order writes
  try {
    sorted = documentNode._getLocalSortedNodes(uniqueKeyNode)
  } catch (err) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: err.reason || err.message })) // nested path write expects and object payload.
  }

  writes.sort((a, b) => sorted.indexOf(a.node) - sorted.indexOf(b.node))

  // perform writes
  async.eachSeries(
    writes,
    ({ node, defaultValue, value }, callback) => {
      setImmediate(() => {
        if (isSet(defaultValue)) {
          let err
          node._writeDefaultValue(ac, document, options)
            .catch(e => {
              err = e
              err.path = node.fqpp
            })
            .then(() => {
              if (err || value === Undefined) {
                return callback(err)
              }
              node.aclWrite(ac, document, value, options, callback)
            })
        } else {
          node.aclWrite(ac, document, value, options, callback)
        }
      })
    },
    (err, result) => setImmediate(callback, err, result)
  )

}

DocumentDefinition.prototype._writeSingleValue = function(ac, parentDocument, value, options, callback) {

  ac.setResource(this.getResourcePath(ac, parentDocument))

  if (!_.isObject(value)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'Illegal primitive. Expected an object.' })) // nested path write expects and object payload.
  }

  this._orderedWrite(ac, this, parentDocument, value, null, options, callback)

}

DocumentDefinition.prototype._writeArrayValues = function(ac, parentDocument, array, options, callback) {

  if (!_.isArray(array)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'Array expected.' }))
  }

  // reset array if there are no updates.
  let current,
      updating = _.some(array, function(value) {
        return utils.getIdOrNull(utils.path(value, '_id'))
      }),
      isPutting = !options.mergeDocuments && !updating && ac.method === 'put' && this.writable,
      isOverwriting = options.mergeDocuments && this.mergeOverwrite && !updating

  if (!options.updating && (isPutting || isOverwriting)) {
    ac.markSafeToUpdate(this)
    utils.array(utils.path(parentDocument, this.docpath)).forEach((doc, index) => this.onRemovingValue(ac, parentDocument, doc, index))
    utils.path(parentDocument, this.docpath, [])
  }

  current = utils.path(parentDocument, this.docpath)

  // write each document
  async.eachSeries(array, (payload, callback) => {

    this._writeDocument(ac, parentDocument, current, payload, { ...options, updating: false }, callback)

  }, function(err) {

    // bubble up any setter errors caused by the write.
    if (!err) {
      err = modules.db.getDocumentSetError(parentDocument)
    }
    callback(err)

  })

}

DocumentDefinition.prototype.onValueAdded = function(ac, parentDocument, value, previous, index) {

  PropertyDefinition.prototype.onValueAdded.call(this, ac, parentDocument, value, previous, index)

  // re-index all sub-properties in a new document.
  if (value.isNew) {
    for (let name in this.properties) {
      if (this.properties.hasOwnProperty(name)) {
        this.properties[name]._checkShouldReIndex(ac, value)
      }
    }
  }

}

/**
 * @param ac
 * @param parentDocument
 * @param value
 * @param index a specific index. if not present and an array, assume a pull was made and all matching items will be removed, affecting multiple indexes.
 */
DocumentDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index) {

  // notify child elements.
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      const node = this.properties[name],
            current = utils.path(value, node.docpath)
      if (current !== undefined) {
        if (node.array) {
          utils.array(current).forEach(node.onRemovingValue.bind(node, ac, value))
        } else {
          node.onRemovingValue(ac, value, current)
        }
      }
    }
  }
  PropertyDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, value, index)
}

DocumentDefinition.prototype._getNodesWithDefaults = function() {

  if (this._nodesWithDefaults === Undefined) {
    const nodes = []
    for (const node of Object.values(this.properties)) {
      let entry = null
      if (isSet(node.defaultValue)) {
        entry = { node, defaultValue: node.defaultValue }
      }
      if (!node.array && node.getTypeName() === 'Document') {
        const defaults = node._getNodesWithDefaults()
        if (defaults) {
          entry = Object.assign(entry || { node }, { defaults })
        }
      }
      if (entry) {
        nodes.push(entry)
      }
    }
    this._nodesWithDefaults = nodes.length ? nodes : null
  }
  return this._nodesWithDefaults

}

DocumentDefinition.prototype._writeDocument = function(ac, parentDocument, currentArray, payload, options, callback) {

  let added,
      docIdx,
      uniqueKey,
      uniqueKeyNode,
      path,
      docId,
      arrayDocument,
      foundUsingUniquekey = false

  if (!payload) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fqpp, reason: 'Document object expected.' }))
  }

  docId = payload._id
  uniqueKeyNode = this.uniqueKey && this.findNode(this.uniqueKey)
  uniqueKey = uniqueKeyNode && payload[this.uniqueKey]
  if (docId || uniqueKey) {
    if (docId) {
      arrayDocument = utils.findIdInArray(currentArray, '_id', docId)
      if (!arrayDocument) {
        return callback(Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: this.fullpath + '.' + docId }))
      }
    } else if (uniqueKey) {
      arrayDocument = currentArray.find(v => uniqueKeyNode.equals(v && v[this.uniqueKey], uniqueKey))
      docId = arrayDocument && arrayDocument._id
      foundUsingUniquekey = !!arrayDocument
    }
  }

  // if there is a custom item writer, use it, then replace the doc at the specified index.
  if (this.docWriter) {

    const done = (err, result) => {

      // skip writing for undefined results and virtuals
      if (err || result === undefined || this.virtual) {
        return callback(err)
      }

      // allow the writer to assign its own docId (but not reassign). @todo careful to never expose this to scripts!
      if (docId) {
        result._id = docId
      } else {
        docId = utils.isId(result._id) ? result._id : (result._id = utils.createId())
      }

      // push or replace.
      let docIdx = utils.findIdPos(currentArray, '_id', docId)
      if (docIdx === -1) {
        this._pushValue(ac, parentDocument, currentArray, result)
        docIdx = currentArray.length - 1
        this.onValueAdded(ac, parentDocument, currentArray[docIdx], undefined, docIdx)
        if (this.maxItems >= 0) {
          while (currentArray.length > 0 && this.maxShift && currentArray.length > this.maxItems) {
            this.onRemovingValue(ac, parentDocument, currentArray[0], 0)
            currentArray.shift()
          }
        }
      } else {
        let current = currentArray[docIdx]
        if (current !== undefined) {
          this.onRemovingValue(ac, parentDocument, current, docIdx, true)
        }
        this._setArrayValue(ac, parentDocument, currentArray, docIdx, result)
        this.onValueAdded(ac, parentDocument, currentArray[docIdx], current, docIdx)
        ac.markSafeToUpdate(this)
      }

      // bubble up any setter errors caused by the write.
      err = modules.db.getDocumentSetError(parentDocument)

      callback(err)

    }

    if (this.docWriter.length > 4) {
      this.docWriter.call(parentDocument, ac, this, payload, options, done)
    } else {
      try {
        done(null, this.docWriter.call(parentDocument, ac, this, payload, options))
      } catch (err) {
        done(err)
      }
    }

  } else {

    // lookup or add the array document (after we know there are no obvious path errors)
    // here we need to add in in advance for the individual property writers can affect the document.
    docId = arrayDocument ? arrayDocument._id : payload._id

    added = !docId

    if (added) {
      this._pushValue(ac, parentDocument, currentArray, {
        _id: (docId = utils.createId())
      })
      if (this.maxItems >= 0) {
        while (currentArray.length > 0 && this.maxShift && currentArray.length > this.maxItems) {
          currentArray.shift()
        }
      }
    }

    docIdx = utils.findIdPos(currentArray, '_id', docId)
    arrayDocument = docIdx === -1 ? undefined : currentArray[docIdx]

    if (!arrayDocument) {
      return callback(Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: this.fullpath + '.' + docId }))
    }

    ac.setResource(this.getResourcePath(ac, arrayDocument))

    if (options.onWrite) {
      options.onWrite(ac, this, parentDocument, arrayDocument, docIdx)
    }

    if (payload.hasOwnProperty(path) && !(path === '_id' || (foundUsingUniquekey && path === this.uniqueKey))) {

    }
    this._orderedWrite(
      ac,
      this,
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

}

DocumentDefinition.prototype._removeProperty = function(ac, parentDocument, callback) {

  if (this.array) {
    return PropertyDefinition.prototype._removeProperty.call(this, ac, parentDocument, callback)
  }

  return callback(Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'Documents with properties cannot be removed.' }))

}

DocumentDefinition.prototype._indexOf = function(parentDocument, documentId) {

  if (this.array) {
    const current = utils.path(parentDocument, this.docpath)
    if (_.isArray(current)) {
      return utils.findIdPos(current, '_id', documentId)
    }
  }
  return -1

}

DocumentDefinition.prototype._doRemoveDocument = function(ac, parentDocument, documentId) {

  const current = utils.path(parentDocument, this.docpath),
        docIdx = utils.findIdPos(current, '_id', documentId),
        doc = current[docIdx]

  if (!_.isArray(current)) {
    throw Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath })
  }
  if (docIdx === -1 || !doc) {
    throw Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: this.fullpath + '.' + documentId })
  }

  this.onRemovingValue(ac, parentDocument, doc, docIdx)
  current.pull(doc)

}

DocumentDefinition.prototype._pullDocument = function(ac, parentDocument, documentId, callback) {

  // run the pull to transform the removed item, which might end up being undefined (cancelling the removal)
  const done = function(err, documentId) {

    if (!err) {
      if (documentId !== undefined && !this.virtual) {

        // re-cast value. it may have been modified by the puller.
        documentId = utils.getIdOrNull(documentId)
        if (!documentId) {
          err = Fault.create('cortex.invalidArgument.invalidObjectId', { resource: ac.getResource(), path: this.fullpath + '._id' })
        } else {
          try {
            this._doRemoveDocument(ac, parentDocument, documentId)
            // bubble up any setter errors caused by the write.
            err = modules.db.getDocumentSetError(parentDocument)
          } catch (e) {
            err = e
          }
        }
      }
    }
    callback(err)

  }.bind(this)

  if (!this.puller) {
    done(null, documentId)
  } else if (this.puller.length > 4) {
    this.puller.call(parentDocument, ac, this, documentId, {}, done)
  } else {
    try {
      done(null, this.puller.call(parentDocument, ac, this, documentId, {}))
    } catch (err) {
      done(err)
    }
  }
}

DocumentDefinition.prototype.findDocumentTargetNode = function(doc) {
  return this
}

DocumentDefinition.prototype._pullDocumentElement = function(ac, parentDocument, documentId, value, callback) {

  const current = utils.path(parentDocument, this.docpath),
        doc = utils.findIdInArray(current, '_id', documentId),
        targetNode = this.findDocumentTargetNode(doc)

  if (!_.isArray(current)) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath }))
  }
  if (!doc) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.document', { resource: ac.getResource(), path: this.fullpath + '.' + documentId }))
  }
  if (!targetNode) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'Document node not found' }))
  }

  // find the document property node
  value = String(value)

  let idx = value.indexOf('.'),
      prefix = ~idx ? value.substr(0, idx) : value,
      suffix = ~idx ? value.substr(idx + 1) : undefined,
      node = targetNode.properties[prefix]

  if (!node) {
    return callback(ac.passive ? null : Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: targetNode.fullpath + '.' + suffix, reason: 'Element not found' }))
  }

  node.aclRemove(ac, doc, suffix, callback)

}

DocumentDefinition.prototype._removeElement = function(ac, parentDocument, value, callback) {

  value = String(value)

  let idx = value.indexOf('.'),
      prefix = ~idx ? value.substr(0, idx) : value,
      suffix = ~idx ? value.substr(idx + 1) : undefined

  if (!parentDocument.isSelected(this.docpath)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'A required property was not loaded. Please context support', path: this.fqpp }))
  }

  if (this.array) {

    // ensure the target document array value is sane. in this case, we have to be sure the whole thing was loaded, so don't mark as safe to update.
    let current = utils.path(parentDocument, this.docpath),
        documentId = utils.getIdOrNull(prefix)

    if (current === undefined || !_.isArray(current)) {
      utils.path(parentDocument, this.docpath, current === undefined ? [] : [current])
    }

    // the value must be an identifier.
    if (!documentId) {
      if (this.uniqueKey) {
        const uniqueKeyNode = this.findNode(this.uniqueKey),
              found = uniqueKeyNode && current.find(v => uniqueKeyNode.equals(v && v[this.uniqueKey], prefix))
        if (found) {
          documentId = found._id
        }
      }
      if (!documentId) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), path: this.fullpath, reason: 'Elements can only be removed by _id for path ' + this.fullpath }))
      }
    }

    if (suffix === undefined) {
      // pull individual document.
      this._pullDocument(ac, parentDocument, documentId, callback)
    } else {
      // remove something from an existing document.
      this._pullDocumentElement(ac, parentDocument, documentId, suffix, callback)
    }

  } else {

    const node = this.properties.hasOwnProperty(prefix) && this.properties[prefix]
    if (!node) {
      return callback(ac.passive ? null : Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fullpath + '.' + prefix }))
    }
    node.aclRemove(ac, parentDocument, suffix, callback)

  }

}

/**
 *
 * @param fn
 *      return -1 t0 false to cancel
 *      return -2 to skip children
 *      return -3 to skip siblings
 *
 * @returns {*}
 */
DocumentDefinition.prototype.walk = function(fn) {
  let ret = PropertyDefinition.prototype.walk.call(this, fn)
  if (ret === -1 || ret === false || ret === -2) {
    return ret
  }
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      let _ret = this.properties[name].walk(fn)
      if (_ret === -1 || _ret === false) {
        return _ret
      } else if (_ret === -3) {
        break
      }
    }
  }
  return ret
}

DocumentDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  // CTXAPI-1588 - top-level mongoose arrays must be fully loaded due to mongoose-js behaviour
  if (this.root === this.parent && this.array && options?.forUpdate) {
    selections[this.docpath] = true
  }

  // collect all dependencies at this level.
  if (!path) {

    PropertyDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, null, options)

    // @todo https://github.com/Medable/MedableAPI/issues/264
    // loading the whole thing, so check if we need to load the index if there are any children that are indexed.
    // OR to keep it simple, just load the whole index to be on the safe side.
    selections.idx = true

    return
  }

  const idx = path.indexOf('.'),
        prefix = ~idx ? path.substr(0, idx) : path,
        suffix = ~idx ? path.substr(idx + 1) : undefined,
        child = this.properties.hasOwnProperty(prefix) && this.properties[prefix]

  if (child) {
    child.collectRuntimePathSelections(principal, selections, suffix, options)
  } else if (this.parent) {
    PropertyDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, null, options)
  }

}

DocumentDefinition.prototype.eachChild = function(fn) {
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      fn(this.properties[name])
    }
  }
}

DocumentDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  PropertyDefinition.prototype.initNode.call(this, root, parent, initializingASetDocument, isSetProperty)

  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      const property = this.properties[name]
      // if the document node being initialized is a document type in a set, then set isSetProperty to true, so the property knows it's part of a Set.
      property.initNode(root, this, false, initializingASetDocument)
    }
  }

}

DocumentDefinition.prototype.castForQuery = function(ac, value) {
  throw Fault.create('cortex.invalidArgument.castError', { resource: ac.getResource(), reason: 'Could not cast "' + value + '" to Document.', path: this.fullpath })
}

/**
 *
 * @param doc
 * @param fn if fn returns false, processing stops.
 * @returns
 */
DocumentDefinition.prototype.walkDocument = function(doc, fn, options) {

  if (_.isFunction(fn) && doc) {
    options = options || {}

    const filter = options.filter && toArray(options.filter, true)

    let property, value, isSet, isDoc, ret
    for (const name in this.properties) {
      if ((!filter || filter.includes(name)) && this.properties.hasOwnProperty(name)) {

        property = this.properties[name]
        isDoc = property.getTypeName() === 'Document'
        isSet = !isDoc && property.getTypeName() === 'Set'
        value = utils.path(doc, property.docpath)

        if (isDoc || isSet) {
          // walk each document.
          if (_.isArray(value)) {
            let endAfter = false
            for (const doc of value) {
              ret = property.walkDocument(doc, fn, options)
              if (ret === -1) {
                return ret
              } else if (ret === -2) {
                endAfter = true
              }
            }
            if (endAfter) {
              return -1
            }
          } else {
            ret = property.walkDocument(doc, fn, options)
            if (ret === -1) {
              return ret
            }
          }
        } else {
          ret = fn(doc, property, value)
          if (ret === -1 || ret === -2) {
            return ret
          }
        }
      }
    }
  }

}

DocumentDefinition.prototype.findNode = function(path) {

  let suffix, idx = path.indexOf('.'), node
  if (~idx) {
    suffix = path.substr(idx + 1)
    path = path.substr(0, idx)
  }

  node = this.properties.hasOwnProperty(path) && this.properties[path]
  if (node && suffix) {
    return node.findNode(suffix)
  }
  return node
}

/**
 *
 * @param path
 * @param into
 * @param options
 *  stopAt - a function to test nodes along the path. if it returns true, the node along the path if returned.
 * @returns {*}
 */
DocumentDefinition.prototype.findNodes = function(path, into, options) {

  options = options || {}

  let suffix, idx = path.indexOf('.'), node, stopAt = _.isFunction(options.stopAt) ? options.stopAt : null
  if (~idx) {
    suffix = path.substr(idx + 1)
    path = path.substr(0, idx)
  }

  node = this.properties.hasOwnProperty(path) && this.properties[path]

  if (node) {
    if (suffix) {
      if (stopAt && stopAt(node)) {
        into.push(node)
      } else {
        node.findNodes(suffix, into, options)
      }
    } else {
      if (options.mergeIdenticalProperties) {
        if (into.filter(function(prop) {
          return modules.db.definitions.nodesAreIdentical(prop, node)
          // let type = prop.getTypeName();
          // return type == node.getTypeName() && prop.array == node.array && ~['Boolean', 'Date', 'Number', 'ObjectId', 'String'].indexOf(type)
        }).length) {
          return into
        }
      }
      into.push(node)
    }
  }
  return into

}

DocumentDefinition.prototype.findNodeById = function(id) {
  let property
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      property = this.properties[name]
      if (utils.equalIds(property._id, id)) {
        return property
      }
      if (_.isFunction(property.findNodeById)) {
        property = property.findNodeById(id)
        if (property) {
          return property
        }
      }
    }
  }
}

DocumentDefinition.prototype.findNodeByFqpp = function(fqpp) {
  let property
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      property = this.properties[name]
      if (property.fqpp === fqpp) {
        return property
      }
      if (_.isFunction(property.findNodeByFqpp)) {
        property = property.findNodeByFqpp(fqpp)
        if (property) {
          return property
        }
      }
    }
  }
}

DocumentDefinition.getProperties = function(depth, props, Type, { exclude = [] } = {}) {
  return [
    { name: 'array', default: false, creatable: true },
    { name: 'uniqueValues', default: false, writable: false },
    { name: 'indexed', default: false, writable: false },
    { name: 'history', default: false, writable: false },
    { name: 'unique', default: false, writable: false },
    { name: 'auditable', default: false, writable: false },
    makeUniqueKey(),
    {
      // update validators
      name: 'minItems',
      validators: [{
        name: 'number',
        definition: { min: 0, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
      }]
    }, {
      // update validators
      name: 'maxItems',
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
    },
    {
      label: 'Properties',
      name: 'properties',
      // description: 'Properties defined for a document',
      type: 'Set',
      maxItems: 100,
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
    }]
}

DocumentDefinition.getMappingProperties = function(depth) {
  return [{
    label: 'Properties',
    name: 'properties',
    type: 'Set',
    discriminatorKey: 'type',
    uniqueProp: 'name',
    documents: modules.db.definitions.createSetMappingProperties(depth - 1)
  }]
}

DocumentDefinition.prototype.export = async function(ac, doc, resourceStream, parentPath, options) {

  options = options || {}

  const propertyIncludes = options.propertyIncludes,
        resourcePath = this.isSetDocument ? parentPath : this.getExportResourcePath(parentPath, options),
        isTopLevel = parentPath === this.getExportResourcePath(parentPath, options),
        isExportable = this.isExportable(ac, doc, resourceStream, resourcePath, parentPath, options),
        required = isTopLevel && propertyIncludes ? false : isExportable,
        uniqueKeyNode = this.uniqueKey && this.findNode(this.uniqueKey)

  if (!isExportable) {
    return Undefined
  }

  let result = [],
      index = 0,
      allRejected = null // init in the loop. detect is all were likely rejected. if so, return Undefined instead of []

  options = {
    ...options,
    required
  }

  for (const val of utils.array(doc, !this.array)) {

    const documentResourcePath = (this.array && !this.isSetDocument) ? utils.joinPaths(resourcePath, index) : resourcePath
    index = index += 1

    if (allRejected === null) {
      allRejected = true
    }

    if (!isPlainObject(val)) {
      continue
    }

    for (const key of Object.keys(val)) {

      const node = this.properties.hasOwnProperty(key) && this.properties[key],
            prop = node && await node.export(
              ac,
              pathTo(val, node.path),
              resourceStream,
              documentResourcePath,
              { ...options, required: node === uniqueKeyNode ? true : options.required }
            )

      if (!node || prop === Undefined) {
        delete val[key]
      } else {
        val[key] = prop
      }
      if (prop !== Undefined) {
        allRejected = false
      }
    }

    delete val._id

    if (Object.keys(val).length) {
      result.push(utils.sortKeys(val))
    }

  }

  if (allRejected) {
    return Undefined
  }

  // https://jira.devops.medable.com/browse/CTXAPI-978 - sorting causes more problems than it solves.
  // if (this.uniqueKey) {
  //   const uniqueKeyNode = this.findNode(this.uniqueKey)
  //   if (uniqueKeyNode) {
  //     result.sort((a, b) => uniqueKeyNode.compare(a[this.uniqueKey], b[this.uniqueKey]))
  //   }
  // }

  return this.array
    ? result
    : result[0]

}

DocumentDefinition.prototype.import = async function(ac, doc, resourceStream, parentPath, options) {

  const resourcePath = this.isSetDocument ? parentPath : this.getExportResourcePath(parentPath, options),
        required = this.isImportable(ac, doc, resourceStream, resourcePath, parentPath, options)

  options = {
    ...options,
    nodePath: Undefined,
    required
  }

  let result = [],
      index = 0,
      allRejected = null // init in the loop. detect is all were likely rejected. if so, return Undefined instead of []

  for (const val of utils.array(doc, !this.array)) {

    const documentResourcePath = (this.array && !this.isSetDocument) ? utils.joinPaths(resourcePath, index) : resourcePath
    index = index += 1

    if (allRejected === null) {
      allRejected = true
    }

    if (!isPlainObject(val)) {
      continue
    }

    for (const key of Object.keys(val)) {
      const node = this.properties.hasOwnProperty(key) && this.properties[key],
            prop = node && await node.import(
              ac,
              pathTo(val, node.path),
              resourceStream,
              documentResourcePath,
              options
            )

      if (!node || prop === Undefined) {
        delete val[key]
      } else {
        val[key] = prop
      }

      if (prop !== Undefined) {
        allRejected = false
      }

    }
    delete val._id
    result.push(val)
  }

  if (allRejected) {
    return Undefined
  }

  return this.array
    ? result
    : result[0]

}

module.exports = DocumentDefinition
