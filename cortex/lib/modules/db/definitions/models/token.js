'use strict'

const util = require('util'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition')

function TokenDefinition() {

  this._id = TokenDefinition.statics._id
  this.objectId = TokenDefinition.statics.objectId
  this.objectLabel = TokenDefinition.statics.objectLabel
  this.objectName = TokenDefinition.statics.objectName
  this.pluralName = TokenDefinition.statics.pluralName

  const options = {

    name: this.objectName,
    _id: this._id,

    properties: [
      {
        // serves as the jti.
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        nativeIndex: true
      },
      {
        label: 'Issuer',
        name: 'iss',
        type: 'ObjectId',
        auto: true,
        nativeIndex: true
      },
      {
        label: 'Object',
        name: 'object',
        type: 'String',
        virtual: true,
        reader: function(ac, node) {
          return node.root.objectName
        }
      },
      {
        label: 'Subject Principal',
        name: 'sub',
        type: 'ObjectId',
        nativeIndex: true
      },
      {
        label: 'Uses Remaining',
        name: 'uses',
        type: 'Number'
      },
      {
        label: 'Expires',
        name: 'expires',
        type: 'Date'
      },
      {
        label: 'Last Accessed',
        name: 'accessed',
        type: 'Date'
      }
    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(TokenDefinition, ModelDefinition)

TokenDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = TokenDefinition.statics
  options.methods = TokenDefinition.methods
  options.indexes = TokenDefinition.indexes
  options.options = utils.extend({
    versionKey: 'sequence'
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

TokenDefinition.statics = {

  _id: consts.NativeObjects.token,
  objectId: consts.NativeObjects.token,
  objectLabel: 'Token',
  objectName: 'token',
  pluralName: 'tokens',
  requiredAclPaths: ['_id'],

  aclInit: function() {
    modules.db.models.Org.hook('app.removed').after((vars, callback) => {
      this.collection.deleteMany({ iss: { $in: utils.array(vars.clientIds, vars.clientIds) } }, callback)
    })
    modules.db.models.Org.hook('client.removed').after((vars, callback) => {
      this.collection.deleteMany({ iss: vars.clientId }, callback)
    })
    modules.db.models.Org.hook('client.generated_key_pair').after((vars, callback) => {
      this.collection.deleteMany({ iss: vars.clientId, _id: { $lt: utils.timestampToId(vars.timestamp) } }, callback)
    })
    modules.db.models.Account.hook('delete').after((vars, callback) => {
      this.collection.deleteMany({ sub: vars.ac.subjectId }, callback)
    })
  }

}

TokenDefinition.indexes = [

  [{ iss: 1 }, { name: 'idxIssuer' }], // the issuer. this is used to clear out tokens that have a deleted issuer apiKey id.
  [{ sub: 1 }, { name: 'idxSubject' }], // the subject. this is used to revoke tokens, and to count them.
  [{ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' }] // when limited in use and it expires.

]

module.exports = TokenDefinition
