
const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition')

function ConversationDefinition(options) {
  BuiltinContextModelDefinition.call(this, options)
}
util.inherits(ConversationDefinition, BuiltinContextModelDefinition)

ConversationDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = ConversationDefinition.statics
  options.methods = ConversationDefinition.methods
  options.indexes = ConversationDefinition.indexes
  options.options = { collection: ConversationDefinition.collection }
  options.apiHooks = ConversationDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

ConversationDefinition.collection = 'contexts'

ConversationDefinition.prototype.getNativeOptions = function() {

  return {
    _id: consts.NativeIds.conversation,
    objectLabel: 'Care Conversation',
    objectName: 'conversation',
    pluralName: 'conversations',
    isExtensible: true,
    collection: 'contexts',
    defaultAclOverride: false,
    defaultAclExtend: true,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: true,
    allowConnectionsOverride: false,
    defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgProviderRole, allow: acl.AccessLevels.Min }],
    shareChain: [acl.AccessLevels.Share, acl.AccessLevels.Connected],
    properties: [
      {
        label: 'Description',
        name: 'description',
        type: 'String',
        // description: 'The conversation description',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        writable: true,
        auditable: true,
        validators: [{
          name: 'printableString',
          definition: { min: 0, max: 512 }
        }],
        default: '',
        stub: ''
      }, {
        _id: consts.Properties.Files.Ids.Conversation.Attachments,
        label: 'Attachments',
        name: 'attachments',
        type: 'File',
        // description: '',
        array: true,
        maxItems: 20,
        maxShift: false,
        canPush: true,
        canPull: true,
        writable: true,
        auditable: true,
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        urlExpirySeconds: config('uploads.s3.readUrlExpiry'),
        processors: [{
          type: 'image',
          name: 'content',
          source: 'original',
          overlay: 'overlay',
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          cropImage: false,
          passMimes: false,
          allowUpload: false
        }, {
          type: 'image',
          name: 'thumbnail',
          source: 'content',
          cropImage: true,
          imageWidth: 256,
          imageHeight: 256,
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          allowUpload: false
        }, {
          type: 'image',
          name: 'original',
          source: 'original',
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          allowUpload: true,
          private: true,
          passMimes: false
        }, {
          type: 'overlay',
          name: 'overlay',
          source: 'overlay',
          mimes: ['image/png', 'image/gif'],
          allowUpload: true,
          private: true
        }, {
          type: 'passthru',
          name: 'document',
          source: 'document',
          mimes: ['*'],
          maxFileSize: 1024 * 1000 * 100,
          allowUpload: true,
          passMimes: false
        }]
      }, {
        label: 'Patientfile',
        name: 'patientFile',
        type: 'Reference',
        // description: 'The Patient File for which the conversation was created. Once set, it cannot be changed.',
        readAccess: acl.AccessLevels.Connected,
        referenceAccess: acl.AccessLevels.Share,
        auditable: true,
        readable: true,
        writable: true,
        expandable: true,
        grant: acl.AccessLevels.Public,
        nativeIndex: true,
        pacl: [{
          type: acl.AccessTargets.Account,
          target: acl.PublicIdentifier,
          allow: acl.AccessLevels.Connected,
          paths: ['gender']
        }],
        sourceObject: 'patientfile',
        onSetReference: function(ac, oldValue, newValue, callback) {
          if (this._originalPatientFile === undefined) {
            this._originalPatientFile = oldValue || null
          }
          callback(null, newValue)
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'A valid patient file.',
            validator: function() {
              if (this._originalPatientFile != null && this.isModified('patientFile._id')) {
                throw Fault.create('cortex.accessDenied.writeOnce', { reason: 'The conversation patient file cannot change once set.' })
              }
              return true
            }
          }
        }],
        writer: function(ac, node, value, options, callback) {

          // allow writing with _id or as {_id: "..."}. if the value is an id, then massage the value to pass it along to the _id writer.
          value = {
            _id: utils.getIdOrNull(value, true)
          }
          return callback(null, value)
        }
      }, {
        label: 'Patient Account',
        name: 'patientAccount',
        type: 'Reference',
        // description: 'The account context Id for the patient if connected to the conversation as an active participant.',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        expandable: true,
        sourceObject: 'account',
        nativeIndex: true
      }]
  }
}

// shared methods --------------------------------------------------------

ConversationDefinition.methods = {}

// shared statics --------------------------------------------------------

ConversationDefinition.statics = {

  // called when an account is set on a patient file. look for conversations where the patient file is represented and set the patientAccount property, if the patient is connected.
  onPatientFileAccountSet: function(ac, patientFileId, accountId) {

    const find = {
            org: ac.orgId,
            object: 'conversation',
            'patientFile._id': patientFileId,
            'acl.target': accountId,
            'acl.allow': { $gte: acl.AccessLevels.Connected }
          },
          update = {
            $set: { patientAccount: {
              _id: accountId
            } }
          }

    this.collection.updateMany(find, update, function(err) {
      if (err) {
        logger.error('error updating patientAccount in conversations for patientFileId:' + patientFileId + ', accountId:' + accountId)
      }
    })
  }

}

// indexes ---------------------------------------------------------------

ConversationDefinition.indexes = [

  [{ 'patientFile._id': 1 }, { name: 'idxPatientFile', partialFilterExpression: { 'patientFile._id': { $exists: true } } }],

  [{ 'patientAccount._id': 1 }, { name: 'idxConversationPatientAccount', partialFilterExpression: { 'patientAccount._id': { $exists: true } } }]

]

// shared hooks  ---------------------------------------------------------

ConversationDefinition.apiHooks = [
  {
    name: 'connection',
    before: function(vars, callback) {

      if (vars.ac.dryRun) {
        return callback()
      }

      // only allow ownership transfers to providers
      // let err
      // if (utils.path(vars.connection, 'data.transfer')) {
      //   if (vars.collabPrincipal && !vars.collabPrincipal.isProvider()) {
      //     err = Fault.create('cortex.invalidArgument.unspecified', {reason: 'Conversations ownership can only occur between providers.'})
      //     vars.connection.remove(function(err) {})
      //   }
      // }
      callback()
    },
    after: function(vars, callback) {

      let Conversation = this,
          conversationId = vars.ac.subjectId

      async.waterfall([

        // look for an existing patient file associated with the conversation. if one is set,
        function(callback) {
          modules.db.models.Conversation.findOne({ org: vars.ac.orgId, object: 'conversation', reap: false, _id: conversationId }).select({ patientFile: 1 }).lean().exec(function(err, doc) {
            if (!err && !doc) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'Conversation ' + conversationId + ' not found.' })
            }
            let patientFileId = utils.path(doc, 'patientFile._id')
            if (err || !patientFileId) callback(err, null, null)
            else {
              modules.db.models.PatientFile.findOne({ org: vars.ac.orgId, object: 'patientfile', reap: false, _id: patientFileId }).select({ 'account._id': 1 }).lean().exec(function(err, doc) {
                if (!err && !doc) {
                  err = Fault.create('cortex.notFound.unspecified', { reason: 'Patient File ' + patientFileId + ' not found.' })
                }
                callback(err, patientFileId, utils.path(doc, 'account._id'))
              })
            }
          })
        },

        // if the patient file is set and the target is the patient account, set patientAccount.
        function(patientFileId, accountId, callback) {

          if (!patientFileId || !accountId) {
            return callback()
          }

          const find = {
                  org: vars.ac.orgId,
                  object: 'conversation',
                  _id: conversationId,
                  'acl.target': accountId,
                  'acl.allow': { $gte: acl.AccessLevels.Connected }
                },
                update = {
                  $set: { patientAccount: {
                    _id: accountId
                  } }
                }
          Conversation.collection.updateOne(find, update, function(err) {
            if (err) {
              logger.error('error updating patientAccount in conversations for patientFileId:' + patientFileId + ', accountId:' + accountId)
            }
            callback()
          })

        }

      ], callback)

    }
  }, {
    name: 'post.create',
    before: function(vars, callback) {
      // associate the conversation patient file and account with the post.
      this.findOne({ org: vars.ac.orgId, object: 'conversation', _id: vars.ac.subjectId, reap: false }).select({ patientFile: 1, patientAccount: 1 }).lean().exec(function(err, doc) {
        if (!err && !doc) err = Fault.create('cortex.notFound.unspecified', { reason: 'Conversation ' + vars.ac.subjectId + ' not found.' })
        if (err) callback(err)
        else {
          let patientFileId = utils.getIdOrNull(utils.path(doc, 'patientFile._id'))
          if (!patientFileId) callback()
          else {
            vars.ac.post.patientFile = { _id: patientFileId }
            modules.db.models.PatientFile.findOne({ org: vars.ac.orgId, object: 'patientfile', reap: false, _id: patientFileId }).lean().select('account').exec(function(err, doc) {
              if (!err && !doc) err = Fault.create('cortex.notFound.unspecified', { reason: 'Patient File ' + patientFileId + ' not found.' })
              if (!err) {
                let accountId = utils.path(doc, 'account._id')
                if (accountId) {
                  vars.ac.post.account = { _id: accountId }
                }
              }
              callback(err)
            })
          }
        }
      })
    }
  }, {
    name: 'connection.removed',
    after: function(vars, callback) {

      const patientAccount = utils.path(vars, 'connection.target._id')

      // unset the patientAccount if the patient is leaving.
      this.findOneAndUpdate({ org: vars.ac.orgId, object: 'conversation', _id: vars.ac.subjectId, reap: false, patientAccount }, { $unset: { patientAccount: 1 } }, function() {
        callback()
      })
    }
  }]

module.exports = ConversationDefinition
