'use strict'

const DocumentDefinition = require('./types/document-definition'),
      utils = require('../../../utils'),
      { naturalCmp, rString, couldBeId, isSet, joinPaths, isPlainObject } = utils,
      Fault = require('cortex-service/lib/fault'),
      util = require('util'),
      firstBy = require('thenby'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      { parseAcl } = require('../../../acl-util'),
      modules = require('../../../modules')

let Undefined

function validateTarget(ac, node, value, callback) {

  value = utils.getIdOrNull(value)
  if (!value) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectdId expected.' }))
  }

  switch (this.type) {
    case acl.AccessTargets.OrgRole:
      if (~utils.findIdPos(ac.org.roles, '_id', value)) {
        callback(null)
      } else {
        callback(Fault.create('cortex.invalidArgument.unspecified', { reason: value + ' is not a valid org role.' }))
      }
      break
    case acl.AccessTargets.Account:
      if (utils.equalIds(value, acl.AnonymousIdentifier) || utils.equalIds(value, acl.PublicIdentifier)) {
        return callback(null)
      }
      modules.db.models.Account.getAccessContext(ac.principal, value, function(err) {
        callback(err)
      })
      break
    default:
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid access target. Must be Account (1) or Role(3)' }))
      break
  }

}

function validateTargetAllowingNull(ac, node, value, callback) {
  if (value == null) {
    return callback(null)
  }
  validateTarget.call(this, ac, node, value, callback)
}

function AclDefinition(options) {

  const properties = [],
        forCreate = !!utils.option(options, 'forCreate', false),
        forShare = !!utils.option(options, 'forShare', false),
        forReference = !!utils.option(options, 'forReference', false),
        withExpressions = !!utils.option(options, 'withExpressions', false)

  this.forCreate = forCreate
  this.forShare = forShare
  this.forReference = forReference
  this.withExpressions = withExpressions

  if (utils.option(options, 'includeId', false)) {
    properties.push({
      label: '_id',
      name: '_id',
      type: 'ObjectId',
      readable: true,
      auto: true
    })
  }

  if (withExpressions) {
    properties.push({
      label: 'Expression',
      name: 'expression',
      type: 'Expression',
      readAccess: acl.Inherit,
      writable: true
    })
  }

  if (forCreate) {

    // create acl has only account or role targets and a single allow level of "public"
    properties.push({
      label: 'Type',
      name: 'type',
      type: 'Number',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.target', '.allow'],
      validators: [{
        name: 'required'
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid acl.AccessTargets value',
          validator: function(ac, node, value) {
            return withExpressions
              ? [acl.EntryTypes.Account, acl.EntryTypes.Role, acl.EntryTypes.Expression].includes(value)
              : [acl.EntryTypes.Account, acl.EntryTypes.Role].includes(value)
          }
        }
      }]
    }, {
      label: 'Target',
      name: 'target',
      type: 'ObjectId',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.type'],
      validators: [{
        name: 'required',
        definition: {
          when: function() {
            return this.type !== acl.EntryTypes.Expression
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid target, which must be an existing Account or Role',
          validator: validateTarget,
          when: function() {
            return this.type !== acl.EntryTypes.Expression
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Expressions must have a null target',
          validator: (ac, node, value) => !isSet(value),
          when: function() {
            return this.type === acl.EntryTypes.Expression
          }
        }
      }],
      set: function(v) {
        if (v === 'null' || v === false) return null
        return v
      }
    }, {
      label: 'Allow',
      name: 'allow',
      type: 'Number',
      readable: true,
      writable: true,
      default: acl.AccessLevels.Min,
      readAccess: acl.Inherit,
      writer: function() {
        return acl.AccessLevels.Min
      }
    })

  } else if (forShare) {

    // share acl is used to determine share levels. type
    properties.push({
      label: 'Type',
      name: 'type',
      type: 'Number',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.target'],
      validators: [{
        name: 'required'
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid acl.AccessTargets value',
          validator: function(ac, node, value) {
            return _.contains([acl.EntryTypes.Account, acl.EntryTypes.Role], value)
          },
          when: function() {
            return utils.isId(this.target)
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid access principal type (Owner or Self for accounts)',
          validator: function(ac, node, value) {
            return [acl.EntryTypes.Owner, acl.EntryTypes.Self].includes(value)
          },
          when: function() {
            return !isSet(this.target)
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid access level',
          validator: function(ac, node, value) {
            return value === acl.EntryTypes.Access
          },
          when: function() {
            return utils.isInt(this.target)
          }
        }
      }]
    }, {
      label: 'Target',
      name: 'target',
      type: 'Any',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.type'],
      serializeData: false,
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A valid target',
          validator: function(ac, node, value, callback) {

            if (utils.isInt(value)) {
              if (value >= acl.AccessLevels.Share && value <= acl.AccessLevels.Delete) {
                callback(null, true)
              } else {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `Access level must be between ${acl.AccessLevels.Share} and ${acl.AccessLevels.Delete}, inclusive.` }))
              }
            } else if (utils.isId(value)) {
              return validateTarget.call(this, ac, node, value, callback)
            } else {
              if (this.type === acl.EntryTypes.Access) {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `Access acl entry type expects and integer between ${acl.AccessLevels.Share} and ${acl.AccessLevels.Delete}, inclusive.` }))
              } else {
                callback(null, value === null)
              }
            }
          }
        }
      }],
      writer: function(ac, node, value) {
        this.markModified('type')
        if (value === 'null' || value === false) {
          return null
        }
        if (utils.couldBeId(value)) {
          return utils.getIdOrNull(value)
        }
        return value
      }
    }, {
      // 'The access level to grant or the role to grant',
      label: 'Allow',
      name: 'allow',
      type: 'Any',
      readable: true,
      writable: true,
      serializeData: false,
      readAccess: acl.Inherit,
      default: acl.AccessLevels.Public,
      writer: function(ac, node, value) {
        if (utils.couldBeId(value)) {
          return utils.getIdOrNull(value)
        }
        return value
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            if (utils.isInt(value)) {
              if (value >= acl.AccessLevels.Public && value <= acl.AccessLevels.Delete) {
                callback(null, true)
              } else {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `Access level must be between ${acl.AccessLevels.Public} and ${acl.AccessLevels.Delete}, inclusive.` }))
              }
            } else if (utils.isId(value)) {
              if (~utils.findIdPos(ac.org.roles, '_id', value)) {
                callback(null, true)
              } else {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: value + ' is not a valid org role.' }))
              }
            } else {
              return callback(null, false)
            }
          }
        }
      }]
    })

  } else {

    // default acl definition and runtime instance acl entries.
    properties.push({
      label: 'Type',
      name: 'type',
      type: 'Number',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.target'],
      validators: [{
        name: 'required'
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid acl.AccessTargets value',
          validator: function(ac, node, value) {
            return _.contains([acl.AccessTargets.Account, acl.AccessTargets.OrgRole], value)
          },
          when: function() {
            return !!this.target
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'A valid access principal type (Owner or Self for accounts)',
          validator: function(ac, node, value) {
            return withExpressions
              ? [acl.EntryTypes.Owner, acl.EntryTypes.Self, acl.EntryTypes.Expression].includes(value)
              : [acl.EntryTypes.Owner, acl.EntryTypes.Self].includes(value)
          },
          when: function() {
            return !this.target
          }
        }
      }]
    }, {
      label: 'Target',
      name: 'target',
      type: 'ObjectId',
      readable: true,
      writable: true,
      readAccess: acl.Inherit,
      dependencies: ['.type'],
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A valid target, which must be an existing Account or Role',
          validator: validateTargetAllowingNull
        }
      }],
      writer: function(ac, node, value) {
        this.markModified('type')
        return (value === 'null' || value === false) ? null : value
      }
    }, {
      // 'The access level to grant or the role to grant',
      label: 'Allow',
      name: 'allow',
      type: 'Any',
      readable: true,
      writable: true,
      serializeData: false,
      readAccess: acl.Inherit,
      default: acl.AccessLevels.Public,
      dependencies: ['.type'],
      writer: function(ac, node, value) {
        if (utils.couldBeId(value)) {
          return utils.getIdOrNull(value)
        }
        return value
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            if (utils.isInt(value)) {
              if (value >= acl.AccessLevels.Public && value <= acl.AccessLevels.Delete) {
                callback(null, true)
              } else {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `Access level must be between ${acl.AccessLevels.Public} and ${acl.AccessLevels.Delete}, inclusive.` }))
              }
            } else if (utils.isId(value)) {
              if (~utils.findIdPos(ac.org.roles, '_id', value)) {
                callback(null, true)
              } else {
                callback(Fault.create('cortex.invalidArgument.unspecified', { reason: value + ' is not a valid org role.' }))
              }
            } else if (withExpressions && !isSet(value)) {
              return callback(null, true)
            } else {
              return callback(null, false)
            }
          }
        }
      }]
    })

  }

  // property acl adds the ability to use pacl for expansions only.
  if (forReference) {

    properties.push({
      label: 'Property Identifier',
      // description: 'The property paths for which this entry will apply. An empty array, will apply the acl to all properties.',
      name: 'paths',
      type: 'String',
      array: true,
      readable: true,
      writable: true,
      canPush: true,
      canPull: true,
      readAccess: acl.Inherit,
      uniqueValues: true,
      dependencies: ['..sourceObject'],
      pusher: function(ac, node, values) {
        return values.map(function(path) {
          return utils.normalizeObjectPath(path, true, true, true)
        })
      },
      writer: function(ac, node, values) {
        return node.pusher.call(this, ac, node, values)
      },
      validators: [{
        name: 'adhoc',
        definition: {
          validator: function(ac, node, values, callback) {
            ac.org.createObject(this.parent().sourceObject, function(err, object) {
              if (err) {
                return callback(err)
              }
              for (let i = 0; i < values.length; i++) {
                const path = values[i],
                      nodes = object.schema.node.findTypedNode(path, true) // no typed nodes are unreadable.
                if (nodes.length === 0 || nodes.filter(v => !v.readable).length) {
                  return callback(Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Reference property not found: ' + path }))
                }
                // don't allow nodes that would otherwise not be readable.
                if (nodes.filter(v => v.readAccess > acl.AccessLevels.Script).length) {
                  return callback(Fault.create('cortex.notFound.unspecified', { resource: ac.getResource(), path: node.fullpath, reason: 'Reference property cannot be accessed: ' + path }))
                }
              }
              callback()
            })
          },
          asArray: true
        }
      }]
    })
  }

  options.mergeOverwrite = true

  DocumentDefinition.call(
    this,
    utils.extend(
      true,
      {
        auditing: {
          updateSubcategory: 'access',
          changes:
          true
        }
      },
      options,
      {
        properties
      }
    )
  )
}
util.inherits(AclDefinition, DocumentDefinition)

AclDefinition.prototype.export = async function(ac, entries, resourceStream, parentPath, options) {

  const resourcePath = this.getExportResourcePath(parentPath, options)

  if (!this.isExportable(ac, entries, resourceStream, resourcePath, parentPath, options)) {
    return Undefined
  }

  let list = (await Promise.all(utils.array(entries).map(async(doc) => {

    const def = {
            type: rString(acl.EntryTypesLookup[doc.type], '').toLowerCase()
          },
          { expression } = doc

    if (this.withExpressions && isSet(expression)) {
      def.expression = expression
    }

    if (couldBeId(doc.target)) {
      def.target = await resourceStream.addMappedPrincipal(ac, doc.target, `${resourcePath}.target`, { includeResourcePrefix: false })
    } else if (isSet(doc.target)) {
      def.target = rString(acl.AccessLevelsLookup[doc.target], '').toLowerCase()
    }

    if (!this.forCreate) {
      if (couldBeId(doc.allow)) {
        def.allow = await resourceStream.addMappedPrincipal(ac, doc.allow, `${resourcePath}.allow`, { includeResourcePrefix: false })
      } else if (isSet(doc.allow)) {
        def.allow = rString(acl.AccessLevelsLookup[doc.allow], '').toLowerCase()
      }
    }

    if (this.forReference) {
      def.paths = utils.array(doc.paths).sort(utils.naturalCmp)
    }

    return utils.sortKeys(def)

  }))).sort(

    firstBy((a, b) => {
      return naturalCmp(rString(a.type, ''), rString(b.type, ''))
    })
      .thenBy((a, b) => {
        return naturalCmp(rString(a.expression, ''), rString(b.expression, ''))
      })
      .thenBy((a, b) => {
        return naturalCmp(rString(a.target, ''), rString(b.target, ''))
      })
      .thenBy((a, b) => {
        return naturalCmp(rString(a.allow, ''), rString(b.allow, ''))
      })

  )

  return list.map(def => {

    // if we can't write shorthand, output an object
    if (
      (isSet(def.type) && def.type.includes('.')) ||
      (isSet(def.target) && def.target.includes('.')) ||
      (isSet(def.allow) && def.allow.includes('.')) ||
      (isSet(def.paths) && def.paths.some(path => path.includes(','))) ||
      isPlainObject(def.expression)
    ) {

      return def

    }

    // gtg shorthand
    let shorthand = joinPaths(def.type, def.type === 'expression' ? def.expression : def.target)
    if (def.allow) {
      shorthand += `.${def.allow}`
    }
    if (isSet(def.paths) && def.paths.length) {
      shorthand += `,${def.paths.join(',')}`
    }

    return shorthand

  })

}

AclDefinition.prototype.import = async function(ac, values, resourceStream, parentPath, options) {

  if (values === Undefined) {
    return Undefined
  }

  const resourcePath = this.getExportResourcePath(parentPath, options),
        entries = JSON.parse(JSON.stringify(utils.array(values, _.isString(values))))

  if (!this.isImportable(ac, entries, resourceStream, resourcePath, parentPath, options)) {
    return Undefined
  }

  return parseAcl(
    ac,
    entries,
    {
      forReference: this.forReference,
      forCreate: this.forCreate,
      principalResolver: async(ac, principalType, principalIdentifier) => {
        return (await resourceStream.importMappedPrincipal(ac, `${principalType}.${principalIdentifier}`, `${resourcePath}.target`))._id
      }
    }
  )

}

AclDefinition.prototype.aclWrite = function(ac, parentDocument, values, options, callback) {

  let err

  parseAcl(
    ac,
    values,
    {
      forReference: this.forReference,
      forCreate: this.forCreate
    }
  )
    .then(entries => new Promise((resolve, reject) => {
      DocumentDefinition.prototype.aclWrite.call(this, ac, parentDocument, entries, options, (err, result) => {
        err ? reject(err) : resolve(result)
      })
    })
    )
    .catch(e => {
      err = e
    })
    .then(result => {
      callback(err, result)
    })

}

module.exports = AclDefinition
