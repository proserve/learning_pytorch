'use strict'

const crypto = require('crypto'),
      _ = require('underscore'),
      { resolveOptionsCallback, rString, isCustomName } = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../consts'),
      modules = require('../modules'),
      models = modules.db.models,
      acl = require('../acl'),
      ap = require('../access-principal')

class SchemasModule {

  getNativeObjectsNames(org) {

    return (org.configuration.legacyObjects
      ? Object.keys(consts.NativeIds)
      : (_.difference(Object.keys(consts.NativeIds), Object.keys(consts.LegacyObjectIds)))
    ).concat(Object.keys(consts.NativeObjects))

  }

  /**
     * @param org
     * @param objects an array of objects containing lookup and sequence properties.
     * @returns {*}
     */
  calculateSchemasETag(org, objects) {

    const list = [
      ...this.getNativeObjectsNames(org).map(key => {
        const model = models[key]
        return model.objectId + '@' + (model.sequence || 0)
      }),
      ...objects.map(info => {
        return info.lookup + '@' + (info.sequence || 0)
      })
    ].sort()

    return crypto.createHash('md5').update(list.join(' ')).digest('hex')

  }

  generateSchema(org, doc, callback) {

    modules.db.definitions.generateCustomModel(doc && doc.toObject ? doc.toObject() : doc, (err, model) => {
      let schema
      if (!err) {
        schema = JSON.stringify(model.schema.node.apiSchema({ asRoot: true }))
      }
      callback(err, schema)
    })

  }

  isSchemaCacheOutdated(org, doc) {
    let name = rString(doc.name, '').toLowerCase().trim(),
        nativeNames = this.getNativeObjectsNames(org),
        isNativeModel = nativeNames.includes(name),
        model = isNativeModel && models[name]

    return model && JSON.parse(doc.schemaCache || '{}').nativeSchemaVersion !== model.nativeSchemaVersion
  }

  getSchema(org, name, options, callback_) {

    [options, callback_] = resolveOptionsCallback(options, callback_)

    name = rString(name, '').toLowerCase().trim()

    const callback = (err, schema, properties) => {
            if (!err && schema && options.asObject) {
              schema = JSON.parse(schema)
            }
            callback_(err, schema, properties)
          },
          isOO = isCustomName(name, 'o_', false),
          object = isOO ? 'oo' : 'object'

    if (isOO || org.findObjectInfo(name)) {

      models[object].collection.find({ reap: false, org: org._id, object, name }).limit(1).project({ name: 1, schemaCache: 1, properties: 1, localized: 1, useBundles: 1 }).toArray((err, docs) => {
        const doc = docs && docs[0]
        if (err) {
          return callback(err)
        } else if (!doc) {
          return callback(Fault.create('cortex.notFound.object'))
        } else if (doc.schemaCache && !this.isSchemaCacheOutdated(org, doc)) {
          return callback(null, doc.schemaCache, doc)
        }
        modules.db.sequencedFunction(
          function(callback) {
            models[object].findOne({ reap: false, org: org._id, object, name }, (err, doc) => {
              if (err || !doc) {
                return callback(err || Fault.create('cortex.notFound.object'))
              }
              doc.markModified('schemaCache')
              const ac = new acl.AccessContext(ap.synthesizeAnonymous(org), doc)
              ac.save(err => {
                callback(err, doc.schemaCache, doc)
              })
            })
          },
          10,
          callback
        )
      })

    } else {

      const nativeNames = this.getNativeObjectsNames(org),
            visible = nativeNames.includes(name),
            model = visible && models[name]

      if (!model) {
        return callback(Fault.create('cortex.notFound.object'))
      }

      let err, schema
      try {
        const node = model.schema.node
        schema = node.__apiSchema || (node.__apiSchema = JSON.stringify(models[name].schema.node.apiSchema({ asRoot: true })))
      } catch (e) {
        err = e
      }
      return callback(err, schema)

    }

  }

}

module.exports = new SchemasModule()
