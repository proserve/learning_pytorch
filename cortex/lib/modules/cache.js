'use strict'

const modules = require('../modules'),
      utils = require('../utils'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      { bson } = utils,
      { MemoryCache } = require('cortex-service/lib/memory-cache'),
      noop = () => {}

let Undefined

if (!RegExp.escape) {
  RegExp.escape = function(s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  }
}

class MemoryCaches {

  constructor() {

    this._caches = new Map()

    modules.services.api.addCommand('caches.list', (payload, callback) => {
      this.list().then((result) => callback(null, result))
    })

    modules.services.api.addCommand('caches.describe', (payload, callback) => {

      const cache = this.get(utils.path(payload, 'name'))
      if (!cache) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'cache not found (name argument)' }))
      }
      MemoryCaches._describe(cache).then((result) => callback(null, result))
    })

    modules.services.api.addCommand('caches.flush', (payload, callback) => {

      const cache = this.get(utils.path(payload, 'name'))
      if (!cache) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'cache not found (name argument)' }))
      }
      cache.flush()
      MemoryCaches._describe(cache).then((result) => callback(null, result))
    })

    modules.services.api.addCommand('caches.setOptions', (payload, callback) => {

      const cache = this.get(utils.path(payload, 'name'))

      if (!cache) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'cache not found (name argument)' }))
      } else if (!payload.options) {
        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'no options (options argument)' }))
      }

      Object.entries(_.pick(utils.path(payload, 'options'), 'maxItems', 'maxSize', 'minAge', 'withEvents', 'cycleStrategy')).forEach(([k, v]) => {
        cache[k] = v
      })

      MemoryCaches._describe(cache).then((result) => callback(null, result))

    })

  }

  async list() {
    const entries = Array.from(this._caches.entries()),
          caches = {}
    for (const entry of entries) {
      const [name, cache] = entry
      caches[name] = await MemoryCaches._describe(cache)
    }
    return caches
  }

  add(name, options) {

    options = Object.assign(
      options || {},
      config('caches.defaults') || {},
      config('caches')[name] || {}
    )

    const cache = new MemoryCache(options)
    this._caches.set(name, cache)
    cache.on('set', (cache, keys) => logger.silly(`[cache] ${name} setting ${JSON.stringify(keys)}`))
    cache.on('full', (cache, keys) => logger.silly(`[cache] ${name} cache is too full to add  ${JSON.stringify(keys)}`))
    cache.on('add', (cache, keys) => logger.silly(`[cache] ${name} adding ${JSON.stringify(keys)}`))
    cache.on('flush', (cache, keys) => keys ? logger.silly(`[cache] ${name} flushing ${JSON.stringify(keys)}`) : logger.silly(`[cache] ${name} flushed`))
    cache.on('remove', (cache, keys) => logger.silly(`[cache] ${name} removed ${JSON.stringify(keys)}`))
    return cache
  }

  get(name) {
    return this._caches.get(name)
  }

  static async _describe(cache) {

    const { length, synchronous, maxItems, maxSize, minAge, withEvents, cycleStrategy } = cache
    return { size: synchronous ? cache.getSizeSync() : await cache.getSizeAsync(), synchronous, length, maxItems, maxSize, minAge, withEvents, cycleStrategy }
  }

}

class CacheModule {

  constructor() {

    this._memoryCaches = new MemoryCaches()

    modules.metrics.register('caches', () => {
      return this._memoryCaches.list()
    })
  }

  get(org, key, callback = noop) {

    modules.db.models.Cache.findOne({ org: (org && org._id) || null, key: String(key) }).lean().exec((err, data) => {

      if (!err && data) {
        if (data.exp && data.exp.getTime() < Date.now()) {
          data = null
        }
      }
      callback(err, !data ? undefined : data.val)
    })
  }

  async findOne(org, match, valuePaths = ['']) {

    match = Object.assign(
      match,
      { org: (org && org._id) }
    )

    const select = [
      'exp',
      ...valuePaths.map(v => `val.${v}`)
    ].join(' ')

    let data = await modules.db.models.Cache.findOne(match).select(select).lean()

    if (data) {
      if (data.exp && data.exp.getTime() < Date.now()) {
        data = Undefined
      }
    }

    return data && data.val

  }

  swap(org, replaceKey, withKey, callback = noop) {

    const filter = {
            org: (org && org._id) || null,
            key: String(replaceKey)
          },
          update = {
            $set: {
              key: String(withKey)
            }
          }

    modules.db.models.Cache.collection.updateOne(filter, update, { writeConcern: { w: 'majority' } }, (err, result) => {
      callback(Fault.from(err), Boolean(result && result.modifiedCount))
    })

  }

  has(org, key, callback = noop) {

    modules.db.models.Cache.findOne({ org: (org && org._id) || null, key: String(key) }).lean().select('exp').exec((err, data) => {
      if (!err && data) {
        if (data.exp && data.exp.getTime() < Date.now()) {
          data = null
        }
      }
      callback(err, !!data)
    })
  }

  find(org, keys, skip = 0, limit = 100, callback = noop) {

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
      key: new RegExp(`^${RegExp.escape(String(keys))}`),
      $or: [{
        exp: { $exists: false }
      }, {
        exp: { $gte: new Date() }
      }]
    }

    modules.db.models.Cache.collection.find(filter).sort({ key: 1 }).skip(skip).limit(limit).toArray((err, data) => {
      callback(err, data && data.map(v => {
        const o = { key: v.key, val: v.val }
        if (v.exp) {
          o.exp = v.exp
        }
        return o
      }))
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
        modules.db.models.Cache.collection.find(filter, { val: 0 }).sort({ key: 1 }).skip(skip).limit(limit).toArray((err, data) => {
          callback(err, data && data.map(v => {
            const o = {
              created: v._id.getTimestamp(),
              key: v.key,
              sz: v.sz
            }
            if (v.exp) {
              o.exp = v.exp
            }
            return o
          }))
        })
      },

      total: callback => {
        modules.db.models.Cache.collection.countDocuments(filter, callback)
      }

    }, (err, results) => callback(err, results && _.extend(results, { object: 'list' })))

  }

  count(org, keys, callback = noop) {

    const filter = {
      org: (org && org._id) || null,
      key: new RegExp(`^${RegExp.escape(String(keys))}`)
    }

    modules.db.models.Cache.collection.countDocuments(filter, (err, count) => callback(err, count))
  }

  set(org, key, val, ttl = null, callback = noop) {

    if (typeof ttl === 'function') {
      callback = ttl
      ttl = null
    }

    const data = {
            org: (org && org._id) || null,
            key: key,
            val: val,
            sz: 0
          },
          update = {
            $set: data
          }

    try {
      data.sz = bson.calculateObjectSize(data)
    } catch (err) {
      return callback(Fault.from(err))
    }

    if ((ttl = utils.rInt(ttl, null)) !== null) {
      update.$set.exp = new Date(Date.now() + (Math.max(0, ttl) * 1000))
    } else {
      update.$unset = {
        exp: 1
      }
    }

    modules.db.models.Cache.collection.updateOne({ org: (org && org._id) || null, key: key }, update, { upsert: true, writeConcern: { w: 'majority' } }, (err, result) => {
      callback(Fault.from(err), result && val)
    })

  }

  counter(org, key, initialTtl = 1, callback = noop) {

    initialTtl = Math.max(1, utils.rInt(initialTtl, 1))

    let sz = 0
    try {
      sz = bson.calculateObjectSize({
        org: (org && org._id) || null,
        key: key,
        val: Number.MAX_SAFE_INTEGER,
        sz: Number.MAX_SAFE_INTEGER
      })
    } catch (err) {
      return callback(Fault.from(err))
    }

    const now = new Date(),
          update = {
            $setOnInsert: {
              sz,
              exp: new Date(now.getTime() + (Math.max(0, initialTtl) * 1000))
            },
            $inc: {
              val: 1
            }
          }

    modules.db.models.Cache.collection.findOneAndUpdate(
      { org: (org && org._id) || null, key: String(key) },
      update,
      { upsert: true, returnDocument: 'after' },
      (err, result) => {

        // try again if duplicated and if missing.
        if (err) {
          if (err.code === 11000) {
            return setImmediate(() => {
              this.counter(org, key, initialTtl, callback)
            })
          }
          return callback(err)
        } else if (!(result && result.value)) {
          return this.counter(org, key, initialTtl, callback)
        }

        // if expired (or no ttl!), try to delete and restart
        const ttl = result.value.exp ? Math.max(0, result.value.exp - now) : 0
        if (ttl === 0) {
          return setImmediate(() => {
            modules.db.models.Cache.collection.deleteOne({ org: (org && org._id) || null, key: String(key), exp: result.value.exp }, err => {
              if (err) {
                return callback(err)
              }
              this.counter(org, key, initialTtl, callback)
            })
          })
        }

        callback(null, {
          ttl,
          age: Math.max(0, (now - result.value._id.getTimestamp())),
          val: result.value.val
        })
      }
    )

  }

  cas(org, key, check, val, ttl = null, callback = noop) {

    if (typeof ttl === 'function') {
      callback = ttl
      ttl = null
    }

    const data = {
            org: (org && org._id) || null,
            key: key,
            val: val,
            sz: 0
          },
          update = {
            $set: data
          }

    try {
      data.sz = bson.calculateObjectSize(data)
    } catch (err) {
      return callback(Fault.from(err))
    }

    if ((ttl = utils.rInt(ttl, null)) !== null) {
      update.$set.exp = new Date(Date.now() + (Math.max(0, ttl) * 1000))
    } else {
      update.$unset = {
        exp: 1
      }
    }

    modules.db.models.Cache.collection.findOneAndUpdate(
      { org: (org && org._id) || null, key: key, val: check },
      update,
      { projection: { val: 0 }, returnDocument: 'after' },
      (err, result) => {
        callback(Fault.from(err), !!(result && result.value))
      }
    )

    // modules.db.models.Cache.collection.updateOne({org: org._id, key: key, val: check}, update, {upsert: false, w: 'majority'}, (err, result) => {
    //    callback(Fault.from(err), result && result.modifiedCount===1 );
    // });

  }

  del(org, key, callback = noop) {

    modules.db.models.Cache.collection.deleteMany({ org: (org && org._id) || null, key: String(key) }, (err, result) => {
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

    modules.db.models.Cache.collection.deleteMany(filter, { writeConcern: { w: 'majority' } }, (err, result) => {
      callback(Fault.from(err), utils.path(result, 'deletedCount'))
    })

  }

  get memory() {
    return this._memoryCaches
  }

}

module.exports = new CacheModule()
