'use strict'

const moment = require('moment'),
      util = require('util'),
      { extend, getIdOrNull, resolveOptionsCallback, rInt } = require('../../../../utils'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      ModelDefinition = require('../model-definition'),
      { fileStorage, docStorage } = consts.operations.codes

class StatsGroup {

  constructor() {
    this.map = new Map()
  }

  add(code, org, source, object, type = null, property = null, count, size, startOfPeriod = new Date()) {

    const key = `${code}.${org}.${source}.${object}.${type}.${property}.${startOfPeriod.toISOString()}`
    let entry = this.map.get(key)
    if (!entry) {
      entry = { code, org, source, object, type, property, count: 0, size: 0, startOfPeriod }
      this.map.set(key, entry)
    }
    entry.count += count
    entry.size += size
    return entry
  }

  removeFacet(doc, facet) {

    const { org, object, type } = doc,
          { _pi: property, size } = facet,
          { Stat } = modules.db.models

    this.add(fileStorage, org, Stat.getDocumentSource(doc), object, type, property, -1, -size)
  }

  removeDoc(doc) {

    const { org, object, type, meta: { sz: size } } = doc,
          { Stat } = modules.db.models

    this.add(docStorage, org, Stat.getDocumentSource(doc), object, type, null, -1, -size)
  }

  removeFile(org, object, count, size) {

    this.add(fileStorage, org, object, object, null, null, -count, -size)
  }

  save() {

    const { Stat } = modules.db.models

    for (const { code, org, source, object, type, property, count, size, startOfPeriod } of this.map.values()) {
      Stat.addRemove(org, code, source, object, type, property, count, size, startOfPeriod)
    }
    this.map.clear()
  }

}

function StatDefinition() {

  this._id = StatDefinition.statics._id
  this.objectId = StatDefinition.statics.objectId
  this.objectLabel = StatDefinition.statics.objectLabel
  this.objectName = StatDefinition.statics.objectName
  this.pluralName = StatDefinition.statics.pluralName

  const options = {

    label: 'Stat',
    name: 'stat',
    _id: consts.NativeObjects.stat,
    pluralName: 'stats',

    properties: [
      {
        label: 'Id',
        name: '_id',
        type: 'ObjectId',
        auto: true,
        readable: true,
        nativeIndex: true
      },
      {
        label: 'Starting',
        name: 'starting',
        type: 'Date',
        nativeIndex: true
      },
      {
        label: 'Ending',
        name: 'ending',
        type: 'Date',
        nativeIndex: true
      },
      {
        label: 'Org',
        name: 'org',
        type: 'ObjectId',
        nativeIndex: true
      },
      {
        label: 'Object',
        name: 'object',
        type: 'String',
        virtual: true,
        reader: function(ac, node, selection) {
          return node.root.objectName
        }
      },
      {
        label: 'Code', // this is the main discriminator
        name: 'code',
        type: 'Number',
        nativeIndex: true
      },

      // more or less universal items
      {
        label: 'Count',
        name: 'count',
        type: 'Number'
      },
      {
        label: 'Size',
        name: 'size',
        type: 'Number'
      },
      {
        label: 'Total',
        name: 'total',
        type: 'Number'
      },
      {
        label: 'Duration',
        name: 'duration',
        type: 'Number'
      },

      // for doc and file storage in contexts and posts.
      {
        label: 'Source',
        name: 's_source',
        type: 'String'
      }, {
        label: 'Source Object',
        name: 's_object',
        type: 'String'
      }, {
        label: 'Soruce Type',
        name: 's_type',
        type: 'String'
      }, {
        label: 'Property',
        name: 's_property',
        type: 'ObjectId'
      },

      // for logins and accounts (logged in today and created today.)
      {
        label: 'Today',
        name: 'today',
        type: 'Number'
      },
      {
        label: 'Active',
        name: 'active',
        type: 'Number'
      },

      // for request stats
      {
        label: 'Location',
        name: 'location',
        type: 'Number'
      }, {
        label: 'Client',
        name: 'client',
        type: 'ObjectId'
      }, {
        label: 'Method',
        name: 'method',
        type: 'Number'
      }, {
        label: 'Api',
        name: 'api',
        type: 'String'
      }, {
        label: 'Ms',
        name: 'ms',
        type: 'Number'
      }, {
        label: 'In',
        name: 'in',
        type: 'Number'
      }, {
        label: 'Out',
        name: 'out',
        type: 'Number'
      }, {
        label: 'Errors',
        name: 'errs',
        type: 'Number'
      },

      // for scripts
      {
        label: 'Script Identifier',
        name: 'scriptId',
        type: 'ObjectId'
      },
      {
        label: 'Script Type',
        name: 'scriptType',
        type: 'String'
      },
      {
        label: 'Callouts',
        name: 'callouts',
        type: 'Number'
      },
      {
        label: 'Callouts MS',
        name: 'calloutsMs',
        type: 'Number'
      },
      {
        label: 'Ops Used',
        name: 'ops',
        type: 'Number'
      },

      // for notification stats
      {
        label: 'Notification Type',
        name: 'notifType',
        type: 'ObjectId'
      },
      {
        label: 'Endpoint Type',
        name: 'notifEndpoint',
        type: 'ObjectId'
      }

    ]

  }

  ModelDefinition.call(this, options)
}
util.inherits(StatDefinition, ModelDefinition)

StatDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = StatDefinition.statics
  options.methods = StatDefinition.methods
  options.indexes = StatDefinition.indexes
  options.options = extend({
    versionKey: false
  }, options.options)

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

StatDefinition.statics = {

  _id: consts.NativeObjects.stat,
  objectId: consts.NativeObjects.stat,
  objectLabel: 'Stat',
  objectName: 'stat',
  pluralName: 'stats',
  requiredAclPaths: ['_id', 'org'],

  StatsGroup,

  getDocumentSource: function({ pcontext, context, object } = {}) {
    return (pcontext && pcontext.object) || (context && context.object) || object || null
  },

  addRemove: function(org, code, source, object, type, property, count, size, startOfPeriod = new Date()) {

    const starting = moment(startOfPeriod).utc().startOf('day').toDate(),
          ending = moment(startOfPeriod).utc().endOf('day').toDate(),
          { collection } = this,
          match = {
            org,
            starting,
            ending,
            code,
            s_source: source,
            s_object: object,
            s_type: type,
            s_property: property
          },
          update = {
            $setOnInsert: match,
            $inc: {
              'ops': 1,
              'delta.count': count,
              'delta.size': size
            }
          }

    collection.updateOne(match, update, { upsert: true }, err => err && logger.error('failed to update storage stat', update))

  },

  addRemoveFacet: function(org, source, object, type, property, count, size) {
    this.addRemove(org, consts.operations.codes.fileStorage, source, object, type, property, count, size)
  },

  addRemoveDocuments: function(org, source, object, type, count, size) {
    this.addRemove(org, consts.operations.codes.docStorage, source, object, type, null, count, size)
  },

  addRemoveFiles: function(org, object, count, size) {
    this.addRemove(org, consts.operations.codes.fileStorage, object, object, null, null, count, size)
  },

  /**
   *
   * @param orgId
   * @param options
   *  days = 10 how far back to go.
   * @param callback
   * @returns {*}
   */
  reconcile: function(orgId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    const request = {
            cancel: () => {
              this.cancelled = true
            }
          },
          org = getIdOrNull(orgId),
          days = rInt(options.days, 120),
          { collection } = this,
          find = {
            org,
            code: { $in: [fileStorage, docStorage] },
            delta: { $exists: true }
          }

    Promise.resolve(null)
      .then(async() => {

        let modified = 0,
            nextStart = moment().utc().startOf('day').subtract(days, 'days').toDate()

        while (1) {

          if (request.cancelled) {
            throw Fault.create('cortex.error.aborted')
          }

          find.starting = { $gt: nextStart }

          // find the earliest instance with non-reconciled stats deltas. specify how far to go back because deltas
          // are not indexed. use idxStarting (org, starting, code)
          const doc = await collection.find(find).sort({ starting: 1 }).limit(1).next()

          // all caught up is no deltas remain
          if (!doc) {

            break

          } else {

            modified += 1

            // find the first previous entry that matches the signature. if none is found, assume this is a new object
            // and assign values based on the current document. otherwise, add them together and update while
            // un-setting the delta object.
            // make sure nothing has updated the doc in the meantime by searching for the same signature.
            const { code, org, starting, s_source, s_object, s_type, s_property, ops, delta } = doc, // eslint-disable-line camelcase
                  prev = await collection
                    .find({
                      org,
                      starting: { $lt: starting },
                      code,
                      s_source,
                      s_object,
                      s_type,
                      s_property
                    })
                    // sort in reverse order to get first match
                    .sort({ starting: -1 }).limit(1).next(),
                  count = rInt((doc.count || !prev) ? delta.count : prev.count),
                  size = rInt((doc.size || !prev) ? delta.size : prev.size)

            await collection.updateOne(

              // match the same number of ops to ensure any fresh updates in the current period are kept.
              // if the update fails, just try again.
              // add deltas
              {
                _id: doc._id,
                ops
              },
              {
                $unset: {
                  delta: 1
                },
                $inc: {
                  count,
                  size
                }
              },
              {
                upsert: false
              })

          }

        }

        // fill in blank spots with previous totals?
        if (!request.cancelled) {
          await this.fillBlankStorageRecords(org, { days })
        }

        return modified
      })
      .then(v => callback(null, v))
      .catch(e => callback(e))

    return request

  },

  fillBlankStorageRecords: async function(orgId, options = {}) {

    options = options || {}

    const org = getIdOrNull(orgId),
          days = rInt(options.days, 120),
          { collection } = this,
          now = new Date(),
          starting = moment(now).utc().startOf('day').subtract(days, 'days').toDate(),
          current = moment(now).utc().startOf('day').toDate() // including current period would mess things up.

    for (const code of [fileStorage, docStorage]) {

      const entries = await collection.aggregate([{
        $match: {
          org,
          starting: { $gte: starting, $lt: current },
          code
        }
      }, {
        $group: {
          _id: '$starting',
          starting: { $first: '$starting' },
          ending: { $first: '$ending' },
          count: { $sum: '$count' },
          size: { $sum: '$size' }
        }
      }, {
        $sort: {
          starting: 1
        }
      }]).toArray()

      let prev = entries[0]

      for (let i = 1; i < entries.length; i += 1) {

        const curr = entries[i]

        let diff = curr.starting - prev.starting,
            inserts = new Array((diff / 86400000) - 1).fill(0).map((v, i) => {
              return {
                org,
                code,
                starting: new Date(prev.starting.getTime() + ((i + 1) * 86400000)),
                ending: new Date(prev.ending.getTime() + ((i + 1) * 86400000)),
                s_object: null,
                s_property: null,
                s_source: null,
                s_type: null,
                count: curr.count,
                size: curr.size
              }
            })

        if (inserts.length > 0) {
          await collection.insertMany(inserts)
        }

        prev = curr

      }
    }
  }

}

StatDefinition.indexes = [

  [{ org: 1, starting: 1, code: 1 }, { name: 'idxStarting' }],

  [{ org: 1, ending: 1, code: 1 }, { name: 'idxEnding' }],

  [{ org: 1, code: 1, ending: -1 }, { name: 'idxCode' }]

]

module.exports = StatDefinition
