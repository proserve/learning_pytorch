'use strict'

const crypto = require('crypto'),
      async = require('async'),
      utils = require('../../../utils'),
      modules = require('../../../modules'),
      logger = require('cortex-service/lib/logger'),
      noop = () => {}

module.exports = function(mongoose) {

  const schema = new mongoose.Schema({
    code: Number,
    org: mongoose.Schema.Types.ObjectId,
    object: 'String',
    type: 'String',
    key: String,
    seq: Number,
    was: mongoose.Schema.Types.Mixed,
    is: mongoose.Schema.Types.Mixed
  }, {
    versionKey: false
  })

  schema.index({ code: 1, org: 1, object: 1, key: 1 }, { name: 'idxKey', unique: true })
  schema.index({ org: 1, code: 1, seq: 1 }, { name: 'idxSeq' })

  schema.statics = {

    op: function(code, org, object, key, was, is, callback = noop) {
      this._op(this.makeOp(code, org, object, key, was, is), callback)
    },

    _op: function(op, callback = noop) {
      this.ops([op], callback)
    },

    ops: function(ops, callback = noop) {

      async.retry(
        10,
        callback => modules.counters.next(null, 'operations', callback),
        (err, seq) => {
          if (err) {
            try {
              logger.error('stats-log recording failed.', { ops, err: utils.toJSON(err) })
            } catch (e) {
              logger.error('stats-log recording failed to record error.', { err: utils.toJSON(err) })
            }
            callback(err)
          } else {
            ops.forEach(op => {
              op.updateOne.update.$set.seq = seq || -1
            })
            this.collection.bulkWrite(ops, (err, result) => {
              if (err || result.hasWriteErrors()) {
                try {
                  logger.error('stats-log recording failed.', { ops, err: utils.toJSON(err) || result.getWriteErrors() })
                } catch (e) {
                  logger.error('stats-log recording failed to record error.', { err: utils.toJSON(err) })
                }
              }
              callback(err, result)
            })

          }
        }
      )
    },

    makeOp: function(code, org, object, key, was, is) {
      return {
        updateOne: {
          filter: { code, org, object, key: this.makeKey(key) },
          update: { $setOnInsert: { was }, $set: { is } },
          upsert: true
        }
      }
    },

    makeKey: function(v) {
      const sum = crypto.createHash('md5')
      sum.update(v)
      return sum.digest('hex')
    }

  }

  return schema

}
