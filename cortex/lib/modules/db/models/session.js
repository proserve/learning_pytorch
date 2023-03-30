'use strict'

const utils = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault')

module.exports = function(mongoose) {

  const Schema = mongoose.Schema,
        sessionSchema = new Schema({
          _id: { type: String },
          accessed: { type: Date },
          session: Schema.Types.Mixed,
          fingerprint: { type: String },
          accountId: { type: Schema.Types.ObjectId },
          orgId: { type: Schema.Types.ObjectId }
        }, {
          versionKey: false
        })

  sessionSchema.statics.logoutAccounts = function(accountId, orgId, except, callback) {

    if (!callback) {
      callback = except
      except = null
    }
    const query = { accountId: accountId, orgId: orgId }
    if (except) {
      query._id = { $ne: except }
    }
    this.collection.updateMany(query, { $set: { 'session.loggedOut': true } }, function(err) {
      utils.ensureCallback(callback)(Fault.from(err), arguments)
    })

  }

  sessionSchema.index({ accountId: 1 }, { name: 'idxAccount' })
  sessionSchema.index({ accessed: 1 }, { expireAfterSeconds: Math.floor((config('sessions.duration'))), name: 'idxAccessedExpiry' })

  return sessionSchema

}
