'use strict'

const DocumentDefinition = require('./types/document-definition'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      util = require('util'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      {
        naturalCmp, sortKeys, intersectIdArrays, diffIdArrays,
        isCustomName, array: toArray, extend, inIdArray,
        path: pathTo, isSet, uniqueIdArray, promised
      } = require('../../../utils')

let Undefined

function OrgRoleDefinition(options) {

  const properties = [{
    label: '_id',
    name: '_id',
    type: 'ObjectId',
    auto: true,
    // description: 'The role identifier.',
    acl: acl.Inherit,
    readable: true
  }, {
    label: 'Deployment Identifiers',
    name: 'did',
    type: 'ObjectId',
    public: false,
    readable: false,
    array: true
  }, {
    label: 'Code',
    name: 'code',
    type: 'String',
    dependencies: ['._id'],
    acl: acl.Inherit,
    writable: true,
    trim: true,
    writer: function(ac, node, value) {
      return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
    },
    get: function(v) {
      try {
        const _id = this._id || pathTo(this.parentArray()[this.__index], '_id'),
              builtIn = consts.defaultRoles[_id]
        if (builtIn) {
          return builtIn.code
        }
      } catch (err) {
      }
      return v
    },

    validators: [{
      name: 'customName',
      definition: {
        when: function() {
          const builtIn = consts.defaultRoles[this._id]
          return builtIn && builtIn.code !== this.code
        }
      }
    }, {
      name: 'uniqueInArray'
    }, {
      name: 'adhoc',
      definition: {
        message: 'Built-in role names cannot be updated',
        validator: function(ac, node, value) {
          if (this.isModified() && consts.defaultRoles[this._id]) {
            if (value !== consts.defaultRoles[this._id].code) {
              return false
            }
          }
          return true
        }
      }
    }]
  }, {
    label: 'Name',
    name: 'name',
    type: 'String',
    // description: '',
    dependencies: [
      '._id'
    ],
    acl: acl.Inherit,
    readable: true,
    writable: true,
    trim: true,
    validators: [{
      name: 'required'
    }, {
      name: 'printableString',
      definition: { min: 1, max: 100, anyFirstLetter: false }
    }, {
      name: 'uniqueInArray'
    }, {
      name: 'adhoc',
      definition: {
        message: 'Built-in role names cannot be updated',
        validator: function(ac, node, value) {
          if (this.isModified() && consts.defaultRoles[this._id]) {
            if (value !== consts.defaultRoles[this._id].name) {
              return false
            }
          }
          return true
        }
      }
    }]
  }, {
    label: 'Scope',
    name: 'scope',
    type: 'String',
    acl: acl.Inherit,
    readable: true,
    writable: true,
    array: true,
    writeOnCreate: true,
    canPush: false,
    writer: function(ac, node, values) {
      return modules.authentication.optimizeAuthScope(values)
    },
    pusher: function(ac, node, values) {
      return modules.authentication.optimizeAuthScope(values)
    },
    validators: [{
      name: 'authScope'
    }, {
      name: 'adhoc',
      definition: {
        message: 'Built-in role scopes cannot be updated',
        validator: function() {
          return !(this.isModified() && consts.defaultRoles[this._id])
        }
      }
    }]
  }, {
    label: 'Include',
    name: 'include',
    type: 'ObjectId',
    // description: 'Custom roles may be grouped to include other custom roles. Accounts holding the role will be also considered to hold the included roles.',
    array: true,
    uniqueValues: false, // <-- false to prevent casting so we can handle string inputs.
    maxItems: 20,
    canPush: true,
    canPull: true,
    acl: acl.Inherit,
    dependencies: ['roles', '._id'],
    readable: true,
    writable: true,
    validators: [{
      name: 'adhoc',
      definition: {
        asArray: true,
        validator: function(ac, node, value) {

          const registered = ac.subject.roles.map(function(v) { return v._id }),
                builtIn = consts.defaultRoles[this._id]

          if (builtIn && diffIdArrays(builtIn.include, value).length > 0) {
            // static role includes cannot be modified.
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Built-in roles cannot be modified.' })
          } else if (!builtIn && intersectIdArrays(consts.defaultRoleIds.slice(), value).length > 0) {
            // static roles cannot be embedded.
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Built-in roles cannot be included in other roles.' })
          } else if (intersectIdArrays(registered, value).length !== value.length) {
            // don't allow inclusion of roles that do not exist.
            throw Fault.create('cortex.notFound.role', { reason: 'An included role does not exist.' })
          } else if (this._id && inIdArray(value, this._id)) {
            // don't allow inclusion of roles that would create a circular reference
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'A role cannot be included in itself.' })
          }
          return true
        }
      }
    }],
    pusher: function(ac, node, values, options) {

      return node.writer.call(this, ac, node, values, options)

    },
    writer: function(ac, node, values) {
      const roles = modules.db.getParentDocument(this).roles
      return uniqueIdArray(toArray(values, isSet(values)).map(value => {
        if (isCustomName(value)) {
          const role = roles.find(role => role.code === value)
          if (role) {
            value = role._id
          }
        }
        return value
      }))
    }
  }, {
    label: 'All',
    name: 'all',
    type: 'ObjectId',
    // description: 'A list of all included roles, including those grouped inside any included roles.',
    array: true,
    maxItems: -1,
    acl: acl.Inherit,
    maxShift: false,
    canPush: false,
    canPull: false,
    dependencies: ['roles._id', 'roles.include', 'roles.name'],
    readable: true,
    virtual: true,
    reader: function(ac) {
      return acl.expandRoles(ac.subject.roles, this.include)
    }
  }]

  DocumentDefinition.call(this, extend({}, options, { properties: properties }))
}
util.inherits(OrgRoleDefinition, DocumentDefinition)

/**
 *
 * @param ac
 * @param doc
 * @param resourceStream
 * @param parentResource
 * @param options
 *  required
 *
 * @returns {Promise<*>}
 */
OrgRoleDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `role.${doc && doc.code}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else {

    return resourceStream.updateEnvironment(async(ac) => {

      let existing = ac.org.roles.find(role => role.code && role.code === doc.code),
          def = _.pick(doc, [
            'name',
            'scope'
          ]),
          deferred = null

      if (existing) {
        def._id = existing._id
      } else {
        def.code = doc.code
      }

      if (Array.isArray(doc.include) && doc.include.length > 0) {
        deferred = doc.include
        delete doc.include
      } else {
        def.include = doc.include
      }

      ac.method = existing ? 'put' : 'post'
      await promised(this, 'aclWrite', ac, ac.org, def)
      existing = ac.org.roles.find(role => role.code && role.code === doc.code)

      if (deferred) {

        const include = []
        for (let uniqueKey of deferred) {
          include.push((await resourceStream.importMappedPrincipal(ac, `role.${uniqueKey}`, `${resourcePath}.principal`))._id)
        }

        ac.org.roles.find(role => role.code === doc.code)
        ac.method = existing ? 'put' : 'post'
        await promised(this, 'aclWrite', ac, ac.org, { _id: existing._id, include })
        existing = ac.org.roles.find(role => role.code && role.code === doc.code)
      }

      return existing

    })

  }
}

OrgRoleDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `role.${doc && doc.code}`

  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (acl.isBuiltInRole(doc._id)) { // don't export built-in roles.
    return Undefined
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  } else if (!doc.code) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
      resource: ac.getResource(),
      path: `role.${doc.name}`
    })
  } else {

    const def = _.pick(doc, [
      'code',
      'name',
      'scope'
    ])

    def.object = 'role'
    def.include = (await Promise.all(doc.include.map(async(id) => {
      return resourceStream.addMappedPrincipal(ac, id, `${resourcePath}.include`)
    }))).sort(naturalCmp)

    return resourceStream.exportResource(sortKeys(def), resourcePath)

  }

}

module.exports = OrgRoleDefinition
