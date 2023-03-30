'use strict'

// @todo https://jira.mongodb.org/browse/SERVER-14876
//     - projecting favorites in elemmatch in aggregation. change to $cond?
//     - $setIntersection !!!

// @todo grouping can limit our projections to utilized elements.

// @todo: add created nativeIndex, using the object id to translate values. Don't allow millisecond resolution or exact matching.

// @todo: force the application of limits when not grouping. index segment body ids?

/*
 * @todo for stage 1, comment and post queries must be pinned to a single post type.
 *
 *
 * @todo better field path management for nativeIndex replacers of field names.
 * @todo. ensure a non-indexed document contains sub fields.
 *
 * optimizations...
 *
 *  @todo if not in a document array of any sort, we can leave out the native portion of the query altogether.
 *  @todo allow size using indexes 'arr.1', etc.
 *
 */

const _ = require('underscore'),
      utils = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      clone = require('clone'),
      acl = require('../../acl'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      modules = require('../../modules'),
      Hooks = require('../../classes/hooks')

/**
 *
 * @param principal the calling principal.
 * @param model the top-level model.
 * @param options
 *  defaultAclOverride - a default acl to augment.
 *  withVariables - allow "{{foo}}" variables as literal values.
 *  models - models to use for cross-object node validation.
 *  relaxLimits: allow limits.
 *  skipIndexChecks: allow anything to be searched.
 * @constructor
 */
function Parser(principal, model, options) {

  options = options || {}

  // this map contains properties that, when processed, are treated as arrays (or not) depending on whether they have been mapped.
  this._treatAsArray = new Map()

  this.reset()

  this.relaxLimits = !!options.relaxLimits
  this.skipIndexChecks = !!options.skipIndexChecks
  this.object = model
  this.principal = principal
  this.accessLevel = acl.AccessLevels.None
  this.ac = new acl.AccessContext(principal, null, model)
  this.apiHooks = new Hooks()
  this._withVariables = utils.rBool(utils.path(options, 'withVariables'), false)
  this._allowSystemAccess = utils.rBool(utils.path(options, 'allowSystemAccessToParserProperties'), false)

  if (utils.path(options, 'defaultAclOverride')) {
    this.ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAclOverride, model.defaultAcl))
  }

  this.definitions = new Map()
  utils.array(options.models).forEach(function(model) {
    var obj = {
      ac: new acl.AccessContext(principal, null, model),
      model: model
    }
    if (utils.path(options, 'defaultAclOverride')) {
      obj.ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAclOverride, model.defaultAcl))
    }
    this.definitions.set(model.schema.node, obj)
  }.bind(this))

}

Parser.BATCH_LIMIT = 20
Parser.MAX_WHERE_DEPTH = 5
Parser.MAX_GROUP_DEPTH = 5 // group expression chain depth.
Parser.MAX_EXPRESSION_KEYS = 10
Parser.MAX_GROUP_ACCUMULATORS = 40
Parser.MAX_$IN_ELEMENTS = 100
Parser.MAX_$ALL_ELEMENTS = 100
Parser.MAX_GROUP_ELEMENTS = 10
Parser.MAX_GROUP_BY_FIELDS = 10
Parser.MAX_LOGICAL_CONDITIONS = 10
Parser.MAX_REGEXP_LENGTH = 40
Parser.MAX_SKIP = 500000
Parser.FIELD_NAME_REGEX = /^[a-zA-Z0-9-_]{1,40}$/
Parser.FIELD_PATH_REGEX = /^[a-zA-Z0-9-_.]{1,200}$/
Parser.VARIABLE_REGEX = /^\{{2}([a-zA-Z0-9-_.]{1,100})\}{2}$/

Parser.prototype.reset = function() {

  this._treatAsArray.clear()

  this._variables = {
    where: {},
    map: {},
    group: {},
    sort: {}
  }

  this._batch = null
  this._where = []
  this._map = []
  this._group = []
  this._sort = []
  this._skip = []
  this._limit = []

  this._context = this._addedToLimit = null

  this._parsed = this._total = this._reverseResult = this._ascending = false
  this.apiHooks = new Hooks()

}

Parser.prototype.hook = function(name) {
  return this.apiHooks.register(name)
}

/**
 * @param options
 *  where
 *      match expression
 *  map
 *      single top-level [doc]array + match expression
 *  group
 *      $by + aggregators. must have aggregators. auto-named. $by fields must not be uniquely indexed, _id fields.
 *  sort
 *      top level indexed properties or (with group) any field in the output (eg. avg_dayOfMonth_dob)
 *  skip
 *      offset into results.
 *  limit
 *      number of documents to return
 *  offset
 *      @todo
 *  addToLimit
 *  allowNoLimit
 *  total
 *      default false. true to add total (can be expensive as it runs the query again without limit)
 *
 * startingAfter
 * endingBefore
 *
 */
Parser.prototype.parse = function(options) {

  if (this._parsed) {
    throw Fault.create('cortex.error.unspecified', { reason: 'Query parser called multiple times without reset.' })
  }
  this._parsed = true

  // pre-trip --------------------------

  if ((options.startingAfter !== undefined || options.endingBefore !== undefined) && (options.where || options.map || options.group || options.sort)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'startingAfter/endingBefore is incompatible with where/map/group/sort.' })
  }

  // allow offset only when mapping and/or grouping
  if (options.offset != null && !(options.map || options.group)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'offset is only available using map and/org group' })
  }

  let where = options.where,
      sort = options.sort,
      startingAfter,
      endingBefore,
      defaultLimit = utils.option(options, 'defaultLimit', config(this.ac.script ? 'sandbox.defaultListLimit' : 'contexts.defaultLimit')),
      maxLimit = utils.option(options, 'maxLimit', config('contexts.maxLimit')),
      limit = utils.option(options, 'limit', defaultLimit)

  // --------------------------

  // when using endingBefore, reverse the order and reverse the output.
  if ((startingAfter = utils.getIdOrNull(options.startingAfter)) || (endingBefore = utils.getIdOrNull(options.endingBefore))) {
    this._reverseResult = this._ascending = !startingAfter
    where = utils.path({}, '_id.' + (this._ascending ? '$gt' : '$lt'), startingAfter || endingBefore, true)
    sort = { _id: this._ascending ? 1 : -1 }
  }

  // --------------------------

  if (options.skip != null) {
    let skip = utils.rInt(options.skip, null)
    if (skip === null || skip < 0 || (!this.relaxLimits && skip > Parser.MAX_SKIP)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'skip query option must be an integer between 0 and ' + Parser.MAX_SKIP + ', inclusive' })
    }
    if (skip > 0) {
      this._skip.push({ $skip: skip })
    }
  }

  // --------------------------

  if (limit === false && !utils.option(options, 'allowNoLimit')) {
    limit = defaultLimit
  } else if (limit !== false) {
    limit = utils.rInt(limit, null)
    if (limit === null || limit < 1 || limit > maxLimit) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'limit query option must be an integer between 1 and ' + maxLimit + ', inclusive' })
    }
    limit = utils.queryLimit(limit, this.ac.script, defaultLimit, maxLimit)
  }
  var addToLimit = limit !== false && !!utils.option(options, 'addToLimit', true)

  if (addToLimit) {
    limit++
  }

  if (limit !== false) {
    this._limit.push({ $limit: limit })
  }
  this._addedToLimit = addToLimit

  // --------------------------

  this._context = 'where'

  if (where) {
    this._where.push({ $match: this._parseMatch(where) })
  }

  this._context = 'map'

  this._parseMap(options.map)

  this._context = 'group'

  this._parseGroup(options.group)

  this._context = 'sort'

  if (sort) {
    this._sort.push({ $sort: this._parseSort(sort) })
  } else if (this.principal.org.configuration.defaultIdentifierSortOrder !== 0) {
    this._sort.push({ $sort: { _id: this.principal.org.configuration.defaultIdentifierSortOrder } }) // default sorting by id in ascending order
  }

  this._context = null

  this._total = utils.rBool(options.total, false)

  // post-trip --------------------------

  if (utils.path(this._group, '0.$group._id') === null && this._skip.length) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'skip query option cannot be greater than 0 when aggregating to a single document.' })
  }

}

Parser.prototype.setBatch = function(field, values) {
  this._batch = field == null ? null : { field: field, values: values }
}

Parser.prototype.isBatch = function(field, values) {
  return !!this._batch
}

Parser.prototype.addRawMatch = function(where) {

  if (_.isString(where)) {
    try {
      where = JSON.parse(where)
    } catch (e) {
      var fault = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid where JSON format', path: '' })
      fault.add(e)
      throw fault
    }
  }

  if (!utils.isPlainObject(where)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for where component', path: '' })
  }

  if (Object.keys(where).length > 0) {
    this._where.push({ $match: where })
  }

}

Parser.prototype.isModelFormat = function() {
  return this._group.length === 0
}

Parser.prototype.buildPipeline = function(options) {

  // implement select for projection in pipeline. project right after initial match.

  // only select certain bits. we must be careful here, because we might exclude something used in a group expression.
  const project = []

  // @todo: add all utilized properties and selections only.
  if (this.isModelFormat() && options.select) {
    project.push({ $project: options.select })
  }

  let reader = {
    pipeline: this._where.concat(project, this._map, this._group, this._sort, this._skip, this._limit),
    total: this._total ? this._where.concat(project, this._map, this._group, [{ $group: { _id: null, total: { $sum: 1 } } }]) : null
  }

  if (reader.pipeline.length === 0) {
    reader.pipeline.push({ $match: {} })
  }

  return reader

}

Parser.prototype.buildQuery = function(options) {

  options = options || {}

  let where,
      find,
      queryTotal = null,
      query

  if (options.where) {
    where = [options.where].concat(this._where)
  } else {
    where = this._where
  }

  find = where.reduce(function(find, entry) {
    if (!find) {
      return entry.$match
    } else if (!find.$and) {
      return { $and: [find, entry.$match] }
    }
    find.$and.push(entry.$match)
    return find
  }, null)

  queryTotal = null

  if (this._total) {
    queryTotal = find // used for total.
  }

  query = this.object.find(find).sort(this._sort[0].$sort)

  if (options.select) {
    query = query.select(options.select)
  }

  if (this._skip.length) {
    query.skip(this._skip[0].$skip)
  }

  if (this._limit.length) {
    query.limit(this._limit[0].$limit)
  }

  query.lean()

  return {
    query: query,
    total: queryTotal
  }

}

Parser.prototype._execPipeline = function(reader, options, callback) {

  if (options.stream) {
    return callback(null, this.object.collection.aggregate(reader.pipeline, { cursor: {} }))
  }

  this.object.collection.aggregate(reader.pipeline, { cursor: {} }).toArray(function(err, results) {

    if (err) {
      return callback(err)
    }

    var count = results.length,
        limit = this._limit.length ? this._limit[0].$limit : false
    if (this._addedToLimit && count === limit) {
      results.pop()
    }

    if (this._reverseResult) {
      results.reverse()
    }

    results = {
      object: 'list',
      data: results,
      hasMore: limit !== false && count === limit
    }

    if (!reader.total) {
      return callback(null, results)
    }

    this.object.collection.aggregate(reader.total, { cursor: {} }).toArray(function(err, total) {
      if (!err) {
        results.total = utils.rInt(utils.path(total, '0.total'), 0)
      }
      callback(err, results)
    })

  }.bind(this))

}

/**
 * @param options
 *  select: paths to select. may be overriden if applying group.
 *  stream: false. if true, streams results using stream interface. the result will be a stream object instead of a result set.
 *  streams cannot be used in conjuction with batched calls.
 *
 * @param callback
 */
Parser.prototype.exec = function(options, callback) {

  this.apiHooks.fire(this, 'exec.before', null, {}, err => {

    if (err) {
      return callback(err)
    }

    options = options || {}

    if (this._batch) {

      if (options.stream) {
        return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Parser executed with batch and stream option' }))
      }

      let results = {
            object: 'map',
            data: {}
          },
          reader = this.buildPipeline(options)

      async.eachLimit(this._batch.values, Parser.BATCH_LIMIT,
        function(value, callback) {

          let match = [{ $match: { [this._batch.field]: value } }],
              batchReader = {
                pipeline: match.concat(reader.pipeline),
                total: reader.total ? match.concat(reader.total) : null
              }

          this._execPipeline(batchReader, options, function(err, result) {
            if (!err) {
              results.data[value] = result
            }
            callback(err)
          })
        }.bind(this),

        function(err) {
          callback(err, results)
        }
      )

    } else {

      if (this._total) {
        if (options.stream) {
          return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Parser executed with total and stream option' }))
        }
      }

      this._execPipeline(this.buildPipeline(options), options, callback)

    }

  })

}

Object.defineProperties(Parser.prototype, {
  where: {
    get: function() {
      return this._where
    }
  },
  map: {
    get: function() {
      return this._map
    }
  },
  group: {
    get: function() {
      return this._group
    }
  },
  sort: {
    get: function() {
      return this._sort
    }
  }

})

Parser.normalizeMap = function(map) {

  var path
  if (_.isString(map) && map.match(/^[0-9a-z_]+$/i)) {
    path = map
    map = {}
    map[path] = null
  }
  if (_.isString(map)) {
    try {
      map = JSON.parse(map)
    } catch (e) {
      map = null
      let fault = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid map JSON format', path: '' })
      fault.add(e)
      throw fault
    }
  }
  if (!utils.isPlainObject(map)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for map component', path: '' })
  }

  return map

}

Parser.prototype._parseMap = function(map) {

  if (!map) {
    return
  }

  let keys, path, properties, property, typeName

  map = Parser.normalizeMap(map)

  keys = Object.keys(map)

  if (keys.length !== 1) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Map component requires a single field', path: '' })
  }

  // the property is not required to be indexed?
  // property must be an array, at a single level.
  path = keys[0]

  // normalize the path and make sure nothing funky was passed.
  if (path !== utils.normalizeObjectPath(path, true, true, true)) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Invalid field name: (' + path + ')', path: '' })
  }
  properties = this._processProperty(path, new Chain(), { skipChildProcessing: true, skipIndexCheck: true, requireArray: true, noArrayParents: true, allowChildrenWithCustomReaders: true })
  property = this._assertPropertiesMatch(properties, { singleProperty: true })

  this._map.push({ $unwind: '$' + property.fullpath })

  // treat top-level property as non-array for future operation in the pipeline.
  this._treatAsArray.set(property.fullpath, false)

  if (map[keys[0]]) {

    // when the match is for a document array, consider only what is in the mapping object but treat it as a new top-level query that can only match against the mapped field.
    typeName = this._getTypeName(property)
    if (typeName === 'Document' || typeName === 'Set') {
      let match = clone(map[keys[0]])
      if (!utils.isPlainObject(match)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'A mapped document array expression must be an object.', path: property.fullpath })
      }

      // replace each field name with the prefix from the unwound property.
      Object.keys(match).forEach(function(key) {
        if (key[0] !== '$') {
          match[property.fullpath + '.' + key] = match[key]
          delete match[key]
        }
      })
      map = match
    }

    this._map.push({ $match: this._parseMatch(map, { skipLookup: true, skipIndexCheck: true }) })
  }

}

Parser.prototype.getUnwoundPaths = function() {

  var out = []
  this._treatAsArray.forEach(function(out, value, key) {
    if (!value) out.push(key)
  }.bind(null, out))
  return out

}

Parser.normalizeGroup = function(group) {

  if (_.isString(group) && group.match(/^[0-9a-z_]+$/i)) {
    group = { _id: group }
  }

  if (_.isString(group)) {

    try {
      group = JSON.parse(group)
    } catch (e) {
      group = null
      var fault = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid group JSON format', path: '' })
      fault.add(e)
      throw fault
    }
  }

  if (!utils.isPlainObject(group)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for group component', path: '' })
  }

  if (group._id === undefined) {
    group._id = [null]
  }

  return group

}

Parser.prototype._parseGroup = function(group) {

  if (!group) {
    return
  }

  group = Parser.normalizeGroup(group)

  var keys = Object.keys(group)

  if (keys.length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group component requires at least one expression', path: '' })
  }

  if (!this.relaxLimits && keys.length > Parser.MAX_GROUP_ACCUMULATORS) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum group elements (' + Parser.MAX_GROUP_ACCUMULATORS + ') exceeded', path: '' })
  }

  // parse aggregation identifier. exclude unique and _id fields from aggregation because they don't collapse. also, grouping
  // can only occur on readable fields.

  let top = {},
      key

  for (let i = 0; i < keys.length; i++) {

    key = keys[i]

    if (!Parser.FIELD_NAME_REGEX.test(key)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Top-level grouping must fields must match ' + Parser.FIELD_NAME_REGEX, path: key })
    }

    if (key === '_id') {
      this._parseGroupId(group[key], top, new Chain(), {})
    } else {
      this._parseGroupAccumulator(key, group[key], group, new Chain(), top, {})
    }
  }

  // don't allow _id null without any other fields, which would produce nothing.
  if (top._id == null && Object.keys(top).length === 1) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group component requires at least one expression when grouping by null.', path: '' })
  }

  this._group.push({ $group: top })

  // remove the _id through projection if the id is null.
  if (top._id == null) {
    let projection = Object.keys(top).reduce(function(projection, key) {
      projection[key] = (key !== '_id')
      return projection
    }, {})
    this._group.push({ $project: projection })
  }

  // logger.silly(JSON.stringify(this._group, null, 4));

}

Parser.normalizeSort = function(sort) {

  if (_.isString(sort) && sort.match(/^[0-9a-z_]+$/i)) {
    sort = utils.path({}, sort, 1, true)
  }

  if (_.isString(sort)) {

    try {
      sort = JSON.parse(sort)
    } catch (e) {
      sort = null
      var fault = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid sort JSON format', path: '' })
      fault.add(e)
      throw fault
    }
  }

  if (!utils.isPlainObject(sort)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for sort component', path: '' })
  }

  return sort
}

/**
 * @param sort
 * @returns {{}}
 */
Parser.prototype._parseSort = function(sort) {

  sort = Parser.normalizeSort(sort)

  let top = {},
      keys = Object.keys(sort),
      chain = new Chain(),
      groupFields = this._group.length ? Object.keys(utils.path(this._group, '0.$group') || {}) : null,
      mappedField = this._map.length ? utils.path(this._map, '0.$unwind') : null

  if (keys.length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Sort component requires at least one field', path: '' })
  }

  if (!this.relaxLimits && keys.length > Parser.MAX_EXPRESSION_KEYS) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum sort elements (' + Parser.MAX_EXPRESSION_KEYS + ') exceeded', path: '' })
  }

  // can't sort on null group._id
  if (utils.path(this._group, '0.$group._id') === null) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cannot sort on implicit single output document (group by null).', path: '' })
  }

  keys.forEach(function(path) {

    let value = sort[path],
        isVariable = this._checkVariable(value, 'Number')

    if (!isVariable && value !== 1 && value !== -1) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Sort value must be 1 for ascending, or -1 for descending order', path: path })
    }

    if (groupFields) {

      // add _id fields to the path.
      let groupIdObj = utils.path(this._group, '0.$group._id')
      if (utils.isPlainObject(groupIdObj)) {
        Object.keys(groupIdObj).forEach(function(field) {
          if (field && field[0] !== '$') {
            groupFields.push('_id.' + field)
          }
        })
      }

      // allow sorting by anything in the group.
      if (~groupFields.indexOf(path)) {
        if (!isVariable) {
          top[path] = value
        }
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cannot sort by missing field (' + path + ').', path: path })
      }

    } else {

      let properties = this._processProperty(path, chain, { skipIndexCheck: true }),
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

      // if sorting by an unwound field, use the original and not the index. also, an unwound property need not be indexed.
      if (mappedField === ('$' + property.fullpath)) {

        if (!isVariable) {
          top[property.fullpath] = value
        }

      } else {

        // since there is no real chain, ensure property is indexed (_processProperty allows non-indexed documents)
        if (!(property.indexed || property.nativeIndex || this.skipIndexChecks)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property is not indexed (' + path + ').', path: path })
        }

        if (property.sortModifier) {

          if (!isVariable) {
            property.sortModifier(this.principal, path, value, top)
          }

        } else if (property.nativeIndex) {

          if (!isVariable) {
            top[property.fullpath] = value
          }

        } else {

          if (!property._id) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property cannot be used for sort (' + path + ').', path: path })
          }

          let slots = this.getKeyedSlots(),
              slotName = slots[property._id],
              idxKey = 'idx.d.' + slotName + (property.unique ? '.v' : '')

          if (!slotName) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property cannot be used for sort (' + path + ').', path: path })
          }

          if (!isVariable) {
            top[idxKey] = value
          }
        }
      }
    }

  }.bind(this))

  return top

}

Parser.normalizeMatch = function(where) {

  if (_.isString(where)) {
    try {
      where = JSON.parse(where)
    } catch (e) {
      var fault = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid where JSON format', path: '' })
      fault.add(e)
      throw fault
    }
  }
  if (!utils.isPlainObject(where)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for where expression', path: '' })
  }

  return where

}

/**
 * Main entry point for validating and transforming user inputted where condition(s) into mongodb digestible find.
 *
 * @param where
 * @param options
 */
Parser.prototype._parseMatch = function(where, options) {

  where = Parser.normalizeMatch(where)

  var top = {}
  this._parseMatchExpression(where, new Chain(), top, top, top, options)

  return top
}

/**
 *
 * @param object
 * @param chain
 * @param into
 * @private
 *
 * @return String|Array the type of the expression.
 */
Parser.prototype._parseGroupExpression = function(object, chain, into) {

  if (!this.relaxLimits && chain.length > Parser.MAX_GROUP_DEPTH) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum group expression depth (' + Parser.MAX_GROUP_DEPTH + ') exceeded', path: chain.toString() })
  }

  if (!utils.isPlainObject(object)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for group expression', path: chain.toString() })
  }

  let property,
      properties,
      returnType,
      resultTypes,
      date,
      fullpath,
      keys = Object.keys(object),
      expectedTypes,
      operator = keys[0],
      expression = object[operator]

  if (keys.length !== 1) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group expression requires a single supported operator property', path: chain.toString() })
  }

  switch (operator) {

    case '$string':

      if (!this._checkVariable(expression, 'String')) {
        if (!_.isString(expression)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$string expects a string value.', path: chain.toString() })
        }
        into.$literal = expression
      }

      return 'String'

    case '$number':

      if (!this._checkVariable(expression, 'Number')) {
        if (!utils.isNumeric(expression)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$number expects a number value.', path: chain.toString() })
        }
        into.$literal = parseFloat(expression)
      }

      return 'Number'

    case '$integer':

      if (!this._checkVariable(expression, 'Number')) {
        if (!utils.isInteger(expression)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$integer expects an integer value.', path: chain.toString() })
        }
        into.$literal = parseInt(expression)
      }
      return 'Number'

    case '$boolean':

      if (!this._checkVariable(expression, 'Number')) {
        if (!_.isBoolean(expression)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$boolean expects a boolean value.', path: chain.toString() })
        }
        into.$literal = !!expression
      }

      return 'Boolean'

    case '$date':

      if (!this._checkVariable(expression, 'Date')) {
        date = utils.getValidDate(expression)
        if (!date) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$date expects a date value.', path: chain.toString() })
        }
        into.$literal = date
      }

      return 'Date'

    case '$objectId':

      if (!this._checkVariable(expression, 'ObjectId')) {
        let id = utils.getIdOrNull(expression)
        if (!id) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$objectId expects an ObjectId value.', path: chain.toString() })
        }
        into.$literal = id
      }
      return 'ObjectId'

    case '$array':

      if (!this._checkVariable(expression, 'Any[]')) {
        if (!_.isArray(expression)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$array expects an array value.', path: chain.toString() })
        }
        into.$literal = expression
      }
      return ['Any']

    case '$and':
    case '$or':
    case '$not':

      if (operator === '$not') {
        expression = [expression]
      }
      if (!_.isArray(expression)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array.', path: chain.toString() })
      }

      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          properties = this._processProperty(expression, chain, { skipIndexCheck: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          // only built-in properties will have modifiers, and they will not have multiples.
          into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
        } else if (utils.isPlainObject(expression)) {
          into[operator][i] = {}
          this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }

      }.bind(this))

      return 'Boolean'

    case '$setEquals':
    case '$setIntersection':
    case '$setUnion':
    case '$setDifference':
    case '$setIsSubset':
    case '$anyElementTrue':
    case '$allElementsTrue':

      if (~['$anyElementTrue', '$allElementsTrue'].indexOf(operator)) {
        expression = [expression]
      }
      if (!_.isArray(expression)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array.', path: chain.toString() })
      }
      if (operator === '$setEquals' && expression.length < 2) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' must contain at least 2 elements.', path: chain.toString() })
      }
      if (~['$setDifference', '$setIsSubset'].indexOf(operator) && expression.length !== 2) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' must contain exactly 2 elements.', path: chain.toString() })
      }

      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          // don't skip child processing because values could potentially be guessed at here. so make sure full access to everything is allowed.
          properties = this._processProperty(expression, chain, { skipIndexCheck: true, requireArray: true, noArrayParents: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })
          into[operator][i] = { $ifNull: ['$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath), []] }
        } else if (utils.isPlainObject(expression)) {
          into[operator][i] = { $ifNull: [{}, []] }
          returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i].$ifNull[0])
          if (!_.isArray(returnType)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to an array.', path: chain.toString() })
          }
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }

      }.bind(this))

      return ['Any']

    case '$cmp':
    case '$eq':
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':
    case '$ne':

      if (!_.isArray(expression) || expression.length !== 2) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with exactly 2 elements.', path: chain.toString() })
      }

      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          // don't skip child processing because values could potentially be guessed at here. so make sure full access to everything is allowed.
          properties = this._processProperty(expression, chain, { skipIndexCheck: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })
          into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
        } else if (utils.isPlainObject(expression)) {
          into[operator][i] = {}
          this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }

      }.bind(this))

      return operator === '$cmp' ? 'Number' : 'Boolean'

    case '$add':
    case '$multiply':
    case '$subtract':
    case '$divide':
    case '$mod':

      // $add and $multiply can have more than 2 elements.
      let isAddOrMultiply = ~['$add', '$multiply'].indexOf(operator),
          canHaveDate = ~['$add', '$subtract'].indexOf(operator),
          expressionTypes = [],
          dates

      if (!_.isArray(expression) || (isAddOrMultiply ? expression.length < 2 : expression.length !== 2)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with ' + (isAddOrMultiply ? 'at least 2' : '2') + ' elements.', path: chain.toString() })
      }

      if (!_.isArray(expression) || (~['$add', '$multiply'].indexOf(operator) ? expression.length < 2 : expression.length !== 2)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with ' + ('at least 2') + ' elements.', path: chain.toString() })
      }

      into[operator] = []

      expression.forEach(function(expression, i, a) {

        let returnType

        if (utils.isNumeric(expression)) {
          into[operator][i] = utils.isInteger(expression) ? parseInt(expression) : parseFloat(expression)
          returnType = 'Number'
        } else if (_.isString(expression)) {
          let date = utils.getValidDate(expression) // allow the client to pass a date.
          if (date) {
            returnType = 'Date'
            if (!canHaveDate) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires a Number.', path: chain.toString() })
            }
            into[operator][i] = date
          } else {
            properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
            property = this._assertPropertiesMatch(properties, { singleProperty: true })

            if (this._isArray(property)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' field cannot be an array', path: chain.toString() })
            }
            returnType = this._getTypeName(property)

            into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
          }
        } else {
          into[operator][i] = {}
          returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
        }

        if (!(returnType === 'Number' || (canHaveDate && returnType === 'Date'))) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires a ' + (canHaveDate ? 'Number or Date' : 'Number') + '.', path: chain.toString() })
        }
        expressionTypes.push(returnType)

      }.bind(this))

      dates = expressionTypes.filter(function(type) { return type === 'Date' })

      // $add supports up to 1 date in the expression list.
      if (operator === '$add' && dates.length > 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$add only supports a single Date. All other expression values must be numbers.', path: chain.toString() })
      }

      // $subtract can have dates, but if only 1 is a date, it must be the first.
      if (operator === '$subtract') {
        if (expressionTypes[1] === 'Date' && expressionTypes[0] === 'Number') {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$subtract only supports subtracting a Date from a Date, a Number from a Date, or a Number from a Number.', path: chain.toString() })
        }
      }

      if (operator === '$subtract') {
        return dates.length === 1 ? 'Date' : 'Number'
      }
      return dates.length ? 'Date' : 'Number'

    case '$concat':

      if (!_.isArray(expression)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array.', path: chain.toString() })
      }

      // ensure each element resolves to a string. wrap in ifNull to force '' in order to prevent null return values.
      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })
          if (this._isArray(property) || this._getTypeName(property) !== 'String') {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' property must be a string.', path: chain.toString() })
          }
          into[operator][i] = { $ifNull: ['$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath), ''] }
        } else if (utils.isPlainObject(expression)) {

          into[operator][i] = { $ifNull: [{}, ''] }
          returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i].$ifNull[0])
          if (returnType !== 'String') {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a String.', path: chain.toString() })
          }
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }

      }.bind(this))

      return 'String'

    case '$substr':

      if (!_.isArray(expression) || expression.length !== 3) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with 3 elements.', path: chain.toString() })
      }

      expectedTypes = ['String', 'Number', 'Number']

      into[operator] = []

      expression.forEach(function(expression, i) {

        if (_.isString(expression)) {

          properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          if (this._isArray(property) || this._getTypeName(property) !== expectedTypes[i]) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' property must be a ' + expectedTypes[i] + '.', path: chain.toString() })
          }
          into[operator][i] = { $ifNull: ['$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath), expectedTypes[i] === 'String' ? '' : 0] }

        } else if (utils.isPlainObject(expression)) {

          into[operator][i] = { $ifNull: [{}, expectedTypes[i] === 'String' ? '' : 0] }
          returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i].$ifNull[0])
          if (returnType !== expectedTypes[i]) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result at index ' + i + ' must resolve to a ' + expectedTypes[i] + '.', path: chain.toString() })
          }

        } else if (utils.isInteger(expression) && expectedTypes[i] === 'Number') {

          into[operator][i] = parseInt(expression)

        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name, object expression, or a Number (for start and length).', path: chain.toString() })
        }

      }.bind(this))

      return 'String'

    case '$toLower':
    case '$toUpper':

      if (_.isString(expression)) {

        properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })

        if (this._isArray(property) || this._getTypeName(property) !== 'String') {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a string.', path: property.fullpath })
        }
        into[operator] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)

      } else if (utils.isPlainObject(expression)) {

        into[operator] = {}
        returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator])
        if (returnType !== 'String') {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a string.', path: chain.toString() })
        }
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
      }

      return 'String'

    case '$strcasecmp':

      if (!_.isArray(expression) || expression.length !== 2) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with 2 elements.', path: chain.toString() })
      }

      into[operator] = []

      expression.forEach(function(expression, i) {

        if (_.isString(expression)) {

          properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          if (this._isArray(property) || this._getTypeName(property) !== 'String') {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' property must be a String.', path: chain.toString() })
          }
          into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)

        } else if (utils.isPlainObject(expression)) {

          into[operator][i] = {}
          returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
          if (returnType !== 'String') {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a String.', path: chain.toString() })
          }

        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name, object expression, or a Number (for start and length).', path: chain.toString() })
        }

      }.bind(this))

      return 'Number'

    case '$size':

      if (_.isString(expression)) {

        properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true, requireArray: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })

        if (!this._isArray(property)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$size expression result must resolve to an array.', path: property.fullpath })
        }

        into.$size = { $ifNull: ['$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath), []] }

      } else if (utils.isPlainObject(expression)) {

        into.$size = { $ifNull: [{}, []] }
        returnType = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into.$size.$ifNull[0])
        if (!_.isArray(returnType)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$size expression result must resolve to an array.', path: chain.toString() })
        }
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: '$size expects a property name or object', path: chain.toString() })
      }

      return 'Number'

    case '$dayOfYear':
    case '$dayOfMonth':
    case '$dayOfWeek':
    case '$year':
    case '$month':
    case '$week':
    case '$hour':
    case '$minute':
    case '$second':
    case '$millisecond':
      // case '$dateToString':

      if (utils.isValidDate(expression)) {

        into[operator] = expression

      } else if (_.isString(expression)) {

        date = utils.getValidDate(expression) // allow the client to pass a date.
        if (date) {

          into[operator] = date

        } else {

          properties = this._processProperty(expression, chain, { skipChildProcessing: true, skipIndexCheck: true, noArrayParents: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          if (this._isArray(property) || this._getTypeName(property) !== 'Date') {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a Date.', path: property.fullpath })
          }
          fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
          into.$cond = [{ $ifNull: [fullpath, false] }, { [operator]: fullpath }, null]
        }

      } else {

        const resultExpression = { [operator]: {} }
        chain = chain.concat(new ChainOperator(operator))
        returnType = this._parseGroupExpression(expression, chain, resultExpression[operator])

        if (returnType !== 'Date') {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expression result must resolve to a Date.', path: chain.toString() })
        }
        into.$cond = [{ $ifNull: [resultExpression, false] }, resultExpression, null]

      }

      return operator === '$dateToString' ? 'String' : 'Number'

    case '$dateToString':

      throw Fault.create('cortex.notImplemented.unspecified', { reason: operator + ' is not yet implemented.', path: chain.toString() })

    case '$cond':

      if (!_.isArray(expression) || expression.length !== 3) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with exactly 3 elements.', path: chain.toString() })
      }

      resultTypes = []
      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          properties = this._processProperty(expression, chain, { skipIndexCheck: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
          resultTypes[i] = this._isArray(property) ? ['Any'] : this._getTypeName(property)
        } else if (utils.isPlainObject(expression)) {
          into[operator][i] = {}
          resultTypes[i] = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }
      }.bind(this))

      if (!utils.deepEquals(resultTypes[1], resultTypes[2])) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' return types must match.', path: chain.toString() })
      }

      return resultTypes[1]

    case '$ifNull':

      if (!_.isArray(expression) || expression.length !== 2) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' requires an array with exactly 2 elements.', path: chain.toString() })
      }

      resultTypes = []

      into[operator] = []

      expression.forEach(function(expression, i) {
        if (_.isString(expression)) {
          properties = this._processProperty(expression, chain, { skipIndexCheck: true })
          property = this._assertPropertiesMatch(properties, { singleProperty: true })

          into[operator][i] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
          resultTypes[i] = this._isArray(property) ? ['Any'] : this._getTypeName(property)
        } else if (utils.isPlainObject(expression)) {
          into[operator][i] = {}
          resultTypes[i] = this._parseGroupExpression(expression, chain.concat(new ChainOperator(operator)), into[operator][i])
        } else {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' expects a property name or object', path: chain.toString() })
        }

      }.bind(this))

      if (!utils.deepEquals(resultTypes[0], resultTypes[1])) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' return types must match.', path: chain.toString() })
      }

      return resultTypes[0]

    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid or unsupported group expression operator ' + operator, path: chain.toString() })

  }

}

Parser.prototype._assertPropertiesMatch = function(properties, options) {

  if (utils.option(options, 'singleProperty')) {
    if (properties.length !== 1) {
      throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Ambiguously named property cannot be processed across post types and/or segment types.', path: properties[0].fullpath })
    }
  }
  if (properties.length > 1) {
    let isArray = this._isArray(properties[0]),
        typeName = properties[0].getTypeName()
    for (let i = 1; i < properties.length; i++) {
      if (isArray !== this._isArray(properties[i] || typeName !== properties[1].getTypeName())) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Similarly named properties in disparate post types or segments must be of the same type.', path: properties[0].fullpath })
      }
    }
  }

  return properties[0]
}

/**
 * Parses where conditions.
 *
 * @param where
 * @param chain
 * @param root to top level query
 * @param top the top level into which property expressions are to be added.
 * @param into the current level where properties are to be written.
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchExpression = function(where, chain, root, top, into, options) {

  if (!this.relaxLimits && chain.length > Parser.MAX_WHERE_DEPTH) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum query depth (' + Parser.MAX_WHERE_DEPTH + ') exceeded', path: chain.toString() })
  }

  if (!utils.isPlainObject(where)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for where component', path: chain.toString() })
  }

  var key, keys = Object.keys(where)

  if (keys.length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Where component requires at least one field or operator', path: chain.toString() })
  }

  if (!this.relaxLimits && keys.length > Parser.MAX_EXPRESSION_KEYS) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum query elements (' + Parser.MAX_EXPRESSION_KEYS + ') exceeded', path: chain.toString() })
  }

  for (let i = 0; i < keys.length; i++) {

    key = keys[i]

    if (key[0] !== '$') {
      this._parseMatchField(key, where[key], where, chain, root, top, into, options)
    } else {
      this._parseMatchOperator(key, where[key], where, chain, root, top, into, options)
    }

  }

}

/**
 *
 * @param field
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchField = function(field, value, container, chain, root, top, into, options) {

  // don't allow properties in properties. this implies an exact match.
  if (chain.getAt(chain.length - 1) instanceof ChainProperty) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Embedded property matching is unsupported. Use dot syntax.', path: chain.toString() })
  }

  // normalize the path and make sure nothing funky was passed.
  const numFieldNames = field.split('.').length

  if (field !== utils.normalizeObjectPath(field, true, true, true)) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Invalid field name (' + field + ').', path: chain.toString() })
  }

  let typeName,
      properties = this._processProperty(field, chain, options),
      current = this._assertPropertiesMatch(properties, { singleProperty: true }),
      fieldPath = current.fullpath.split('.').slice(-numFieldNames).join('.')

  if (_.isArray(value)) {

    throw Fault.create('cortex.unsupportedOperation.exactMatching', { path: chain.toString() })

  } else if (utils.isPlainObject(value)) {

    // embedded object. retain the current top. only the root and $and/$or create new tops.
    if (current.indexModifier) {
      fieldPath = current.indexModifier(this, this.principal, fieldPath, {}, chain, root, top, into)
    } else {

      into[fieldPath] = {}
    }

    this._parseMatchExpression(value, chain.concat(new ChainProperty(current)), root, top, into[fieldPath], options)

  } else {

    typeName = this._getTypeName(current)

    if (typeName === 'Document' || typeName === 'Set' || typeName === 'Geometry') {
      throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Matching primitive values against this type is unsupported.', path: chain.toString() })
    }

    var casted = value

    if (!this._checkVariable(value, this._getTypeName(current))) {

      casted = current.castForQuery(this.ac, value)

      if (_.isFunction(current.indexModifier)) {
        current.indexModifier(this, this.principal, fieldPath, casted, chain, root, top, into)
      } else {
        into[fieldPath] = casted
      }

      if (!current.nativeIndex) {
        this._addMatchLookup(chain, top, current, casted, options)
      }

    }

    return utils.path({}, current.name, casted, true)

  }

}

Parser.prototype._parseGroupId = function(object, root, chain, options) {

  if (object == null) {
    root._id = null
    return
  } else if (_.isString(object)) {
    object = { [object]: object }
  } else if (!utils.isPlainObject(object)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid group _id. Object expected.', path: '' })
  }

  let keys = Object.keys(object),
      numOperators = keys.filter(function(key) { return key[0] === '$' }).length

  if (keys.length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group _id must contain at least one field or expression.', path: '' })
  }
  // there can be only 1 operator expression per object. for example, mixing ($concat and a named myGroup field is not allowed.)
  if (numOperators > 1 || (numOperators > 0 && keys.length > 1)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only one group _id expression is supported, and it must be the only key in the group object', path: '' })
  }

  root._id = {}

  keys.forEach(function(field) {

    let properties, property, value = object[field]

    if (field[0] === '$') {

      this._parseGroupExpression(value, chain, root._id)

    } else {

      if (!Parser.FIELD_PATH_REGEX.test(field)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Top-level grouping must fields must match ' + Parser.FIELD_PATH_REGEX, path: field })
      }

      if (_.isString(value)) {

        properties = this._processProperty(value, chain, { skipIndexCheck: true, noArrayParents: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })

        root._id[field] = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)

      } else if (utils.isPlainObject(value)) {

        root._id[field] = {}
        let keys = Object.keys(value)
        if (keys.length === 0) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group _id expression must contain at least one field or expression.', path: field })
        }
        this._parseGroupExpression(value, chain, root._id[field])

      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid group _id expression. Expected a string or an object', path: field })
      }

    }

  }.bind(this))

  // if there is only one key, then make it the direct value, making _id a value instead of an object of named fields.
  keys = Object.keys(root._id)
  if (keys.length === 1) {
    root._id = root._id[keys[0]]
  }

}

Parser.prototype._parseGroupAccumulator = function(field, object, container, chain, top, options) {

  if (!Parser.FIELD_NAME_REGEX.test(field)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Top-level grouping must fields must match ' + Parser.FIELD_NAME_REGEX, path: field })
  }

  // --------------------------

  if (!utils.isPlainObject(object)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Object expected for group accumulator expression', path: chain.toString() })
  }

  let properties,
      property,
      keys = Object.keys(object),
      operator = keys[0],
      expression = object[operator],
      fullpath,
      isProperty = _.isString(expression)

  if (keys.length !== 1) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group accumulator expression requires a single supported accumulator property', path: chain.toString() })
  }

  if (!isProperty) {
    // get the container ready.
    top[field] = { [operator]: {} }
    chain = chain.concat(new ChainOperator(operator))
  }

  switch (operator) {

    // count performs a count of elements, or a count of the number of elements in an array.
    case '$count':

      if (!isProperty) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Group $count accumulator expects a property.', path: chain.toString() })
      }

      properties = this._processProperty(expression, chain, { skipIndexCheck: true, noArrayParents: true })
      property = this._assertPropertiesMatch(properties, { singleProperty: true })
      fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)

      if (this._isArray(property)) {
        top[field] = { $sum: { $cond: [ { $ifNull: [fullpath, false] }, { $size: fullpath }, 0 ] } }
      } else {
        top[field] = { $sum: { $cond: [ { $ifNull: [fullpath, false] }, 1, 0 ] } }
      }

      break

    case '$sum': case '$avg':

      if (isProperty) {

        properties = this._processProperty(expression, chain, { skipIndexCheck: true, noArrayParents: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })
        fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
        if (this._getTypeName(property) !== 'Number') {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' can only be applied to Number properties.', path: property.fullpath })
        }
        if (this._isArray(property)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: operator + ' cannot be applied to array properties.', path: property.fullpath })
        }

        top[field] = { [operator]: fullpath }

      } else {
        this._parseGroupExpression(expression, chain, top[field][operator])
      }

      break

      // first/last value found. sub arrays are allowed here.
    case '$first': case '$last':

      if (isProperty) {

        properties = this._processProperty(expression, chain, { skipIndexCheck: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })
        fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
        top[field] = { [operator]: fullpath }

      } else {
        this._parseGroupExpression(expression, chain, top[field][operator])
      }

      break

      // min/max value. sub arrays are allowed here.
    case '$min': case '$max':

      if (isProperty) {

        properties = this._processProperty(expression, chain, { skipIndexCheck: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })
        fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)
        top[field] = { [operator]: fullpath }

      } else {
        this._parseGroupExpression(expression, chain, top[field][operator])
      }

      break

    case '$pushAll': case '$push': case '$addToSet':

      if (isProperty) {

        properties = this._processProperty(expression, chain, { skipIndexCheck: true })
        property = this._assertPropertiesMatch(properties, { singleProperty: true })
        fullpath = '$' + (property.groupModifier ? property.groupModifier(this, this.principal) : property.fullpath)

        if (operator === '$pushAll') {
          operator = '$push'
          fullpath = { $ifNull: [fullpath, null] }
        }

        top[field] = { [operator]: fullpath }

      } else {
        this._parseGroupExpression(expression, chain, top[field][operator])
      }

      break

    default:

      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid accumulator.', path: operator })

  }

}

/**
 *
 * @param operator
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchOperator = function(operator, value, container, chain, root, top, into, options) {

  // @here complain if a geo gets another operator.

  switch (operator) {

    case '$gt': case '$gte': case '$lt': case '$lte': case '$in':
      this._parseMatchComparisonOperator(operator, value, container, chain, root, top, into, options)
      break
    case '$and': case '$or':
      this._parseMatchLogicalOperator(operator, value, container, chain, root, top, into, options)
      break
    case '$regex':
      this._parseMatchEvaluationOperator(operator, value, container, chain, root, top, into, options)
      break
    case '$all': case '$size': case '$elemMatch':
      this._parseMatchArrayOperator(operator, value, container, chain, root, top, into, options)
      break
    case '$within': case '$intersects': case '$near': case '$nearSphere':
      this._parseMatchGeometryOperator(operator, value, container, chain, root, top, into, options)
      break
    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator ' + operator, path: chain.toString() })

  }
}

/**
 *
 * @param operator
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchComparisonOperator = function(operator, value, container, chain, root, top, into, options) {

  let property = chain.lastProperty(['$all', '$elemMatch'])
  if (!property) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' must be applied to a property or within an [$all].$elemMatch expression.', path: chain.toString() })
  }

  switch (operator) {

    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':

      if (_.isArray(value) || utils.isPlainObject(value)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' expects a primitive value for property.', path: chain.toString() })
      }

      if (!this._checkVariable(value, this._getTypeName(property))) {
        this._addMatchOperatorExpression(operator, property, property.get().castForQuery(this.ac, value), chain, root, top, into, options)
      }

      break

    case '$in':

      if (!this._checkVariable(value, this._getTypeName(property) + '[]')) {

        if (!_.isArray(value)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $in expects an array of values for property.', path: chain.toString() })
        }

        if (!this.relaxLimits && value.length > Parser.MAX_$IN_ELEMENTS) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $in expects an array with between 0 and ' + Parser.MAX_$IN_ELEMENTS + ' values, inclusive.', path: chain.toString() })
        }

        // $in does not support regular expressions. support $regex here and transform into native RegExp. otherwise, expect a primitive values.
        if (this._getTypeName(property) === 'String' || (_.isFunction(property.get().indexModifier) && property.get().apiType === 'String')) {
          value = value.map(function(value) {
            if (utils.isPlainObject(value) && Object.keys(value).length === 1 && value.$regex !== undefined) {
              return this._validateRegExp(value.$regex, chain)
            }
            return value
          }.bind(this))
        }

        value = value.map(function(value) {

          if (_.isArray(value) || utils.isPlainObject(value)) {
            throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $in expects a primitive value for property.', path: chain.toString() })
          }

          if (this._checkVariable(value, this._getTypeName(property))) {
            return value
          }

          return property.get().castForQuery(this.ac, value)
        }.bind(this))

        this._addMatchOperatorExpression(operator, property, value, chain, root, top, into, options)
      }

      break

    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator ' + operator, path: chain.toString() })
  }

}

/**
 *
 * @param operator
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchLogicalOperator = function(operator, value, container, chain, root, top, into, options) {

  // these can only be nested within other logical operators unless they are on top.
  if (chain.length > 0) {
    const last = chain.getAt(chain.length - 1)
    if (!((last instanceof ChainOperator) && ~['$and', '$or'].indexOf(last.get()))) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' can only be nested within $and/$or.', path: chain.toString() })
    }
  }

  // all logical operators must be arrays that contain at least one element, which must all be plain objects.
  if (!_.isArray(value)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' value must be an array.', path: chain.toString() })
  }

  if (value.length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' must contain at least 1 element.', path: chain.toString() })
  }

  if (!this.relaxLimits && value.length > Parser.MAX_LOGICAL_CONDITIONS) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Maximum ' + operator + ' count (' + Parser.MAX_LOGICAL_CONDITIONS + ') exceeded.', path: chain.toString() })
  }

  value.forEach(function(value) {
    if (!utils.isPlainObject(value)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' elements must be objects.', path: chain.toString() })
    }
  })

  switch (operator) {

    case '$and':
    case '$or':

      into[operator] = []

      value.forEach(function(value) {

        var obj = {}
        into[operator].push(obj)

        this._parseMatchExpression(value, chain.concat(new ChainOperator(operator)), root, obj, obj, options)

      }.bind(this))

      break

    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator ' + operator, path: chain.toString() })
  }

}

/**
 *
 * @param operator
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchEvaluationOperator = function(operator, value, container, chain, root, top, into, options) {

  var property = chain.lastProperty(['$all', '$elemMatch'])
  if (!property) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' must be applied to a property or within an [$all].$elemMatch expression.', path: chain.toString() })
  }

  switch (operator) {

    case '$regex':

      if (this._getTypeName(property) !== 'String') {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $regex expects a String property.', path: chain.toString() })
      }

      if (!this._checkVariable(value, 'String')) {
        this._addMatchOperatorExpression(operator, property, this._validateRegExp(value, chain), chain, root, top, into, options)
      }

      break

    default:

      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator (' + operator + ')', path: chain.toString() })
  }

}

Parser.prototype._getTypeName = function(property) {

  if (property instanceof ChainProperty) {
    property = property.get()
  }
  return property.getTypeName()
}

Parser.prototype._isArray = function(property) {

  if (property instanceof ChainProperty) {
    property = property.get()
  }
  if (property) {
    if (this._treatAsArray.has(property.fullpath)) {
      return utils.rBool(this._treatAsArray.get(property.fullpath), false)
    }
    return property.array
  }
  return false

}

Parser.prototype._parseMatchGeometryOperator = function(operator, value, container, chain, root, top, into, options) {

  let property = chain.getAt(chain.length - 1)

  if (!(property instanceof ChainProperty)) {
    throw Fault.create('cortex.invalidArgument.unspecified', {
      reason: 'Operator ' + operator + ' must be directly applied to a property.',
      path: chain.toString()
    })
  }

  property = property.get()

  if (this._getTypeName(property) !== 'Geometry') {
    throw Fault.create('cortex.invalidArgument.unspecified', {
      reason: 'Operator ' + operator + ' can only be used to match geometry properties.',
      path: chain.toString()
    })
  }

  if (!utils.isPlainObject(value)) {
    throw Fault.create('cortex.invalidArgument.unspecified', {
      reason: 'Operator ' + operator + ' expects an object',
      path: chain.toString()
    })
  }

  var geoQuery

  switch (operator) {

    case '$within':

      if (!modules.validation.isLngLat(value.$center)) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: 'Operator ' + operator + '.$center must be an array of 2 elements with valid lng and lat values',
          path: chain.toString()
        })
      }

      if (!utils.isNumeric(value.$radius) || value.$radius < 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', {
          reason: 'Operator ' + operator + '.$radius must be a value in kilometers >= 0',
          path: chain.toString()
        })
      }

      geoQuery = {
        $centerSphere: [value.$center, value.$radius / 6378.1]
      }

      operator = '$geoWithin'

      break

    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator (' + operator + ')', path: chain.toString() })

  }

  into[operator] = geoQuery

  this._addMatchLookup(chain, top, property, utils.path({}, operator, geoQuery, true), options)

}

/**
 *
 * @param operator
 * @param value
 * @param container
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._parseMatchArrayOperator = function(operator, value, container, chain, root, top, into, options) {

  var property = chain.lastProperty()

  if (!property) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' must be applied to a property.', path: chain.toString() })
  }

  if (!this._isArray(property.get())) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' can only be used to match inside of array properties.', path: chain.toString() })
  }

  switch (operator) {

    case '$size':

      // $size can only be contained within a property.
      if (!(chain.getAt(chain.length - 1) instanceof ChainProperty)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $size must be directly applied to a property.', path: chain.toString() })
      }

      if (property.get().unique) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $size is not available for unique properties.', path: chain.toString() })
      }

      if (!this._checkVariable(value, this._getTypeName(property))) {

        if (!utils.isInt(value) || value < 0) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $size expects an integer value >= 0.', path: chain.toString() })
        }

        // cannot add size to index. instead, just ensure the property exists, and allow the rest of the query to narrow.
        this._addMatchOperatorExpression(operator, property, value, chain, root, top, into, options)

      }

      break

    case '$all':

      // $all can only be contained within a property.
      if (!(chain.getAt(chain.length - 1) instanceof ChainProperty)) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $all must be directly applied to a property.', path: chain.toString() })
      }

      if (!this._checkVariable(value, this._getTypeName(property) + '[]')) {

        if (!_.isArray(value)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $all expects an array of values for property.', path: chain.toString() })
        }

        if (!this.relaxLimits && value.length > Parser.MAX_$ALL_ELEMENTS) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $all expects an array with between 0 and ' + Parser.MAX_$IN_ELEMENTS + ' values, inclusive', path: chain.toString() })
        }

        // if $all is called for a document array, expect an object. otherwise, expect primitive values, as expressions are not permitted in $all.
        // also, $all can only contain $elemMatch

        let typeName = this._getTypeName(property)
        if (typeName === 'Document' || typeName === 'Set') {

          into[operator] = []

          value.forEach(function(value) {

            if (!utils.isPlainObject(value) || Object.keys(value).length !== 1 || !utils.isPlainObject(value.$elemMatch)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $all for Document expects $elemMatch values for property.', path: chain.toString() })
            }

            var obj = {}
            into[operator].push(obj)

            this._parseMatchExpression(value, chain.concat(new ChainOperator(operator)), root, top, obj, options)

          }.bind(this))

        } else {

          value = value.map(function(value) {
            if (_.isArray(value) || utils.isPlainObject(value)) {
              throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator $all expects a primitive value for property.', path: chain.toString() })
            }
            if (this._checkVariable(value, this._getTypeName(property))) {
              return value
            }
            return property.get().castForQuery(this.ac, value)
          }.bind(this))

          this._addMatchOperatorExpression(operator, property, value, chain, root, top, into, options)

        }

      }

      break

    case '$elemMatch':

      // $elemMatch can only be applied within a property or an $all
      if (!((chain.getAt(chain.length - 1) instanceof ChainProperty) || ((chain.getAt(chain.length - 2) instanceof ChainProperty) && (chain.getAt(chain.length - 1).get() === '$all')))) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operator ' + operator + ' must be applied to a property or an $all.', path: chain.toString() })
      }

      // don't allow combining elemMatch with other operators.
      if (Object.keys(container).length > 1) {
        throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: '$elemMatch cannot be combined with any other operators (' + _.without(Object.keys(container), '$elemMatch') + ')', path: chain.toString() })
      }

      into[operator] = {}

      this._parseMatchExpression(value, chain.concat(new ChainOperator(operator)), root, top, into[operator], options)

      break

    default:
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid query operator (' + operator + ')', path: chain.toString() })

  }

}

/**
 *
 * Validates a property for readability by the calling principal to determine if it's gtg for searching/sorting.
 *
 * note: parent properties have already been looked up for readability.
 *
 * @param path the path of the property to be searched. the path can contain multiple components but must be a child of the parent document.
 * @param chain
 * @param options
 *  skipIndexCheck
 *  requireArray
 *  noArrayParents
 *  skipChildProcessing
 *  allowChildrenWithCustomReaders for cases where allowing children won't break anything, as in the case of a straight mapping of a complex document.
 * @private
 */
Parser.prototype._processProperty = function(path, chain, options) {

  options = options || {}

  var properties = [], parent = chain.lastProperty()

  // normalize the path and make sure nothing funky was passed.
  if (path !== utils.normalizeObjectPath(path, true, true, true)) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Invalid field name: (' + path + ')', path: chain.toString() })
  }

  (parent ? parent.get() : this.object.schema.node).findNodes(path, properties, { mergeIdenticalProperties: true })

  // this may be a custom node from other models.
  if (!properties.length) {

    this.definitions.forEach(function(obj, definition) {
      definition.findNodes(path, properties, { mergeIdenticalProperties: true })
    })

  }
  if (!properties.length) {
    throw Fault.create('cortex.notFound.property', { path: chain.toString() })
  }

  // special allowance for body.name. find the first occurence in any post type.
  if (path === 'body.name') {
    properties = [properties[0]]
  }

  // check each property.
  properties.forEach(function(property) {

    // always skip child processing on references.
    let skipChildProcessing = utils.option(options, 'skipChildProcessing') || property.getTypeName() === 'Reference',
        p,
        typeName

    p = skipChildProcessing ? property : property.parent
    while (p) {
      this._checkPropertyAccess(path, chain, p, { allowCustomReaders: p === property ? !!options.allowCustomReaders : !!options.allowParentsWithCustomReaders })
      p = p.parent
    }
    if (!skipChildProcessing) {
      let allowCustomReaders = !!options.allowCustomReaders, allowChildrenWithCustomReaders = !!options.allowChildrenWithCustomReaders
      property.walk(p => {
        var options = { allowCustomReaders: p === property ? allowCustomReaders : allowChildrenWithCustomReaders }
        this._checkPropertyAccess(path, chain, p, options)
      })

    }

    // allow non-indexed documents. the parser will guarantee sub-properties can be matched.
    if (!utils.option(options, 'skipIndexCheck')) {
      typeName = this._getTypeName(property)
      if (!(property.indexed || property.nativeIndex || this.skipIndexChecks) && typeName !== 'Document' && typeName !== 'Set') {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property is not indexed.', path: path })
      }
    }

    if (utils.option(options, 'requireArray') && !this._isArray(property)) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property must be an array (' + path + ').', path: chain.toString() })
    }

    if (utils.option(options, 'noArrayParents')) {
      // ensure the property has no array parents.
      p = property.pathParent
      while (p) {
        if (this._isArray(p)) {
          throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Operation not available for properties with array parents.', path: path })
        }
        p = p.pathParent
      }
    }

  }.bind(this))

  return properties

}

Parser.prototype._checkPropertyAccess = function(path, chain, p, options) {

  // ensure the property is readable.
  if (!p.readable) {
    throw Fault.create('cortex.notFound.property', { path: chain.toString() })
  }

  // there can be no custom readers or group readers at any level, and the property cannot be virtual.
  if (!options.allowCustomReaders && !p.allowIndex && (p.reader || p.groupReader || p.virtual) && !p.nativeIndex && !this.skipIndexChecks) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property is not available for operation.', path: p.fullpath })
  }

  // non-targeted acl entries (self, owner, creator) cannot be immediately resolved. as such, disallow searching.
  if (p.acl.filter(function(entry) { return !entry.target }).length) {
    throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Operation is not available for properties with custom non-targeted acl entries.', path: p.fullpath })
  }
  if (p.acl.length === 0) {
    // bump up the top level access required. this is to prevent a result set that, even though it does not contain the field,
    // has allowed the caller to know the value in the document that matches the query. to plug the hole, ensure the entire query
    // now runs using an increased level of access.
    this.accessLevel = Math.max(this.accessLevel, p.readAccess)
  } else {
    // resolve direct access to the property. the top level access query still guards against reading the property
    // if no access is granted to the context. here, however, we have an augmented acl. if there is enough access to read the property,
    // silently allow it. if not, throw an access denied error.

    // find the right model object.
    var ac = this.definitions.has(p.root) ? this.definitions.get(p.root).ac : this.ac

    if (!p.hasReadAccess(ac)) {
      throw Fault.create('cortex.accessDenied.unspecified', { reason: 'Cannot perform operation on non-accessible property.', path: p.fullpath })
    }
  }

  // dissallow any properties that have System-only access.
  if (!this._allowSystemAccess && p.readAccess === acl.AccessLevels.System) {
    throw Fault.create('cortex.notFound.property', { path: p.fullpath })
  }

}

Parser.prototype.getVariables = function(context) {
  var variables = this._variables[context] || {}
  return Object.keys(variables).map(function(key) {
    return {
      name: key,
      type: variables[key]
    }
  })
}

Parser.prototype._checkVariable = function(value, type) {

  let match,
      variable,
      existing

  if (this._context && this._withVariables && _.isString(value)) {
    match = value.match(Parser.VARIABLE_REGEX)
    if (match) {
      variable = match[1]
      existing = this._variables[this._context][variable]
      if (!existing) {
        this._variables[this._context][variable] = type
      } else if (existing !== type) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Variable "' + variable + '" exists in multiple locations with different expected primitive types.', path: variable })
      }
      return true
    }
  }
  return false

}

Parser.prototype._validateRegExp = function(pattern, chain) {

  var match, regexp

  if (!_.isString(pattern) || pattern.length === 0 || (!this.relaxLimits && pattern.length > Parser.MAX_REGEXP_LENGTH)) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Pattern (' + pattern + ') for $regex must be a string between 1 and ' + Parser.MAX_REGEXP_LENGTH + ' characters.', path: chain.toString() })
  }

  if (!(match = pattern.match(/^\/(.*)\/(.*)/)) || match[0].length === 0) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid operator $regex pattern: ' + pattern, path: chain.toString() })
  }
  try {
    regexp = new RegExp(match[1], match[2])
    ''.match(regexp)
  } catch (e) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid operator $regex pattern: ' + pattern, path: chain.toString() })
  }

  return regexp

}

/**
 *
 * @param chain
 * @param object
 * @param property
 * @param expression
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._addMatchLookup = function(chain, object, property, expression, options) {

  if (utils.option(options, 'skipLookup')) {
    return
  }

  if (!property.indexed && !property.nativeIndex && !this.skipIndexChecks) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property is not indexed (' + property.fullpath + ').', path: chain.toString() })
  }

  // natively indexed properties can just use the query values. no need to add the constraint.
  if (property.nativeIndex) {
    return
  }

  if (!property._id) {
    if (this.skipIndexChecks) {
      return
    }
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property cannot be used for search (' + property.fullpath + ').', path: chain.toString() })
  }

  if (!object.$and) object.$and = []

  let slots = this.getKeyedSlots(),
      slotName = slots[property._id],
      idxKey = 'idx.d.' + slotName,
      and = object.$and,
      len = and.length,
      qval = {}

  if (!slotName) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Property cannot be used for search (' + property.fullpath + ').', path: chain.toString() })
  }

  if (property.unique || this._getTypeName(property) === 'Geometry') {
    idxKey += '.v'
  }

  qval[idxKey] = expression

  while (len--) {
    if (utils.deepEquals(qval, and[len])) {
      return
    }
  }

  and.push(qval)

}

/**
 *
 * @param operator
 * @param property
 * @param value
 * @param chain
 * @param root
 * @param top
 * @param into
 * @param options
 *  skipIndexCheck
 *  skipLookup
 * @private
 */
Parser.prototype._addMatchOperatorExpression = function(operator, property, value, chain, root, top, into, options) {

  into[operator] = value

  var expression

  // cannot add size to index. instead, just ensure the property exists, and allow the rest of the query to narrow.
  if (operator === '$size') {
    expression = { $exists: true }
  } else {
    expression = utils.path({}, operator, value, true)
  }

  if (!property.get().nativeIndex) {
    this._addMatchLookup(chain, top, property.get(), expression, options)
  }

}

Parser.prototype.getKeyedSlots = function() {

  if (!this.__keyedSlots) {
    this.__keyedSlots = this.object.schema.node.slots.reduce(function(keyed, slot) {
      keyed[slot._id] = slot.name
      return keyed
    }, {})
  }
  return this.__keyedSlots
}

// ---------------------------------------------------

function Chain() {
  this._chain = []
}

Object.defineProperties(Chain.prototype, {
  length: {
    get: function() {
      return this._chain.length
    }
  }
})

Chain.prototype.lastProperty = function(restrictUpstreamOperatorsTo) {

  restrictUpstreamOperatorsTo = restrictUpstreamOperatorsTo ? utils.array(restrictUpstreamOperatorsTo, true) : []

  var len = this._chain.length
  while (len--) {
    if (this._chain[len] instanceof ChainProperty) {
      return this._chain[len]
    } else if (restrictUpstreamOperatorsTo.length && this._chain[len] instanceof ChainOperator && !~restrictUpstreamOperatorsTo.indexOf(this._chain[len].get())) {
      break
    }
  }
  return null
}

Chain.prototype.lastOperator = function() {

  var len = this._chain.length
  while (len--) {
    if (this._chain[len] instanceof ChainOperator) {
      return this._chain[len]
    }
  }
  return null
}

Chain.prototype.toString = function() {

  return this._chain.map(function(value) {
    return (value instanceof ChainProperty) ? value.get().docpath : value.get()
  }).join('.')

}

Chain.prototype.getAt = function(index) {
  return this._chain[index]
}

/**
 * returns a new chain with the item added. the object in the chain array remains references of the original.
 *
 * @returns {string}
 */
Chain.prototype.concat = function(value) {
  var chain = new Chain()
  chain._chain = this._chain.concat(value)
  return chain
}

Chain.prototype.pushProperty = function(value) {
  if (!(value instanceof ChainProperty)) {
    value = new ChainProperty(value)
  }
  this._chain.push(value)
  return this
}

// ---------------------------------------------------

function ChainValue(value) {
  this._value = value

}
ChainValue.prototype.get = function() {
  return this._value
}

// ---------------------------------------------------

function ChainProperty(property) {
  ChainValue.call(this, property)

}
util.inherits(ChainProperty, ChainValue)

// ---------------------------------------------------

function ChainOperator(operator) {
  ChainValue.call(this, operator)
}
util.inherits(ChainOperator, ChainValue)

// ---------------------------------------------------

module.exports = Parser
