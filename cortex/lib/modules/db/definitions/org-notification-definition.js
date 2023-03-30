'use strict'

const _ = require('underscore'),
      DocumentDefinition = require('./types/document-definition'),
      { capitalize } = require('inflection'),
      utils = require('../../../utils'),
      {
        array: toArray, sortKeys, naturalCmp, joinPaths,
        promised, path: pathTo
      } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      util = require('util'),
      modules = require('../../../modules'),
      consts = require('../../../consts'),
      acl = require('../../../acl')

let Undefined

function EndpointDefinition() {

  var options = {
    label: 'Endpoints',
    name: 'endpoints',
    type: 'Document',
    array: true,
    acl: acl.Inherit,
    canPush: true,
    canPull: true,
    writable: true,
    maxItems: 3,
    minItems: 1,
    writer: function(ac, node, value) {
      if (consts.Notifications.TypeMap[this._id]) {
        throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
      }
      return value
    },
    puller: function(ac, node, value) {
      if (consts.Notifications.TypeMap[this._id]) {
        throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
      }
      return value
    },
    pusher: function(ac, node, value) {
      if (consts.Notifications.TypeMap[this._id]) {
        throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
      }
      return value
    },
    properties: [
      {
        // The endpoint identifier. these will always match the id of the built-in notification.
        label: '_id',
        name: '_id',
        type: 'ObjectId',
        acl: acl.Inherit,
        readable: true,
        validators: [{
          name: 'adhoc',
          definition: {
            validator: (function() {
              var allowed = utils.getIdArray(Object.keys(consts.Notifications.EndpointMap))
              return function(ac, node, value) {
                return utils.inIdArray(allowed, value)
              }
            }()),
            skip: function() {
              return !!consts.Notifications.TypeMap[this.parent()._id]
            }
          }
        }, {
          name: 'uniqueInArray',
          definition: {
            skip: function() {
              return !!consts.Notifications.TypeMap[this.parent()._id]
            }
          }
        }]
      },
      {
        label: 'Endpoint Type',
        name: 'eid',
        type: 'ObjectId',
        auto: true,
        acl: acl.Inherit,
        readable: true,
        creatable: true,
        dependencies: ['._id'],
        get: function() {
          return this._id
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this.parent()._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          this._id = value
          return undefined
        }
      },
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        acl: acl.Inherit,
        dependencies: ['._id'],
        virtual: true,
        reader: function(ac, node, selection) {
          return utils.path(consts.Notifications.EndpointMap[this._id], 'label') || ''
        }
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        dependencies: ['._id'],
        acl: acl.Inherit,
        virtual: true,
        reader: function(ac, node, selection) {
          return utils.path(consts.Notifications.EndpointMap[this._id], 'name') || ''
        }
      },
      {
        label: 'Template',
        name: 'template',
        type: 'String',
        dependencies: ['._id'],
        acl: acl.Inherit,
        writable: true,
        reader: function(ac, node, selection) {
          const _id = this._id,
                builtinType = consts.Notifications.TypeMap[selection.parentDocument._id]
          if (builtinType) {
            const endpoint = builtinType.endpoints.filter(function(endpoint) { return utils.equalIds(endpoint._id, _id) })[0]
            if (endpoint) {
              return endpoint.template
            }
          }
          return this.template
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this.parent()._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          return value
        },
        validators: [{
          name: 'pattern',
          definition: {
            pattern: '/^[a-zA-Z0-9-_]{1,40}$/',
            skip: function() {
              return !!consts.Notifications.TypeMap[this.parent()._id]
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {
              const type = consts.Notifications.EndpointMap[this._id].name
              modules.db.models.Template.findOne({ org: ac.orgId, type: type, name: value, locale: { $in: [null, []] } }).lean().select('_id').exec((err, doc) => {
                if (!err && !doc) {
                  err = Fault.create('cortex.notFound.template')
                }
                callback(err)
              })
            },
            skip: function() {
              return !!consts.Notifications.TypeMap[this.parent()._id]
            }
          }
        }]
      },
      {
        label: 'Configurable',
        name: 'configurable',
        type: 'Boolean',
        acl: acl.Inherit,
        virtual: true,
        dependencies: ['._id', '.._id', '.state'],
        reader: function(ac, node, selection) {
          const notification = consts.Notifications.TypeMap[selection.parentDocument._id]
          if (notification) {
            const endpoint = utils.findIdInArray(notification.endpoints, '_id', this._id)
            if (endpoint && endpoint.state !== consts.Notifications.States.User) {
              return false
            }
          }
          return true
        }
      },
      {
        label: 'State',
        name: 'state',
        type: 'Number',
        dependencies: ['._id', '.._id'],
        acl: acl.Inherit,
        writable: true,
        reader: function(ac, node, selection) {
          const notification = consts.Notifications.TypeMap[selection.parentDocument._id]
          let state = this.state
          if (notification) {
            const endpoint = utils.findIdInArray(notification.endpoints, '_id', this._id)
            if (endpoint && endpoint.state !== consts.Notifications.States.User) {
              return consts.Notifications.InverseStates[endpoint.state]
            } else if (endpoint) {
              state = utils.rInt(state, endpoint.defaultUserState)
            }
          }
          return consts.Notifications.InverseStates[state == null ? consts.Notifications.States.Enabled : state]
        },
        writer: function(ac, node, value) {
          // ensure we can only set the state if available.
          const notification = consts.Notifications.TypeMap[this.parent()._id]
          if (notification) {
            const endpoint = utils.findIdInArray(notification.endpoints, '_id', this._id)
            if (endpoint && endpoint.state !== consts.Notifications.States.User) {
              throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
            }
          }
          if (!utils.isInteger(value)) {
            return consts.Notifications.States[value] == null ? value : consts.Notifications.States[value]
          }
          return value
        },
        validators: [{
          // only run this validator if the value is allowed to be written. that is, it is custom or in a User state.
          name: 'numberEnum',
          definition: {
            values: [consts.Notifications.States.Enabled, consts.Notifications.States.Disabled, consts.Notifications.States.User]
          },
          skip: function() {
            const notification = consts.Notifications.TypeMap[this.parent()._id]
            if (notification) {
              const endpoint = utils.findIdInArray(notification.endpoints, '_id', this._id)
              if (endpoint && endpoint.state !== consts.Notifications.States.User) {
                return true
              }
            }
            return false
          }
        }]
      },
      {
        name: 'defaultUserState',
        label: 'Default User State',
        type: 'Number',
        dependencies: ['._id', '.._id'],
        acl: acl.Inherit,
        writable: true,
        default: consts.Notifications.States.Enabled,
        validators: [{
          // only run this validator if the value is allowed to be written. that is, it is custom or in a User state.
          name: 'numberEnum',
          definition: {
            values: [consts.Notifications.States.Enabled, consts.Notifications.States.Disabled]
          }
        }]
      }
    ]
  }

  DocumentDefinition.call(this, options)

}
util.inherits(EndpointDefinition, DocumentDefinition)

EndpointDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  DocumentDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  selections[this.docpath] = true // avoid problems by selecting it all.

}

EndpointDefinition.prototype._prepWrite = function(ac, parentDocument, endpoints) {

  ac.markSafeToUpdate(this)

  // this is only for custom notifications. built-in notifications are already handled.
  // here, we want to allow writing of _id for new items but pin them to existing endpoints.
  // we have to do this because i screwed up and didn't assign an endpointTypeId. Instead, I used
  // the _id field. In order to avoid a patch, hello hammer. -js
  endpoints = utils.array(endpoints, true)

  if (!consts.Notifications.TypeMap[parentDocument._id]) {

    let current = utils.path(parentDocument, this.docpath)

    if (!current) {
      utils.path(parentDocument, this.docpath, [])
      current = utils.path(parentDocument, this.docpath)
    }

    for (let i = 0; i < endpoints.length; i++) {
      const id = utils.getIdOrNull(utils.path(endpoints[i], '_id'))
      if (id) {
        // if the endpoint is a built-in one and does not exist, then pre-insert so it gets updated.
        const endpoint = consts.Notifications.EndpointMap[id]
        if (endpoint) {
          if (!utils.findIdInArray(current, '_id', id)) {
            current.push({
              _id: id
            })
          }
        }
      }
    }

  }

  return endpoints

}

EndpointDefinition.prototype.aclWrite = function(ac, parentDocument, endpoints, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)

  endpoints = this._prepWrite(ac, parentDocument, endpoints)
  DocumentDefinition.prototype.aclWrite.call(this, ac, parentDocument, endpoints, options, callback)
}

function OrgNotificationDefinition() {

  var options = {
    label: 'Notifications',
    name: 'notifications',
    type: 'Document',
    uniqueKey: 'name',
    array: true,
    canPush: true,
    canPull: true,
    maxItems: 100,
    acl: acl.Inherit,
    puller: function(ac, node, value) {
      if (consts.Notifications.TypeMap[value]) {
        throw Fault.validationError('cortex.accessDenied.propertyPull', { resource: ac.getResource(), path: node.fullpath })
      }
      ac.hook('save').before(function(vars, callback) {
        if (~vars.modified.indexOf(node.fullpath)) {
          if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
            ac.object.fireHook('notification.removed.before', null, { ac: ac, notificationId: value }, callback)
          }
        }
      })
      ac.hook('save').after(function(vars) {
        if (~vars.modified.indexOf(node.fullpath)) {
          if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
            ac.object.fireHook('notification.removed.after', null, { ac: ac, notificationId: value }, () => {})
          }
        }
      })
      return value
    },
    properties: [
      {
        // The notification identifier. For built-in notifications, these match the id of the built-in notification.
        label: '_id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        acl: acl.Inherit,
        readable: true
      },
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        acl: acl.Inherit,
        writable: true,
        dependencies: ['._id'],
        reader: function(ac, node, selection) {
          if (consts.Notifications.TypeMap[this._id]) {
            return consts.Notifications.TypeMap[this._id].label
          }
          return this.label
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          return value
        },
        validators: [{
          name: 'string',
          definition: {
            min: 1,
            max: 100,
            skip: function() {
              return !!consts.Notifications.TypeMap[this._id]
            }
          }
        }]
      },
      {
        label: 'Persists',
        name: 'persists',
        type: 'Boolean',
        acl: acl.Inherit,
        writable: true,
        dependencies: ['._id'],
        reader: function(ac, node, selection) {
          if (consts.Notifications.TypeMap[this._id]) {
            return consts.Notifications.TypeMap[this._id].persists
          }
          return this.persists
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          return value
        }
      },
      {
        label: 'Allow Duplicates',
        name: 'duplicates',
        type: 'Boolean',
        acl: acl.Inherit,
        writable: true,
        dependencies: ['._id'],
        reader: function(ac, node, selection) {
          if (consts.Notifications.TypeMap[this._id]) {
            return consts.Notifications.TypeMap[this._id].duplicates
          }
          return this.duplicates
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          return value
        }
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        dependencies: ['._id'],
        acl: acl.Inherit,
        writable: true,
        trim: true,
        reader: function(ac, node, selection) {
          if (consts.Notifications.TypeMap[this._id]) {
            return consts.Notifications.TypeMap[this._id].name
          }
          return this.name
        },
        writer: function(ac, node, value) {
          if (consts.Notifications.TypeMap[this._id]) {
            throw Fault.validationError('cortex.accessDenied.propertyUpdate', { resource: ac.getResource(), path: node.fullpath })
          }
          return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
        },
        validators: [{
          name: 'required',
          definition: {
            skip: function() {
              return !!consts.Notifications.TypeMap[this._id]
            }
          }
        }, {
          name: 'customName',
          definition: {
            skip: function() {
              return !!consts.Notifications.TypeMap[this._id]
            }
          }
        }, {
          name: 'uniqueInArray',
          definition: {
            skip: function() {
              return !!consts.Notifications.TypeMap[this._id]
            }
          }
        }]
      },
      new EndpointDefinition()
    ]
  }

  DocumentDefinition.call(this, options)
}
util.inherits(OrgNotificationDefinition, DocumentDefinition)

OrgNotificationDefinition.prototype.getUserConfigurableNotifications = function(org, addNameAndLabel) {

  let current = utils.path(org, this.docpath),
      endpoints,
      endpoint,
      nLen,
      eLen

  // operate on a copy!
  current = current ? ((current.toObject && current.toObject()) || current) : []

  this.__prep(current, addNameAndLabel)

  // remove non-user configurable items.
  nLen = current.length
  while (nLen--) {
    endpoints = current[nLen].endpoints
    eLen = endpoints.length
    while (eLen--) {
      endpoint = endpoints[eLen]
      if (endpoint.state !== consts.Notifications.States.User) {
        endpoints.splice(eLen, 1)
      }
    }
    if (endpoints.length === 0) {
      current.splice(nLen, 1)
    }
  }
  return current

}

OrgNotificationDefinition.prototype.loadNotification = function(org, notificationId) {

  const systemNotification = consts.Notifications.TypeMap[notificationId],
        orgNotification = utils.findIdInArray(utils.path(org, this.docpath), '_id', notificationId),
        outputEndpoints = []

  if (systemNotification) {

    systemNotification.endpoints.forEach(function(systemEndpoint) {

      let state = null,
          orgEndpoint

      if (systemEndpoint.state === consts.Notifications.States.Enabled) {
        state = systemEndpoint.state
      } else if (systemEndpoint.state === consts.Notifications.States.User) {
        orgEndpoint = utils.findIdInArray(utils.path(orgNotification, 'endpoints'), '_id', systemEndpoint._id)
        if (orgEndpoint) {
          state = utils.rInt(orgEndpoint.state, utils.rInt(systemEndpoint.defaultUserState, consts.Notifications.States.Enabled))
        } else {
          state = utils.rInt(systemEndpoint.defaultUserState, consts.Notifications.States.Enabled)
        }
      }
      if (state != null) {
        outputEndpoints.push({
          _id: systemEndpoint._id,
          state: state,
          name: systemEndpoint.name,
          template: systemEndpoint.template
        })
      }
    })

    return {
      _id: systemNotification._id,
      persists: systemNotification.persists,
      duplicates: systemNotification.duplicates,
      endpoints: outputEndpoints
    }

  } else if (orgNotification) {

    const notification = (orgNotification.toObject && orgNotification.toObject()) || orgNotification

    if (!utils.path(org, 'configuration.scripting.enableCustomSms')) {
      utils.array(notification.endpoints).forEach(function(endpoint) {
        if (utils.equalIds(endpoint._id, consts.Notifications.Endpoints.Sms._id)) {
          endpoint.state = consts.Notifications.States.Disabled
        }
      })
    }

    notification.endpoints = utils.array(notification.endpoints).filter(function(endpoint) {
      return endpoint.state !== consts.Notifications.States.Disabled
    })

    return notification

  }

}

OrgNotificationDefinition.prototype.__prep = function(current, addNameAndLabel) {

  const types = consts.Notifications.Types
  for (let key in types) {
    if (types.hasOwnProperty(key)) {
      const type = types[key]
      let entry = utils.findIdInArray(current, '_id', type._id)
      if (!entry) {
        entry = {
          _id: type._id,
          endpoints: type.endpoints.map(function(endpoint) {
            var out = {
              _id: endpoint._id
            }
            if (addNameAndLabel) {
              out.name = consts.Notifications.EndpointMap[endpoint._id].name
              out.label = consts.Notifications.EndpointMap[endpoint._id].label
            }
            return out
          })
        }
        if (addNameAndLabel) {
          entry.name = type.name
          entry.label = type.label
        }
        current.push(entry)
      } else {
        if (addNameAndLabel) {
          entry.name = type.name
          entry.label = type.label
        }
        type.endpoints.forEach(function(endpoint) {
          var outEndpoint
          if (!(outEndpoint = utils.findIdInArray(entry.endpoints, '_id', endpoint._id))) {
            outEndpoint = {
              _id: endpoint._id
            }
            entry.endpoints.push(outEndpoint)
          }
          if (addNameAndLabel) {
            outEndpoint.name = consts.Notifications.EndpointMap[endpoint._id].name
            outEndpoint.label = consts.Notifications.EndpointMap[endpoint._id].label
          }
        })
      }
    }
  }

}

OrgNotificationDefinition.prototype.aclRead = function(ac, parentDocument, selection) {

  // inject missing built-in values. this way, newly added internal notifications don't require a patch.
  var current = utils.path(parentDocument, this.docpath)

  if (!current) {
    utils.path(parentDocument, this.docpath, [])
    current = utils.path(parentDocument, this.docpath)
  }

  this.__prep(current)

  return DocumentDefinition.prototype.aclRead.call(this, ac, parentDocument, selection)

}

OrgNotificationDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  DocumentDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  selections[this.docpath] = true // avoid problems by selecting it all.

}

OrgNotificationDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  // built-in notification endpoints cannot be written. exclude them entirely.
  if (consts.Notifications.TypeMap[doc._id]) {
    return Undefined
  }

  const resourcePath = `notification.${doc && doc.name}`,
        def = doc

  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!doc.name) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
      resource: ac.getResource(),
      path: `notification.${doc && doc.number}`
    })
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  }

  def.endpoints = (await Promise.all(toArray(doc.endpoints).map(async(endpoint) => {

    endpoint.type = consts.Notifications.EndpointMap[endpoint._id].name

    delete endpoint.eid // not required. it's legacy and the endpoint name covers it.
    delete endpoint._id

    if (endpoint.template) {
      endpoint.template = await resourceStream.addMappedTemplate(ac, endpoint.template, endpoint.type, joinPaths(resourcePath))
    }
    return sortKeys(endpoint)

  }))).filter(v => v).sort((a, b) => naturalCmp(a.name, b.name))

  def.object = 'notification'
  delete def._id

  return resourceStream.exportResource(sortKeys(def), resourcePath, resourcePath)

}

OrgNotificationDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `notification.${doc && doc.name}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {

    return Undefined

  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {

    return Undefined

  } else {

    return resourceStream.updateEnvironment(async(ac) => {

      let existing = ac.org.configuration.notifications.find(n => n.name && n.name === doc.name),
          def = _.pick(doc, [
            'label',
            'duplicates',
            'persists'
          ])

      if (existing) {
        def._id = existing._id
      } else {
        def.name = doc.name
      }

      if (Array.isArray(doc.endpoints) && doc.endpoints.length > 0) {
        def.endpoints = []
        for (const endpoint of doc.endpoints) {
          const out = _.pick(endpoint, ['label', 'name', 'state'])
          out._id = pathTo(consts.Notifications.Endpoints[capitalize(endpoint.name)], '_id')
          out.template = (await resourceStream.importMappedTemplate(ac, endpoint.template, endpoint.type, `${resourcePath}.template`)).name
          def.endpoints.push(out)
        }
      }

      ac.method = existing ? 'put' : 'post'
      await promised(this, 'aclWrite', ac, ac.org, def)

      return ac.org.configuration.notifications.find(n => n.name && n.name === doc.name)

    })

  }

}

OrgNotificationDefinition.prototype._prepWrite = function(ac, parentDocument, value) {

  ac.markSafeToUpdate(this)

  // inject missing default entries so it looks like an update of an existing item.
  value = utils.array(value, true)

  let current = utils.path(parentDocument, this.docpath)

  if (!current) {
    utils.path(parentDocument, this.docpath, [])
    current = utils.path(parentDocument, this.docpath)
  }

  for (let i = 0; i < value.length; i++) {
    let id = utils.getIdOrNull(utils.path(value[i], '_id'))
    if (id) {
      const type = consts.Notifications.TypeMap[id]
      if (type) {
        let entry = utils.findIdInArray(current, '_id', id)
        if (!entry) {
          current.push({
            _id: id
          })
        }
        entry = utils.findIdInArray(current, '_id', type._id)

        if (value[i].endpoints) {
          const endpoints = utils.array(value[i].endpoints, true)
          for (let j = 0; j < endpoints.length; j++) {
            let id = utils.getIdOrNull(utils.path(endpoints[j], '_id'))
            if (id) {
              // exists in template, then in doc?
              const endpoint = utils.findIdInArray(type.endpoints, '_id', id)
              if (endpoint) {
                if (!(utils.findIdInArray(entry.endpoints, '_id', id))) {
                  entry.endpoints.push({
                    _id: id
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  return value
}

OrgNotificationDefinition.prototype.aclWrite = function(ac, parentDocument, value, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)

  value = this._prepWrite(ac, parentDocument, value)
  DocumentDefinition.prototype.aclWrite.call(this, ac, parentDocument, value, options, callback)

}

module.exports = OrgNotificationDefinition
