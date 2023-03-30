'use strict'

const util = require('util'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      utils = require('../../../../utils'),
      async = require('async'),
      consts = require('../../../../consts'),
      acl = require('../../../../acl'),
      ModelDefinition = require('../model-definition')

function LocationDefinition() {

  this.locationStates = 'unverified verified revoked'.split(' ')

  this._id = LocationDefinition.statics._id
  this.objectId = LocationDefinition.statics.objectId
  this.objectLabel = LocationDefinition.statics.objectLabel
  this.objectName = LocationDefinition.statics.objectName
  this.pluralName = LocationDefinition.statics.pluralName

  var options = {

    label: 'Location',
    name: 'location',
    _id: consts.NativeObjects.location,
    pluralName: 'locations',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        readable: true,
        nativeIndex: true
      },
      {
        label: 'Created',
        name: 'created',
        type: 'Date'
      },
      {
        label: 'Object',
        name: 'object',
        type: 'String',
        virtual: true,
        reader: function(ac, node, selection) {
          return node.root.objectName
        }
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId',
        public: false,
        readable: false,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Account',
        name: 'accountId',
        type: 'ObjectId',
        public: false,
        nativeIndex: true,
        readAccess: acl.AccessLevels.Script,
        validators: [{
          name: 'required'
        }]
      },
      {
        label: 'Client',
        name: 'client',
        type: 'String',
        validators: [{
          name: 'required'
        }],
        reader: function(ac, node, selection) {

          if (this.client === config('webApp.apiKey')) {
            return 'Web App'
          }

          let clients = {},
              client

          utils.array(ac.org.apps).forEach(function(app) {
            app.clients.forEach(function(client) {
              clients[client.key] = client
            })
          })
          client = clients[this.client]
          return client ? client.label : ''
        }
      },
      {
        label: 'API Key',
        name: 'apiKey',
        type: 'String',
        virtual: true,
        readAccess: acl.AccessLevels.Script,
        dependencies: ['.client'],
        reader: function() {
          return this.client
        }
      },
      {
        label: 'Fingerprint',
        name: 'fingerprint',
        type: 'String',
        public: false,
        readAccess: acl.AccessLevels.Script,
        validators: [{
          name: 'fingerprint'
        }]
      },
      {
        label: 'State',
        name: 'state',
        type: 'String',
        writable: true,
        validators: [{
          name: 'stringEnum',
          definition: {
            values: this.locationStates
          }
        }],
        writer: function(ac, node, value) {
          if ((value === 'unverified' && this.state === 'verified') || (value === 'revoked' && this.state !== 'revoked') || (value === 'unverified' && this.state === 'revoked')) {
            return value
          }
        }
      },
      {
        label: 'Name',
        name: 'name',
        type: 'String',
        writable: true,
        default: '',
        validators: [{
          name: 'printableString',
          definition: {
            anyFirstLetter: true,
            min: 0,
            max: 100
          }
        }]
      },
      {
        label: 'Last Login',
        name: 'lastLogin',
        type: 'Document',
        properties: [
          {
            label: 'Time',
            name: 'time',
            type: 'Date'
          },
          {
            label: 'IP Address',
            name: 'ip',
            type: 'String',
            public: false,
            readable: false
          }
        ]
      },
      {
        label: 'IOS',
        name: 'ios',
        type: 'Document',
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            label: 'Notification',
            name: 'notification',
            type: 'Document',
            properties: [
              {
                label: 'Token',
                name: 'token',
                type: 'String',
                nativeIndex: true
              }
            ]
          }
        ]
      },
      {
        label: 'Android',
        name: 'android',
        type: 'Document',
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            label: 'Registration Id',
            name: 'regid',
            type: 'String',
            nativeIndex: true
          }
        ]
      },
      {
        label: 'Firebase',
        name: 'firebase',
        type: 'Document',
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            label: 'Registration Token',
            name: 'token',
            type: 'String',
            nativeIndex: true
          }
        ]
      },
      {
        label: 'Tencent',
        name: 'tencent',
        type: 'Document',
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            label: 'Registration Token',
            name: 'token',
            type: 'String',
            nativeIndex: true
          }
        ]
      },
      {
        label: 'VOIP',
        name: 'voip',
        type: 'Document',
        readAccess: acl.AccessLevels.Script,
        properties: [
          {
            label: 'Push Token',
            name: 'token',
            type: 'String',
            nativeIndex: true
          }
        ]
      },
      {
        label: 'Notifications',
        name: 'notifications',
        type: 'Document',
        virtual: true,
        dependencies: ['ios', 'android', 'firebase', 'tencent', 'voip'],
        reader: function() {
          return {
            apn: !!utils.path(this, 'ios.notification.token'),
            gcm: !!utils.path(this, 'android.regid'),
            fcm: !!utils.path(this, 'firebase.token'),
            tpns: !!utils.path(this, 'tencent.token'),
            voip: !!utils.path(this, 'voip.token')
          }
        }
      }
    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(LocationDefinition, ModelDefinition)

LocationDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = LocationDefinition.statics
  options.methods = LocationDefinition.methods
  options.indexes = LocationDefinition.indexes

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

LocationDefinition.statics = {

  _id: consts.NativeObjects.location,
  objectId: consts.NativeObjects.location,
  objectLabel: 'Location',
  objectName: 'location',
  pluralName: 'locations',
  requiredAclPaths: ['_id', 'org', 'object', 'sequence'],

  updateLastLogin: function(accountId, req, location, callback) {

    var update = {
      $set: {
        client: utils.path(req, 'orgClient.key') || null,
        lastLogin: {
          time: new Date(),
          ip: utils.getClientIp(req)
        }
      }
    }
    this.updateOne({ _id: location._id }, update, function(err) {
      if (_.isFunction(callback)) {
        callback(err)
      }
    })

  },

  /**
     * @param principal
     * @param clientKey
     * @param fingerprint
     * @param options
     * @param callback err, { location, isNew )
     */
  findOrCreateLocation: function(principal, clientKey, fingerprint, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    options = utils.extend({
      iosNotificationToken: null,
      gcmRegistrationId: null,
      fcmRegistrationToken: null,
      tpnsRegistrationToken: null,
      voipToken: null,
      locationName: null,
      req: null,
      bypassActivation: false,
      updateLastLogin: false
    }, options)

    var update = {
      $setOnInsert: {
        accountId: principal._id,
        org: principal.orgId,
        fingerprint: fingerprint,
        client: clientKey || null,
        created: new Date(),
        state: options.bypassActivation ? 'verified' : 'unverified'
      }
    }
    if (_.isString(options.locationName)) {
      update.$setOnInsert.name = options.locationName.substr(0, 512)
    }
    if (options.bypassActivation && options.updateLastLogin && options.req) {
      update.$setOnInsert.lastLogin = {
        time: new Date(),
        ip: utils.getClientIp(options.req)
      }
    }

    this.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: fingerprint }, update, { upsert: true, returnDocument: 'after' }, function(err, result) {
      const location = utils.path(result, 'value')
      if (_.isFunction(callback)) {
        if (!err && !location) {
          err = Fault.create('cortex.notFound.location', { reason: 'The location was not found.' })
        }

        callback(
          err,
          err
            ? null
            : { location, isNew: !utils.path(result, 'lastErrorObject.updatedExisting') }
        )
      }
    })

  },

  /**
     * if account or location are null, the token is unassigned. only 1 account can use a token at any one time.
     *
     * note: make sure a unique, sparse index exists on locations.ios.notification.token
     *
     * @param iosNotificationToken
     * @param principal
     * @param location
     * @param callback err
     * @return {*}
     */
  assignIosNotificationToken: function(iosNotificationToken, principal, location, callback) {

    iosNotificationToken = String(iosNotificationToken).substr(0, 1024)

    var Location = this

    async.waterfall([

      // un-assign and emit
      function(callback) {

        var find = { 'ios.notification.token': iosNotificationToken }
        if (location) find._id = { $ne: location._id }

        Location.collection.findOneAndUpdate(find, { $unset: { 'ios.notification.token': 1 } }, function(err, result) {
          const doc = utils.path(result, 'value')
          if (err) callback(err)
          else {
            if (doc) {
              principal.org.sendNotification('IOSTokenReassigned', { account: location.accountId })
            }
            callback(err)
          }
        })
      },

      // re-assign
      function(callback) {
        if (!principal || !location) callback()
        else Location.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: location.fingerprint }, { $set: { 'ios.notification.token': iosNotificationToken } }, err => callback(err))
      }

    ], callback)

  },

  /**
     * if account or location are null, the token is unassigned. only 1 account can use a token at any one time.
     *
     * @param gcmRegistrationId
     * @param principal
     * @param location
     * @param callback err
     * @return {*}
     */
  assignGcmRegistrationId: function(gcmRegistrationId, principal, location, callback) {

    gcmRegistrationId = String(gcmRegistrationId).substr(0, 1024)

    var Location = this

    async.waterfall([

      // un-assign and emit
      function(callback) {

        var find = { 'android.regid': gcmRegistrationId }
        if (location) find._id = { $ne: location._id }

        Location.collection.findOneAndUpdate(find, { $unset: { 'android.regid': 1 } }, function(err, result) {
          const doc = utils.path(result, 'value')
          if (err) callback(err)
          else {
            if (doc) {
              principal.org.sendNotification('GCMRegIdReassigned', { account: location.accountId })
            }
            callback(err)
          }
        })
      },

      // re-assign
      function(callback) {
        if (!principal || !location) callback()
        else Location.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: location.fingerprint }, { $set: { 'android.regid': gcmRegistrationId } }, err => callback(err))
      }

    ], callback)

  },

  /**
   * if account or location are null, the token is unassigned. only 1 account can use a token at any one time.
   *
   * note: make sure a unique, sparse index exists on locations.android.regid
   *
   * @param fcmRegistrationToken
   * @param principal
   * @param location
   * @param callback err
   * @return {*}
   */
  assignFcmRegistrationToken: function(fcmRegistrationToken, principal, location, callback) {

    fcmRegistrationToken = String(fcmRegistrationToken).substr(0, 1024)

    var Location = this

    async.waterfall([

      // un-assign and emit
      function(callback) {

        var find = { 'firebase.token': fcmRegistrationToken }
        if (location) find._id = { $ne: location._id }

        Location.collection.findOneAndUpdate(find, { $unset: { 'firebase.token': 1 } }, function(err, result) {
          const doc = utils.path(result, 'value')
          if (err) callback(err)
          else {
            if (doc) {
              // use the same token
              principal.org.sendNotification('GCMRegIdReassigned', { account: location.accountId })
            }
            callback(err)
          }
        })
      },

      // re-assign
      function(callback) {
        if (!principal || !location) callback()
        else Location.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: location.fingerprint }, { $set: { 'firebase.token': fcmRegistrationToken } }, err => callback(err))
      }

    ], callback)

  },

  /**
   * if account or location are null, the token is unassigned. only 1 account can use a token at any one time.
   *
   * note: make sure a unique, sparse index exists on locations.android.regid
   *
   * @param tpnsRegistrationToken
   * @param principal
   * @param location
   * @param callback err
   * @return {*}
   */
  assignTpnsRegistrationToken: function(tpnsRegistrationToken, principal, location, callback) {

    tpnsRegistrationToken = String(tpnsRegistrationToken).substr(0, 1024)

    var Location = this

    async.waterfall([

      // un-assign and emit
      function(callback) {

        var find = { 'tencent.token': tpnsRegistrationToken }
        if (location) find._id = { $ne: location._id }

        Location.collection.findOneAndUpdate(find, { $unset: { 'tencent.token': 1 } }, function(err, result) {
          const doc = utils.path(result, 'value')
          if (err) callback(err)
          else {
            if (doc) {
              // use the same token
              principal.org.sendNotification('GCMRegIdReassigned', { account: location.accountId })
            }
            callback(err)
          }
        })
      },

      // re-assign
      function(callback) {
        if (!principal || !location) callback()
        else Location.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: location.fingerprint }, { $set: { 'tencent.token': tpnsRegistrationToken } }, err => callback(err))
      }

    ], callback)

  },

  /**
   * if account or location are null, the token is unassigned. only 1 account can use a token at any one time.
   *
   * @param voipToken
   * @param principal
   * @param location
   * @param callback err
   * @return {*}
   */
  assignVoipToken: function(voipToken, principal, location, callback) {

    voipToken = String(voipToken).substr(0, 1024)

    var Location = this

    async.waterfall([

      // un-assign and emit
      function(callback) {

        var find = { 'voip.token': voipToken }
        if (location) find._id = { $ne: location._id }

        Location.collection.findOneAndUpdate(find, { $unset: { 'voip.token': 1 } }, function(err, result) {
          const doc = utils.path(result, 'value')
          if (err) callback(err)
          else {
            if (doc) {
              // use the same token
              // principal.org.sendNotification('IOSTokenReassigned', {account: location.accountId})
            }
            callback(err)
          }
        })
      },

      // re-assign
      function(callback) {
        if (!principal || !location) callback()
        else Location.collection.findOneAndUpdate({ org: principal.orgId, accountId: principal._id, fingerprint: location.fingerprint }, { $set: { 'voip.token': voipToken } }, err => callback(err))
      }

    ], callback)

  }

}

LocationDefinition.indexes = [

  [{ accountId: 1 }, { name: 'idxAccount' }],

  [{ 'ios.notification.token': 1 }, { unique: true, partialFilterExpression: { 'ios.notification.token': { $exists: true } }, name: 'idxIOSToken' }],

  [{ 'android.regid': 1 }, { unique: true, partialFilterExpression: { 'android.regid': { $exists: true } }, name: 'idxGCMToken' }],

  [{ 'firebase.token': 1 }, { unique: true, partialFilterExpression: { 'firebase.token': { $exists: true } }, name: 'idxFCMToken' }],

  [{ 'tencent.token': 1 }, { unique: true, partialFilterExpression: { 'tencent.token': { $exists: true } }, name: 'idxTPNSToken' }],

  [{ 'voip.token': 1 }, { unique: true, partialFilterExpression: { 'voip.token': { $exists: true } }, name: 'idxVOIPToken' }],

  [{ org: 1, accountId: 1, fingerprint: 1 }, { unique: true, name: 'idxOrgAccountFingerprint' }]

]

module.exports = LocationDefinition
