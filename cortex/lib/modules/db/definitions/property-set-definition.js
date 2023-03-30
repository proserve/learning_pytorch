'use strict'

var SetDefinition = require('./types/set-definition'),
    utils = require('../../../utils'),
    { array: toArray, profile, asyncWhile, equalIds } = utils,
    Fault = require('cortex-service/lib/fault'),
    modules = require('../../../modules'),
    logger = require('cortex-service/lib/logger'),
    util = require('util'),
    _ = require('underscore')

/**
 * @todo when properties are deleted, free up the indexes. we don't necesarily have to remove the properties from the actual indexes, but the slots need to be freed.
 */

const local = {
  _OODefinition: null,
  _ObjectDefinition: null,
  _PostTypeDefinition: null
}
Object.defineProperty(local, 'ObjectDefinition', { get: function() { return (this._ObjectDefinition || (this._ObjectDefinition = require('./objects/object-definition'))) } })
Object.defineProperty(local, 'OODefinition', { get: function() { return (this._OODefinition || (this._OODefinition = require('./objects/oo-definition'))) } })
Object.defineProperty(local, 'PostTypeDefinition', { get: function() { return (this._PostTypeDefinition || (this._PostTypeDefinition = require('./feeds/post-type-definition'))) } })

function _findSlot(usedSlots, freedSlots, unique, geometry) {

  let free = _.difference(modules.db.definitions[geometry ? 'GEOMETRY_SLOTS' : (unique ? 'UNIQUE_SLOTS' : 'INDEX_SLOTS')], usedSlots),
      fresh = _.difference(free, freedSlots)

  if (!free.length) {
    throw Fault.validationError('cortex.error.unspecified', { reason: geometry ? 'No more geospatial indexes are available' : (unique ? 'No more unique indexes are available.' : 'No more indexes are available.') })
  }

  // prefer those that were not freed.
  // @todo collstats to spread out index load.
  // for now, randomize.

  if (fresh.length) {
    return fresh[Math.floor(Math.random() * fresh.length)]
  }
  return free[Math.floor(Math.random() * free.length)]

}

function PropertySetDefinition(options) {

  options = utils.extend({
    label: 'Properties',
    name: 'properties',
    maxItems: 20,
    canPush: true,
    canPull: true,
    discriminatorKey: 'type',
    uniqueProp: 'name',
    uniqueKey: 'name',
    slots: 'slots' // .slots for sib, ..slots for parent sib, slots for top-level, etc.
  }, options, {
    type: 'Set',
    array: true,
    documents: modules.db.definitions.createSetProperties(
      utils.rInt(utils.option(options, 'setDepth', 1), 1),
      utils.rBool(utils.option(options, 'allowSets')),
      { exclude: toArray(options.exclude) }
    ),
    puller: function(ac, node, value) {
      const property = utils.findIdInArray(utils.path(this, node.docpath), '_id', value)
      if (property) {

        const container = utils.path(this, node.docpath),
              instancePath = modules.db.definitions.getInstancePath(property, node)

        ac.hook('save').before(function(vars, callback) {
          if (~vars.modified.map(path => utils.normalizeObjectPath(path, true, true)).indexOf(node.fullpath)) {
            if (!~utils.array(container).indexOf(value)) {
              ac.object.fireHook('property.removed.before', null, { ac: ac, instancePath: instancePath, property: property, node: node }, callback)
            }
          }
        })
        ac.hook('save').after(function(vars) {
          if (~vars.modified.map(path => utils.normalizeObjectPath(path, true, true)).indexOf(node.fullpath)) {
            if (!~utils.array(container).indexOf(value)) {
              ac.object.fireHook('property.removed.after', null, { ac: ac, instancePath: instancePath, property: property, node: node }, () => {})
            }
          }
        })
      }
      return value
    }
  })

  this.slots = options.slots

  SetDefinition.call(this, options)

  this.addDependency(this.slots)

}
util.inherits(PropertySetDefinition, SetDefinition)

PropertySetDefinition.prototype.initNode = function(root, parent, initializingASetDocument, isSetProperty) {

  SetDefinition.prototype.initNode.call(this, root, parent, initializingASetDocument, isSetProperty)

  // setup slots node. a property set may or may not have it's properties indexed. if it is, it will have a 'slots'
  // node there the ObjectIndexDefinition lives.
  //  when properties in objects are indexed/un-indexed, they will report up to their parent property set, if any, where
  //  the slots node (if it exists) will free/reserve slots for the property and triggger re-indexing.
  // when context property values are updated, the property slots node will update the property's index in a 'before save'
  // access context hook.

  var count = 0, slotsPath, slotsNode, slotsParent
  while (this.slots[count] === '.') {
    count++
  }
  if (!count) {
    slotsPath = this.slots
    slotsParent = this.root
  } else {
    slotsPath = this.slots.substring(count)
    while (count--) {
      slotsParent = (slotsParent || this).pathParent
    }
  }
  slotsNode = slotsParent ? slotsParent.findNode(slotsPath) : null

  if (!slotsNode) {
    logger.error(['Missing slots node for ', this.fullpath, '. Indexes will not function!'].join(''))
  }

  this.slotsNode = slotsNode

}

PropertySetDefinition.prototype.registerIndexUpdate = function(ac, propertyDocument) {

  // find the top-level container. for properties it's the object _id. for feed definitions, it's the feed def doc (two above the property set container.
  let tmp,
      container,
      isFeed = false,
      self = this,
      updateName

  // the property document is the property being indexed/unindexed. walk up until we find the container where the slots array live.
  tmp = propertyDocument
  while (tmp && !container) {
    if ((tmp.schema.node instanceof local.ObjectDefinition) || (tmp.schema.node instanceof local.OODefinition) || (isFeed = tmp.schema.node instanceof local.PostTypeDefinition)) {
      container = tmp
    }
    tmp = modules.db.getParentDocument(tmp)
  }

  if (!container) {
    return
  }

  updateName = ['$idxUpdates', isFeed ? this.fullpath : 'properties', container._id].join('.')

  if (this.slotsNode) {
    let updates = ac.option(updateName)
    if (!updates) {
      updates = {}
      ac.option(updateName, updates)
    }
    updates[propertyDocument._id] = propertyDocument

    ac.hook('save').before(function(vars, callback) {

      let err, start = profile.start()
      self._updateIndexes(vars.ac, container, updateName, _.values(vars.ac.option(updateName) || {}), isFeed)
        .catch(e => { err = e })
        .then(() => {
          profile.end(start, 'PropertySetDefinition._updateIndexes')
          callback(err)
        })

    }, 'before.' + updateName, true)
  }

}

PropertySetDefinition.prototype.onRemovingValue = function(ac, parentDocument, value, index) {

  // notify child elements.
  let node, current
  for (let name in this.properties) {
    if (this.properties.hasOwnProperty(name)) {
      node = this.properties[name]
      current = utils.path(value, node.docpath)
      if (current !== undefined) {
        if (node.array) {
          utils.array(current).forEach(node.onRemovingValue.bind(node, ac, value))
        } else {
          node.onRemovingValue(ac, value, current)
        }
      }
    }
  }
  SetDefinition.prototype.onRemovingValue.call(this, ac, parentDocument, value, index)
}

PropertySetDefinition.prototype._updateIndexes = async function(ac, container, updateName, updates, isFeed) {

  // the slots array is going to be unique to reach post/comment type, but shared for object and their types.

  ac.markSafeToUpdate(this.slotsNode)

  let slotsArray = isFeed ? utils.path(container, this.slotsNode.docpath) : container[this.slotsNode.docpath],
      freedSlots = [],
      usedSlots = [],
      setNode = this,
      propsObject,
      triggerUpdate = false

  if (isFeed) {
    // {body: ...} or {comments: ...}
    propsObject = utils.path({}, this.parent.path, utils.path(container, this.parent.path), true)
  } else {
    propsObject = {
      properties: container.properties,
      objectTypes: container.objectTypes
    }
  }

  if (_.isArray(slotsArray)) {

    // free slots
    let slot, doc, adding, idx, len = slotsArray.length, slotName

    await asyncWhile({
      maxUs: 500,
      while: () => len--,
      do: () => {

        slot = slotsArray[len]
        doc = null

        profile.method(
          'PropertySetDefinition.prototype._updateIndexes.walkDocument',
          () => container.schema.node.walkDocument(
            propsObject,
            function(d, n, v) {
              if (n.name === '_id' && equalIds(slot._id, v)) {
                doc = d
                return -1
              }
            },
            {
              filter: ['properties', 'documents', 'objectTypes', '_id']
            }
          )
        )()

        if (!doc || // deleted property
          (slot.unique && !doc.unique) || // de-unique property
          !doc.indexed // de-indexed property
        ) {
          freedSlots.push(slot.name)
          slotsArray.splice(len, 1)
        }
      }
    })

    if (freedSlots.length) {
      triggerUpdate = true
    }

    usedSlots = slotsArray.reduce(function(usedSlots, slot) { usedSlots.push(slot.name); return usedSlots }, usedSlots)

    // now that everything that has been removed has freed up index slots, go ahead and start adding things
    // back in, while avoiding using newly freed slots.
    len = updates.length

    await asyncWhile({
      maxUs: 500,
      while: () => len--,
      do: () => {

        doc = updates[len]

        if (doc.indexed) {

          // make sure the doc still exists in the container (could have been removed).
          adding = null
          profile.method(
            'PropertySetDefinition.prototype._updateIndexes.walkDocument',
            () => container.schema.node.walkDocument(
              propsObject,
              function(d, n, v) {
                if (n.name === '_id' && equalIds(doc._id, v)) {
                  adding = d
                  return -1
                }
              },
              {
                filter: ['properties', 'documents', 'objectTypes', '_id']
              }
            )
          )()

          if (!adding) {
            return
          }

          idx = _.findIndex(slotsArray, slot => equalIds(slot._id, doc._id))

          // sanity check. if the options don't match, remove and re-add.
          if (~idx) {
            if (slotsArray[idx].unique !== doc.unique) {
              freedSlots.push(slotsArray[idx].name)
              slotsArray.splice(idx, 1)
              triggerUpdate = true
              idx = -1
            }
          }

          if (!~idx) {
            // find a free slot for the reference.
            slotName = _findSlot(usedSlots, freedSlots, doc.unique, doc.type === 'Geometry')
            usedSlots.push(slotName)

            if (!doc.isNew) {
              triggerUpdate = true
            }

            slotsArray.push({
              _id: doc._id,
              unique: doc.unique,
              name: slotName
            })
          }

        }

      }

    })

  }

  if (triggerUpdate) {

    // trigger the worker using the property set fully qualified path?, so we can use it to get back at the indexes.
    ac.hook('save').after(function(vars) {
      modules.workers.send(
        'work',
        'indexer',
        {
          org: ac.orgId,
          object: this.lookup,
          setPath: isFeed ? setNode.fullpath : 'properties',
          setId: isFeed ? container._id : this.lookup
        },
        {
          reqId: ac.req,
          orgId: ac.orgId
        }
      )
    }, 'after.' + updateName, true)
  }

}

module.exports = PropertySetDefinition
