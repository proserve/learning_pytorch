'use strict'

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({

    org: mongoose.Schema.Types.ObjectId, // null for internal counters
    key: String,
    val: Number,
    date: Date
  }, {
    versionKey: false
  })

  schema.index({ org: 1, key: 1 }, { name: 'idxOrgKey', unique: true })

  return schema

}
