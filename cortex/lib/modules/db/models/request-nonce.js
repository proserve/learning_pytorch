'use strict'

const crypto = require('crypto'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault')

module.exports = function(mongoose) {

  const Schema = mongoose.Schema,
        schema = new Schema({
          hash: String,
          expires: Date
        }, {
          versionKey: false
        })

  schema.index({ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' })
  schema.index({ hash: 1 }, { unique: true, name: 'idxHash' })

  schema.statics.checkAndRegister = function(timeout, signature, nonce, callback) {

    const hash = crypto.createHash('sha1').update(signature + ';' + nonce).digest('hex')
    this.collection.findOneAndUpdate({ hash: hash }, { $setOnInsert: { hash: hash, expires: new Date(Date.now() + timeout) } }, { upsert: true, returnDocument: 'before' }, function(err, result) {
      const doc = utils.path(result, 'value')
      if (!err && doc && doc._id) {
        err = Fault.create('cortex.accessDenied.invalidRequestSignature', { reason: 'Invalid request signature (R).' })
      }
      callback(err)
    })

  }

  return schema

}
