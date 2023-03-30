'use strict'

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({

    org: mongoose.Schema.Types.ObjectId,
    label: String,
    expires: Date,
    data: Buffer

  }, {
    versionKey: false
  })

  schema.index({ org: 1 }, { name: 'idxOrg' })
  schema.index({ expires: 1 }, { expireAfterSeconds: 0, name: 'idxExpires' })

  return schema

}
