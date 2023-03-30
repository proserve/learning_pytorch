'use strict'

const modules = require('../modules'),
      utils = require('../utils'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      noop = () => {}

if (!RegExp.escape) {
  RegExp.escape = function(s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  }
}

class CountersModule {

  get collection() {
    if (!this._collection) {
      this._collection = modules.db.models.Counter.collection
    }
    return this._collection
  }

  get(org, key, callback = noop) {

    this.collection.find({ org: (org && org._id) || null, key: String(key) }).limit(1).toArray((err, data) => {
      callback(err, data && data[0] ? data[0].val : null)
    })
  }

  next(org, key, callback = noop) {

    this.collection.findOneAndUpdate(
      { org: (org && org._id) || null, key: String(key) },
      { $inc: { val: 1 }, $currentDate: { date: true } },
      { upsert: true, returnDocument: 'after' },
      (err, result) => {
        if (err && err.code === 11000) {
          return setImmediate(() => this.next(org, key, callback))
        }
        callback(err, result && result.value.val)
      }
    )

  }

  has(org, key, callback = noop) {

    this.collection.find({ org: (org && org._id) || null, key: String(key) }).limit(1).hasNext((err, has) => {
      callback(err, has)
    })

  }

  list(org, keys, skip = 0, limit = 100, callback = noop) {

    if (typeof skip === 'function') {
      callback = skip
      skip = limit = null
    }
    if (typeof limit === 'function') {
      callback = limit
      limit = null
    }

    skip = utils.rInt(skip, 0)
    limit = utils.clamp(utils.rInt(limit, 100), 1, 1000)

    const filter = {
      org: (org && org._id) || null,
      key: new RegExp(`^${RegExp.escape(String(keys))}`)
    }

    async.parallel({

      data: callback => {
        this.collection.find(filter).sort({ key: 1 }).skip(skip).limit(limit).toArray((err, data) => {
          callback(err, data && data.map(v => {
            return {
              created: v._id.getTimestamp(),
              updated: v.date,
              key: v.key,
              val: v.val
            }
          }))
        })
      },

      total: callback => {
        this.collection.countDocuments(filter, callback)
      }

    }, (err, results) => callback(err, results && _.extend(results, { object: 'list' })))

  }

  count(org, keys, callback = noop) {

    const filter = {
      org: (org && org._id) || null,
      key: new RegExp(`^${RegExp.escape(String(keys))}`)
    }

    this.collection.countDocuments(filter, (err, count) => callback(err, count))
  }

  del(org, key, callback = noop) {

    this.collection.deleteMany({ org: (org && org._id) || null, key: String(key) }, (err, result) => {
      callback(Fault.from(err), !!utils.path(result, 'deletedCount'))
    })

  }

  clear(org, keys, callback = noop) {

    if (typeof keys === 'function') {
      callback = keys
      keys = ''
    }

    const filter = {
      org: (org && org._id) || null,
      key: new RegExp(`^${RegExp.escape(String(keys))}`)
    }

    this.collection.deleteMany(filter, { writeConcern: { w: 'majority' } }, (err, result) => {
      callback(Fault.from(err), utils.path(result, 'deletedCount'))
    })

  }

}

module.exports = new CountersModule()
