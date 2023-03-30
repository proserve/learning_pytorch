'use strict'

/*
 * @todo when writable, endpoint names will have to be unique and not match the built-in names.
 *
 */

const DocumentDefinition = require('./types/document-definition'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      util = require('util'),
      consts = require('../../../consts'),
      acl = require('../../../acl')

function AccountNotificationPreferencesDefinition() {

  const options = {
    label: 'Notifications',
    name: 'notifications',
    type: 'Document',
    array: true,
    canPush: true,
    canPull: false,
    maxItems: -1,
    pusher: function(ac, node) {
      // prevent adding new ones.
      throw Fault.validationError('cortex.invalidArgument.unspecified', { reason: 'Unknown notification type.', path: node.fullpath })
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
        reader: function() {
          return this.label
        }
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        reader: function() {
          return this.name
        }
      },
      {
        label: 'Endpoints',
        name: 'endpoints',
        type: 'Document',
        array: true,
        acl: acl.Inherit,
        canPush: true,
        canPull: false,
        maxItems: -1,
        pusher: function(ac, node) {
          // prevent adding new ones.
          throw Fault.validationError('cortex.invalidArgument.unspecified', { reason: 'Unknown notification endpoint.', path: node.fullpath })
        },
        properties: [
          {
            // The endpoint identifier. For built-in notifications, these match the id of the built-in notification.
            label: '_id',
            name: '_id',
            type: 'ObjectId'
          },
          {
            label: 'Label',
            name: 'label',
            type: 'String',
            reader: function() {
              return this.label
            }
          },
          {
            label: 'Name',
            name: 'name',
            type: 'String',
            reader: function() {
              return this.name
            }
          },
          {
            label: 'Enabled',
            name: 'enabled',
            type: 'Boolean',
            writable: true
          }
        ]
      }
    ]
  }

  DocumentDefinition.call(this, options)
}
util.inherits(AccountNotificationPreferencesDefinition, DocumentDefinition)

AccountNotificationPreferencesDefinition.prototype.loadNotification = function(org, account, notificationId) {

  let orgNotification = org.schema.node.findNode('configuration.notifications').loadNotification(org, notificationId)
  if (orgNotification) {

    let userNotification = utils.findIdInArray(utils.path(account, this.docpath), '_id', orgNotification._id),
        outputEndpoints = []

    orgNotification.endpoints.forEach(function(orgEndpoint) {

      let enabled = false,
          userEndpoint

      if (orgEndpoint.state === consts.Notifications.States.Enabled) {
        enabled = true
      } else if (orgEndpoint.state === consts.Notifications.States.User) {
        userEndpoint = utils.findIdInArray(utils.path(userNotification, 'endpoints'), '_id', orgEndpoint._id)
        if (userEndpoint) {
          enabled = utils.rBool(userEndpoint.enabled, true)
        } else {
          enabled = true
        }
      }
      if (enabled) {
        outputEndpoints.push({
          _id: orgEndpoint._id,
          name: orgEndpoint.name,
          template: orgEndpoint.template
        })
      }

    })

    return {
      _id: orgNotification._id,
      name: orgNotification.name,
      persists: orgNotification.persists,
      duplicates: orgNotification.duplicates,
      endpoints: outputEndpoints
    }

  }

}

AccountNotificationPreferencesDefinition.prototype.getConfigurablePreferences = function(org, account, addNameAndLabel) {

  let types, current, out

  types = org.schema.node.findNode('configuration.notifications').getUserConfigurableNotifications(org, addNameAndLabel)

  current = utils.array(utils.path(account, this.docpath))
  if (current.toObject) {
    current = current.toObject()
  }

  out = []

  types.forEach(function(type) {

    let entry,
        userEndpoints

    if (!(entry = utils.findIdInArray(current, '_id', type._id))) {
      entry = {
        _id: type._id
      }
    }
    if (addNameAndLabel) {
      entry.name = type.name
      entry.label = type.label
    }

    // clone the user entries to ensure the output only has available settings.
    userEndpoints = entry.endpoints || []
    if (userEndpoints.toObject) {
      userEndpoints = userEndpoints.toObject()
    }
    entry.endpoints = []

    type.endpoints.forEach(function(endpoint) {

      let userEndpoint, outputEndpoint

      if (!(userEndpoint = utils.findIdInArray(userEndpoints, '_id', endpoint._id))) {
        outputEndpoint = {
          _id: endpoint._id,
          enabled: true
        }
      } else {
        outputEndpoint = {
          _id: endpoint._id,
          enabled: utils.rBool(userEndpoint.enabled, true)
        }
      }

      if (addNameAndLabel) {
        outputEndpoint.name = endpoint.name || consts.Notifications.EndpointMap[endpoint._id].name
        outputEndpoint.label = endpoint.label || consts.Notifications.EndpointMap[endpoint._id].label
      }

      entry.endpoints.push(outputEndpoint)

    })

    out.push(entry)

  })

  return out

}

AccountNotificationPreferencesDefinition.prototype.aclRead = function(ac, parentDocument, selection) {
  let preferences = this.getConfigurablePreferences(ac.org, parentDocument, true)
  utils.path(parentDocument, this.docpath, preferences)
  return DocumentDefinition.prototype.aclRead.call(this, ac, parentDocument, selection)
}

AccountNotificationPreferencesDefinition.prototype.collectRuntimePathSelections = function(principal, selections, path, options) {

  DocumentDefinition.prototype.collectRuntimePathSelections.call(this, principal, selections, path, options)

  selections[this.docpath] = true // avoid problems by selecting it all.

}

AccountNotificationPreferencesDefinition.prototype.aclWrite = function(ac, parentDocument, value, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)

  ac.markSafeToUpdate(this)

  value = utils.array(value, true)

  let availableTypes = this.getConfigurablePreferences(ac.org, ac.subject, false),
      id,
      endpoints,
      endpoint,
      entry,
      type,
      current = utils.path(parentDocument, this.docpath)

  if (!current) {
    utils.path(parentDocument, this.docpath, [])
    current = utils.path(parentDocument, this.docpath)
  }

  for (let i = 0; i < value.length; i++) {
    id = utils.getIdOrNull(utils.path(value[i], '_id'))
    if (id) {
      type = utils.findIdInArray(availableTypes, '_id', id)
      if (type) {
        if (!(entry = utils.findIdInArray(current, '_id', id))) {
          current.push({
            _id: id
          })
        }
        entry = utils.findIdInArray(current, '_id', id)
        if (value[i].endpoints) {
          endpoints = utils.array(value[i].endpoints, true)
          for (let j = 0; j < endpoints.length; j++) {
            id = utils.getIdOrNull(utils.path(endpoints[j], '_id'))
            if (id) {
              // exists in template, then in doc?
              endpoint = utils.findIdInArray(type.endpoints, '_id', id)
              if (endpoint) {
                if (!(utils.findIdInArray(entry.endpoints, '_id', id))) {
                  entry.endpoints.push({
                    _id: id,
                    value: true
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  DocumentDefinition.prototype.aclWrite.call(this, ac, parentDocument, value, options, callback)

}

module.exports = AccountNotificationPreferencesDefinition
