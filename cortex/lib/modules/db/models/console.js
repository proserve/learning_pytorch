'use strict'

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({

    org: mongoose.Schema.Types.ObjectId, // null for internal counters
    date: Date,
    level: String,
    trace: String,
    message: mongoose.Schema.Types.Mixed
  }, {
    capped: {
      size: 1024 * 1024 * 10,
      max: 1000
    },
    versionKey: false
  })

  schema.index({ org: 1 }, { name: 'idxOrg' })

  return schema

}
