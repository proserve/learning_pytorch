const acl = require('../../../acl'),
      utils = require('../../../utils'),
      _ = require('underscore'),
      util = require('util'),
      ContextModelDefinition = require('./context-model-definition'),
      local = {
        _eq: null,
        _prop: null,
        _AclDefinition: null
      }

Object.defineProperty(local, 'ExpansionQueue', { get: function() { return (this._eq || (this._eq = require('./classes/expansion-queue'))) } })
Object.defineProperty(local, 'PropertyDefinition', { get: function() { return (this._prop || (this._prop = require('./property-definition'))) } })
Object.defineProperty(local, 'AclDefinition', { get: function() { return (this._AclDefinition || (this._AclDefinition = require('./acl-definition'))) } })

function BuiltinContextModelDefinition(objectDocument) {

  let objectOptions = this.getNativeOptions(),
      isExtension = !!objectDocument,
      postTypeDocs

  if (isExtension && !objectOptions.isExtensible) {
    // throw Fault.create('cortex.accessDenied.unspecified', {reason: 'Object "'+objectOptions.objectLabel+'" is not extensible.'});
  }

  this.__isExtension = isExtension

  objectDocument = objectDocument || {}

  objectOptions.obeyObjectMode = utils.rBool(objectOptions.obeyObjectMode, true)

  objectOptions.objectId = objectOptions._id

  objectOptions.typeMasterNode = objectDocument.typeMasterNode
  objectOptions.objectTypeName = objectDocument.objectTypeName
  objectOptions.objectTypeId = objectDocument.objectTypeId

  if (isExtension) {
    objectOptions.label = objectDocument.label
    objectOptions.sequence = objectDocument.sequence || 0
    objectOptions.slots = objectDocument.slots
  }
  objectOptions.created = objectDocument.created || new Date(-1741280400000)
  objectOptions.hasCreator = utils.option(objectOptions, 'hasCreator', true)
  objectOptions.hasOwner = utils.option(objectOptions, 'hasOwner', true)
  objectOptions.validateOwner = utils.option(objectOptions, 'validateOwner', true)
  objectOptions.isExtensible = utils.option(objectOptions, 'isExtensible', false)
  objectOptions.isFavoritable = utils.option(objectOptions, 'isFavoritable', objectDocument.isFavoritable)
  objectOptions.isDeployable = !!utils.option(objectOptions, 'isDeployable', objectDocument.isDeployable)
  objectOptions.uniqueKey = utils.option(objectOptions, 'uniqueKey', objectDocument.uniqueKey)

  if (isExtension) {
    if (objectOptions.defaultAclOverride && objectDocument.defaultAcl.length > 0) {
      objectOptions.defaultAcl = objectDocument.defaultAcl
    } else if (objectOptions.defaultAclExtend) {
      objectOptions.defaultAcl = acl.mergeAndSanitizeEntries(objectDocument.defaultAcl, objectOptions.defaultAcl)
    }
    if (objectOptions.shareChainOverride && utils.array(objectDocument.shareChain).length > 0) {
      objectOptions.shareChain = objectDocument.shareChain
    }
    if (objectOptions.shareAclOverride && utils.array(objectDocument.shareAcl).length > 0) {
      objectOptions.shareAcl = objectDocument.shareAcl
    }
    if (objectOptions.createAclOverwrite && objectDocument.createAcl.length > 0) {
      objectOptions.createAcl = objectDocument.createAcl
    } else if (objectOptions.createAclExtend) {
      objectOptions.createAcl = acl.mergeAndSanitizeEntries(objectDocument.createAcl, objectOptions.createAcl)
    }
  }

  // unequivocally allowed to bypass when bypassCreateAcl option exists.
  objectOptions.allowBypassCreateAcl = !!utils.option(objectOptions, 'allowBypassCreateAcl', objectDocument.allowBypassCreateAcl)

  // connections
  if (!isExtension || objectOptions.allowConnectionsOverride) {
    objectOptions.allowConnections = utils.rBool(objectDocument.allowConnections, !!objectOptions.allowConnections)
  }

  if (!isExtension || objectOptions.allowConnectionOptionsOverride) {
    objectOptions.connectionOptions = {
      requireAccept: utils.rBool(utils.path(objectDocument, 'connectionOptions.requireAccept'), utils.rBool(utils.path(objectOptions, 'connectionOptions.requireAccept'), true)),
      requiredAccess: acl.fixAllowLevel(utils.rInt(utils.path(objectDocument, 'connectionOptions.requiredAccess'), utils.path(objectOptions, 'connectionOptions.requiredAccess')), false, acl.AccessLevels.Share),
      sendNotifications: utils.rBool(utils.path(objectDocument, 'connectionOptions.sendNotifications'), utils.rBool(utils.path(objectOptions, 'connectionOptions.sendNotifications'), true))
    }
  }

  // merge feed definitions
  postTypeDocs = utils.array(objectDocument.feedDefinition)
  if (postTypeDocs.length > 0) {
    objectOptions.feedDefinition = postTypeDocs.concat(utils.array(utils.path(objectOptions, 'feedDefinition')))
  }

  // add non-overriding properties
  utils.array(objectDocument.properties).forEach(function(prop) {
    if (!_.find(objectOptions.properties, function(v) { return v.name === prop.name })) {
      objectOptions.properties.push(prop)
    }
  })

  ContextModelDefinition.call(this, objectOptions)

}
util.inherits(BuiltinContextModelDefinition, ContextModelDefinition)

BuiltinContextModelDefinition.prototype.getNativeOptions = function() {
  throw new Error('cortex.error.pureVirtual')
}

BuiltinContextModelDefinition.prototype.apiSchema = function(options) {

  const schema = ContextModelDefinition.prototype.apiSchema.call(this, options)

  return utils.extend(schema, {
    extensible: !!this.isExtensible,
    extended: this.__isExtension,
    custom: false
  })

}

module.exports = BuiltinContextModelDefinition
