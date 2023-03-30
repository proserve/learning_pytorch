'use strict'

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({
    org: mongoose.Schema.Types.ObjectId,
    val: mongoose.Schema.Types.Mixed, // values
    metadata: mongoose.Schema.Types.Mixed, // keys metadata { key: { isPublic: true, ... } }
    sequence: Number
  }, {
    versionKey: 'sequence'
  })

  schema.index({ org: 1 }, { name: 'idxOrgKey', unique: true })

  return schema

}
