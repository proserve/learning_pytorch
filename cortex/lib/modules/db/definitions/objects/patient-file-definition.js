'use strict'

const Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      ap = require('../../../../access-principal'),
      modules = require('../../../../modules'),
      logger = require('cortex-service/lib/logger'),
      util = require('util'),
      async = require('async'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function PatientFileDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(PatientFileDefinition, BuiltinContextModelDefinition)

PatientFileDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = PatientFileDefinition.statics
  options.methods = PatientFileDefinition.methods
  options.indexes = PatientFileDefinition.indexes
  options.options = { collection: PatientFileDefinition.collection }
  options.apiHooks = PatientFileDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

PatientFileDefinition.collection = 'contexts'

PatientFileDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.patientfile,
    objectLabel: 'Patient File',
    objectName: 'patientfile',
    pluralName: 'patientfiles',
    collection: 'contexts',
    isExtensible: true,
    defaultAclOverride: false,
    defaultAclExtend: true,
    defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
    createAclOverwrite: false,
    createAclExtend: false,
    allowConnections: true,
    allowConnectionsOverride: false,
    shareChainOverride: false,
    shareAclOverride: false,
    createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Min }],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    properties: [
      {
        label: 'Account',
        name: 'account',
        type: 'Reference',
        // description: 'The Account id of the connected patient account. If not connected, the property will not exist.',
        readable: true,
        writable: true,
        readAccess: acl.AccessLevels.Connected,
        writeAccess: acl.AccessLevels.Connected,
        expandable: true,
        auditable: true,
        sourceObject: 'account',
        dependencies: ['owner'],
        grant: acl.AccessLevels.Public,
        nativeIndex: true,
        pacl: [{
          type: acl.AccessTargets.Account,
          target: acl.PublicIdentifier,
          allow: acl.AccessLevels.Read,
          paths: ['name']
        }],
        writer: function(ac, node, value, options, callback) {

          // allow writing with _id or as {_id: "..."}. if the value is an id, then massage the value;
          value = modules.validation.isEmail(value) ? value : utils.getIdOrNull(value, true)

          // only providers can set the account, unless the caller is the owner and the account.
          let isProvider = ac.principal.isProvider(), isSelf = utils.equalIds(value, ac.principalId) || value === ac.principal.email,
              current = utils.path(this, 'account._id')

          if (!isProvider && !(ac.isOwner && isSelf)) {
            return callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'the patient account can only be set by a provider or to the owner account by the owner', path: node.fullpath }))
          }
          // already set? complain.
          if (current) {
            return callback(Fault.create('cortex.accessDenied.writeOnce', { reason: 'The patient account cannot be changed once set.', path: node.fullpath }))
          }

          if (isSelf) {

            // setting to self? that's okay!
            utils.path(this, 'account._id', ac.principalId)

            return callback(null, undefined) // handled

          } else {

            // create a connection request. if the save fails, just delete it. force a new one so we don't delete anything existing.
            const target = {
                    _id: utils.getIdOrNull(value) || undefined,
                    email: modules.validation.isEmail(value) ? value : undefined,
                    access: acl.AccessLevels.Connected
                  },
                  self = this,
                  connOptions = {
                    force: true,
                    sendConnectionNotification: false,
                    skipAcl: true,
                    contextSource: node.docpath,
                    appClientId: utils.path(ac, 'req.clientId')
                  }

            if (ac.dryRun) {
              return callback(Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Dry run is not supported for this property.', path: node.fullpath }))
            }

            modules.connections.createConnection(ac, target, connOptions, function(err, connection) {
              if (err) {
                return callback(err)
              }

              // cleanup others.
              modules.db.models.Connection.deleteMany({ 'context._id': self._id, contextSource: node.docpath, state: consts.connectionStates.pending, _id: { $ne: connection._id } }, function() {

                self.connection = connection._id

                ac.hook('save').after(function() {
                  connection.sendConnectionNotification(ac)
                })
                ac.hook('save').fail(function() {
                  connection.remove()
                })

                return callback(err, undefined) // handled
              })

            })

          }
        }
      },
      {
        label: 'Connection Pending',
        name: 'connectionPending',
        type: 'Boolean',
        // description: 'True when the account property has been set, but before the request has been accepted by the target.',
        dependencies: ['connection'],
        reader: function(ac, node, selection) {
          return !!this.connection
        }
      },
      {
        label: 'Connection',
        name: 'connection',
        type: 'ObjectId',
        // description: 'The pending or active patient connection.',
        public: false,
        readable: false
      },
      {
        label: 'Email',
        name: 'email',
        type: 'String',
        // description: 'A patient email address',
        readAccess: acl.AccessLevels.Connected,
        auditable: true,
        readable: true,
        writable: true,
        validators: [{
          name: 'email'
        }]
      }, {
        label: 'Phone',
        name: 'phone',
        type: 'String',
        // description: 'A patient contact phone number',
        readAccess: acl.AccessLevels.Connected,
        auditable: true,
        readable: true,
        writable: true,
        validators: [{
          name: 'phoneNumber'
        }]
      }, {
        label: 'Patient Name',
        name: 'name',
        type: 'Document',
        readAccess: acl.AccessLevels.Connected,
        writable: true,
        properties: [ {
          label: 'First Name',
          name: 'first',
          type: 'String',
          readAccess: acl.Inherit,
          nativeIndex: true,
          auditable: true,
          readable: true,
          writable: true,
          validators: [{
            name: 'required'
          }, {
            name: 'printableString',
            definition: { min: 1, max: 100, anyFirstLetter: false }
          }]
        }, {
          label: 'Last Name',
          name: 'last',
          type: 'String',
          nativeIndex: true,
          readAccess: acl.Inherit,
          readable: true,
          auditable: true,
          writable: true,
          validators: [ {
            name: 'required'
          }, {
            name: 'printableString',
            definition: { min: 1, max: 100, anyFirstLetter: false }
          }]
        }]
      }, {
        label: 'Dob',
        name: 'dob',
        type: 'Date',
        dateOnly: true,
        // description: 'Patient date of birth',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        writable: true,
        auditable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'dateOfBirth'
        }],
        nativeIndex: 1
      }, {
        label: 'Age',
        name: 'age',
        type: 'Number',
        // description: 'Patient age.',
        dependencies: ['dob'],
        auditable: true,
        readAccess: acl.AccessLevels.Public,
        readable: true,
        writable: false,
        reader: function() {

          const v = (this.getValue && this.getValue('dob')) || this.dob // <-- get raw ralue.
          if (_.isDate(v)) {
            return utils.dateToAge(v)
          }
        },
        virtual: true
      }, {
        label: 'Gender',
        name: 'gender',
        type: 'String',
        auditable: true,
        // description: 'Patient gender',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        writable: true,
        nativeIndex: 1,
        validators: [{
          name: 'required'
        }, {
          name: 'stringEnum',
          definition: { values: _.values(consts.Genders) }
        }]
      }, {
        label: 'Mrn',
        name: 'mrn',
        type: 'String',
        auditable: true,
        // description: 'Medical Record Number',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        writable: true,
        validators: [{
          name: 'printableString',
          definition: { min: 0, max: 100, anyFirstLetter: true }
        }]
      }, {
        label: 'Account Connected',
        name: 'accountConnected',
        type: 'Boolean',
        // description: 'True when the Patient account has connected to the Patient File.',
        dependencies: ['account', 'acl'],
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        groupReader: function(node, principal, entries, req, script, selection, callback) {

          var lookups = {}

          entries.forEach(function(entry) {

            utils.path(entry.output, node.docpath, false) // preset to false.

            const accountId = utils.getIdOrNull(utils.path(entry, 'input.account._id'))
            if (accountId) {

              // connected via acl?
              if (_.some(utils.array(entry.input.acl), function(entry) {
                return (entry && entry.allow >= acl.AccessLevels.Connected && utils.equalIds(entry.target, accountId))
              })) {
                utils.path(entry.output, node.docpath, true)
                return
              }

              // we will have to look it up.
              (lookups[accountId] || (lookups[accountId] = [])).push(entry)
            }
          })

          let accountIds = utils.getIdArray(Object.keys(lookups))
          if (!accountIds.length) {
            return callback()
          }

          // load principals and test them against the default acl.
          async.waterfall([

            // lookup account documents.
            function(callback) {
              var Account = modules.db.models.Account
              Account.find({ _id: { $in: accountIds } }).select(Account.requiredAclPaths.join(' ')).lean().exec(callback)
            },

            // grab the defaultAcl
            function(docs, callback) {
              principal.org.createObject('patientfile', function(err, model) {
                callback(err, model, docs)
              })
            },

            // create principals and test against default acl.
            function(model, docs, callback) {
              docs.forEach(function(org, doc) {
                const principal = ap.synthesizeAccount({ org, accountId: doc._id, email: doc.email, roles: doc.roles, state: doc.state }),
                      entries = lookups[principal._id]
                entries.forEach(function(entry) {
                  if ((new acl.AccessContext(principal, entry.input)).resolveAccess({ acl: model.defaultAcl }).hasAccess(acl.AccessLevels.Connected)) {
                    utils.path(entry.output, node.docpath, true)
                  }
                })
              }.bind(null, principal.org))
              callback()
            }

          ], function() {
            callback() // silence!
          })

        },
        virtual: true
      }, {
        _id: consts.Properties.Files.Ids.PatientFile.Image,
        label: 'Image',
        name: 'image',
        type: 'File',
        // description: 'The patient file image.',
        readAccess: acl.AccessLevels.Connected,
        urlExpirySeconds: config('uploads.s3.readUrlExpiry'),
        readable: true,
        auditable: true,
        writable: true,
        processors: [{
          type: 'image',
          name: 'content',
          source: 'content',
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          cropImage: false,
          allowUpload: true,
          maxFileSize: 1024 * 1000 * 5,
          maxWidth: 640,
          maxHeight: 640,
          passMimes: false,
          required: true
        }, {
          type: 'image',
          name: 'thumbnail',
          source: 'content',
          cropImage: true,
          maxFileSize: 1024 * 1000 * 5,
          imageWidth: 160,
          imageHeight: 160,
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          allowUpload: false
        }]
      }]
  }

}

// shared methods --------------------------------------------------------

PatientFileDefinition.methods = {}

// shared statics --------------------------------------------------------

PatientFileDefinition.statics = {}

// indexes ---------------------------------------------------------------

PatientFileDefinition.indexes = [

  [{ 'account._id': 1 }, { name: 'idxPatientAccount', partialFilterExpression: { 'account._id': { $exists: true } } }]

]

// shared hooks  ---------------------------------------------------------

PatientFileDefinition.apiHooks = [
  {
    name: 'connection',
    after: function(vars, callback) {

      let accountId = utils.getIdOrNull(utils.path(vars, 'connection.target.account._id')),
          patientFileId = utils.getIdOrNull(utils.path(vars, 'ac.subjectId')),
          connectionId = utils.getIdOrNull(utils.path(vars, 'original._id'))

      if (!accountId || !patientFileId || !connectionId) {
        return callback()
      }

      this.findOneAndUpdate({ _id: patientFileId, org: vars.ac.orgId, object: 'patientfile', account: { $exists: false }, connection: connectionId }, { $unset: { connection: 1 }, $set: { account: { _id: accountId } } }, function(err, doc) {

        let isPatientSet = !err && doc
        if (isPatientSet) {

          // notify Conversation.
          modules.db.models.Conversation.onPatientFileAccountSet(vars.ac, patientFileId, accountId)

          // retroactively update posts where the patientId is represented.
          modules.db.models.Post.collection.updateMany({ org: vars.ac.orgId, 'patientFile._id': patientFileId, reap: false }, { $set: { account: { _id: accountId } } }, function(err) {
            if (err) logger.error('error updating account id for patient posts', { error: err.toJSON(), patientFile: patientFileId, accountId: accountId })
          })
        }
        callback()
      })

    }
  }, {
    name: 'post.create',
    before: function(vars, callback) {
      // associate the patient file and account subject with the post.
      vars.ac.post.patientFile = { _id: vars.ac.subjectId }
      this.findOne({ _id: vars.ac.subjectId, org: vars.ac.orgId, object: 'patientfile' }).lean().select('account').exec(function(err, doc) {
        if (!err && !doc) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'Patient file not found: ' + vars.ac.subjectId })
        }
        let accountId = utils.getIdOrNull(utils.path(doc, 'account._id'))
        if (!err && accountId) {
          vars.ac.post.account = { _id: accountId }
        }
        callback(err)
      })
    }
  }]

module.exports = PatientFileDefinition
