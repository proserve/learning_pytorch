'use strict'

const modules = require('../modules'),
      { isBoolean } = require('underscore'),
      { tryCatch, rBool, isSet, resolveOptionsCallback, bson } = require('../utils'),
      pathTo = require('../classes/pather').sandbox,
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      noop = () => {},
      Model = modules.db.models.Config,
      maxSize = config('modules.config.maxSize') || 1024 * 512

let Undefined

function makeValueKey(key) {
  if (key === null) {
    return 'val'
  }
  return `val.${key}`
}

function isTopLevelValueKey(valueKey) {
  const top = valueKey.split('.')[1] // what's after 'val'
  return valueKey === `val.${top}`
}

function makeMetadataKey(key) {
  if (key === null) {
    return 'metadata'
  }
  return `metadata.${key.split('.')[0]}`
}

function updateDoc(doc, key, val, { isPublic = false }) {

  const metadataKey = makeMetadataKey(key),
        valueKey = makeValueKey(key),
        [err] = tryCatch(() => {

          doc = pathTo(doc, valueKey, val, true)

          // only update metadata on non-wholesale changes on top level metadata keys.
          if (isBoolean(isPublic) && isTopLevelValueKey(valueKey)) {
            doc = pathTo(doc, `${metadataKey}.isPublic`, isPublic, true)
          }

          const sz = bson.calculateObjectSize(doc)
          if (sz > maxSize) {
            throw Fault.create('cortex.tooLarge.config', { reason: 'Breached maximum config storage limit of ' + maxSize + ' bytes by ' + (sz - maxSize) })
          }

        })

  return err
}

class ConfigModule {

  get maxSize() {
    return maxSize
  }

  /**
   *
   * @param org
   * @param options
   *  extended {Boolean=false} = if true, returns an array with extended key information (isPublic: Boolean, value: *)
   *  values {Boolean=false} = if true, retrieves values with extended information (sets extended to true)
   *  publicOnly {Boolean=false} = if true, only retrieves public keys.
   * @param callback
   */
  keys(org, options, callback = noop) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const publicOnly = rBool(options.publicOnly, false),
          values = rBool(options.values, false),
          extended = values || rBool(options.extended, false),
          match = { org: (org && org._id) || null },
          select = { metadata: 1 }

    // metadata may only exist for public keys.
    if (!publicOnly || values) {
      select.val = 1
    }

    Model.findOne(match).select(select).lean().exec((err, doc) => {

      let keys

      if (!err) {

        if (publicOnly) {
          // public metadata keys will always exist.
          keys = Object.entries(doc?.metadata || {}).filter(([k, v]) => v?.isPublic).map(([k]) => k)
        } else {
          keys = Object.keys( doc?.val || {} )
        }

        if (extended) {
          keys = keys.map(key => {
            const v = ({
              key,
              isPublic: rBool(pathTo(doc, `metadata.${key}.isPublic`), false)
            })
            if (values) {
              v.value = pathTo(doc, `val.${key}`)
            }
            return v
          })
        }

      }
      callback(err, keys)

    })

  }

  /**
   *
   * @param org
   * @param key
   * @param options
   *  extended {Boolean=false} = if true, returns an array with extended key information (isPublic: Boolean)
   *  publicOnly {Boolean=false} = if true, only retrieves public keys.
   * @param callback
   */
  get(org, key, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const extended = rBool(options.extended, false),
          publicOnly = rBool(options.publicOnly, false),
          valueKey = makeValueKey(key),
          metadataKey = makeMetadataKey(key),
          blankFieldName = valueKey.endsWith('.'),
          isTopLevel = valueKey === 'val'

    if (blankFieldName) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Blank field names are not allowed.' }))
    }

    Model.findOne({ org: (org && org._id) || null }).select({ [valueKey]: 1, [metadataKey]: 1 }).lean().exec((err, doc) => {

      let value = pathTo(doc, valueKey)

      if (!err) {

        const valueKeys = (isTopLevel && doc && Object.keys(doc.val)) || [],
              isPublic = isTopLevel
                ? valueKeys.every(k => pathTo(doc, `metadata.${k}.isPublic`))
                : rBool(pathTo(doc, `${metadataKey}.isPublic`), false)

        if (publicOnly) {

          if (isTopLevel) {

            value = valueKeys.reduce((memo, k) => {
              if (rBool(pathTo(doc, `${makeMetadataKey(k)}.isPublic`), false)) {
                Object.assign(memo, { [k]: pathTo(doc, `${makeValueKey(k)}`) })
              }
              return memo
            }, {})

          } else if (!isPublic) {

            value = Undefined

          }

        }

        if (!err && extended && value !== Undefined) {
          value = {
            value,
            isPublic
          }
        }
      }
      callback(err, value)

    })

  }

  /**
   *
   * @param org
   * @param key
   * @param val
   * @param options
   *  - isPublic { Boolean=null } if set, also change the isPublic metadata property for top-level config keys.
   * @param callback
   */
  set(org, key, val = null, options, callback = noop) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const metadataKey = makeMetadataKey(key),
          valueKey = makeValueKey(key),
          isPublic = isSet(options.isPublic) ? rBool(options.isPublic, false) : null,
          blankFieldName = valueKey.endsWith('.')

    if (blankFieldName) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Blank field names are not allowed.' }))
    }

    modules.db.sequencedFunction(
      callback => {

        Model.findOne({ org: (org && org._id) || null }).lean().exec((err, doc) => {

          if (err) {

            callback(err)

          } else if (doc && val === null) {

            const $unset = { [valueKey]: 1 }
            if (valueKey === 'val' || isTopLevelValueKey(valueKey)) {
              $unset[metadataKey] = 1
            }

            Model.collection.updateOne(
              { org: (org && org._id) || null, sequence: doc.sequence },
              { $unset, $inc: { sequence: 1 } },
              (err, result) => {
                if (!err && result['matchedCount'] === 0) {
                  err = Fault.create('cortex.conflict.sequencing')
                }
                callback(err, val)
              }
            )

          } else if (doc && val !== null) {

            const err = updateDoc(doc, key, val, { isPublic })

            if (err) {
              return callback(err)
            }

            Model.collection.updateOne(
              { org: (org && org._id) || null, sequence: doc.sequence },
              { $set: { val: doc.val, metadata: doc.metadata }, $inc: { sequence: 1 } },
              (err, result) => {
                if (!err && result['matchedCount'] === 0) {
                  err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error' })
                }
                callback(err, val)
              }
            )

          } else if (val === null) {

            callback(null, false)

          } else {

            doc = {
              org: (org && org._id) || null,
              sequence: 0
            }

            const err = updateDoc(doc, key, val, { isPublic })

            if (err) {
              return callback(err)
            }

            Model.collection.insertOne(
              doc,
              err => {
                if (err) {
                  if (err.code === 11000) {
                    err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error' })
                  }
                }
                callback(err, val)
              }
            )

          }
        })
      },
      Number.MAX_SAFE_INTEGER,
      callback
    )

  }

}

module.exports = new ConfigModule()
