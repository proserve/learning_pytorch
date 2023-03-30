'use strict'

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({

    org: mongoose.Schema.Types.ObjectId,
    key: String,
    val: mongoose.Schema.Types.Mixed,
    exp: Date,
    sz: Number
  }, {
    versionKey: false
  })

  schema.index({ org: 1, key: 1 }, { name: 'idxOrgKey', unique: true })
  schema.index({ exp: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' })

  return schema

}
