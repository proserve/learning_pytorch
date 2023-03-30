'use strict'

const _ = require('underscore'),
      utils = require('../../utils'),
      { promised } = utils,
      Fault = require('cortex-service/lib/fault'),
      consts = require('../../consts'),
      clone = require('clone'),
      acl = require('../../acl'),
      logger = require('cortex-service/lib/logger'),
      async = require('async'),
      config = require('cortex-service/lib/config'),
      LinkedList = require('cortex-service/lib/linked-list'),
      Engines = {
        stable: require('./stages.stable'),
        latest: require('./stages.latest')
      },
      stringifySafe = require('json-stringify-safe'),
      modules = require('../../modules'),
      ParserConsts = require('./parser-consts'),
      Hooks = require('../../classes/hooks')

/*

@BUG parser property resolution is not quite working. a subsequent stage.

 @todo re-implement limits such as maxTimeMS but configurable based on operation type (long mapreduce/export vs api request).

 @todo implement $graphLookup, $bucket for mongodb 3.4

 @todo we may be able to support exact matches in where expressions for arrays and objects. "inExactMatch"? do indexes support such a thing?
 @todo support multikey indexes naturally using hashes?

 @todo. move typed object matching into the parser. (raw match for candidate types: find.type = {$in: masterNode.typeIds.concat(null)};)

 @todo calculate a query "signature" that is somewhat common (remove certain values from stages)? the signature can be used for stats to determine
 if queries are okay to use.

 */

/* @todo for new version

    - apply readers to nodes at runtime for grouped elements? is that even possible?
    - when working with a property, ensure it is added to the "selections" list for projections.
      this is done with "select", but these should be included
   - index sharing types and sets should be able to share indexes due to match branching.

 */

/* @todo later on.

    - cross-object. each query needs branching due to different access queries.

 */

/**
 *
 *
 * limitations:
 *  - all objects must share the same collection
 */
class Parser {

  /**
     * @param principal
     * @param model object model context.
     * @param options
     *  req (object=null) a request
     *  script (object=null) a script
     *  grant (number=0) a grant option
     *  roles (array=[]) granted roles.
     *  total (boolean=false) add total. works by removing the *last* skip and limit stages, if any.
     *  relaxLimits (boolean=false) if true, does not check or enforce parser maximums. use for internal aggregation functionality.
     *  allowNoLimit (boolean=false)
     *  defaultLimit (number=null) defaults to sandbox.defaultListLimit/contexts.defaultLimit
     *  maxLimit (number=null) defaults to contexts.maxLimit
     *  skipIndexChecks (boolean=false) if true, all index checks are skipped.
     *  strict default false. in strict mode, property queries must exist in every candidate node or the query fails.
     *  withVariables (boolean=false) variable mode. allows template variables like "{{foo}}" in place of literals, and compiles the list of variables that can be retrieved using getVariables
     *  allowSystemAccessToParserProperties (boolean=false) when true, the parser will not complain about properties requiring System access.
     */
  constructor(principal, model, options) {

    options = options || {}

    this._ac = new acl.AccessContext(principal, null, { req: options.req, script: options.script, grant: options.grant, roles: options.roles, locale: options.locale })

    this.engineName = config('runtime.forceParserEngine')
    if (!Engines[this.engineName]) {
      this.engineName = String(options.parserEngine)
    }
    if (!Engines[this.engineName]) {
      this.engineName = principal.org.configuration.defaultParserEngine
    }
    if (!Engines[this.engineName]) {
      this.engineName = 'stable'
    }
    this.engine = Engines[this.engineName]

    // all models. this can be objects, post types, or a single object with multiple object types. typed object are busted out into models.
    this._models = []
    let collection
    const addModel = model => {
      if (!~this._models.indexOf(model)) {
        if (!collection) {
          collection = model.collection
        } else if (collection !== model.collection) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'all parser candidate models must share the same collection.' })
        }
        this._models.push(model)
      }
    }

    if (model) {
      const node = model.schema.node
      if (node.typeMasterNode) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'typed parser candidate model must be the master.' })
      }
      addModel(model)
      if (node.typed) {
        Object.keys(node.types).forEach(typeId => {
          addModel(node.types[typeId].model)
        })
      }
    }

    if (this._models.length === 0) {
      throw Fault.create('cortex.error.unspecified', { reason: 'No objects models were loaded for the query.' })
    }

    // true to calculate totals, adding to the result ({object: 'array', hasMore: true, data: [...], total: 43992})
    // can dramatically increase memory consumption and query execution time. use internally.
    this._total = !!options.total

    // the initial match stages. these all come before other pipeline stages. add to this specifically with addRawMatch
    // these typically include the internal limiters, like org and object.
    this._match = []

    this._nativePipeline = []

    // the initial projection stage that establishes which properties are available to subsequent stages.
    this._select = null

    // the aggregation pipeline stages.
    this._pipeline = new LinkedList()

    // the hooks object (ie. exec.before)
    this._hooks = new Hooks()

    // when setBatch is called with a field and array of values, execution will occur for each field/value pair.
    this._batch = null

    // strict mode throws on passable query errors.
    this._strict = utils.rBool(options.strict, utils.stringToBoolean(options.strict, true))

    // allow un-indexed queries
    this._unindexed = utils.rBool(options.unindexed, utils.stringToBoolean(options.unindexed, false))

    // relax limits for internal use.
    this._relax = !!options.relaxLimits

    // allow no limit (limit=false) for a pipeline.
    this._nolimit = !!options.allowNoLimit

    // the default limit
    this._defaultLimit = utils.option(options, 'defaultLimit', config(this._ac.script ? 'sandbox.defaultListLimit' : 'contexts.defaultLimit'))

    // the max limit
    this._maxLimit = utils.option(options, 'maxLimit', config('contexts.maxLimit'))

    // parse can only be called once
    this._parsed = false

    // second stage validation completed.
    this._validated = false

    // for legacy startingAfter/endingBefore support.
    this._reverseResult = false

    // for "variable" mode. this mode allows for variables instead of literals {{_id}}
    // note that a variable context can be something legacy like "map" or "where", as well.
    this._withVariables = Boolean(options.withVariables)
    this._variables = {}

    // allow access to properties requiring system access
    this._allowSystemAccess = !!options.allowSystemAccessToParserProperties

    // skip all index checks.
    this._skipIndexChecks = !!options.skipIndexChecks

    // the access level at which this query should be run. some matches may expose
    this._accessLevel = acl.AccessLevels.None

    // watched property paths.
    this._watched_paths = {}

    this._client_query = []
  }

  /**
     * @todo
     * for cross-object, or multi-model (post) queries, access queries may require a different access query for each
     * object. this will add those acl requirements. without calling this, acl for the purpose of list loading is altogether
     * bypassed.
     */
  // addAccessQueries() {
  // }

  // @todo implement.
  get accessLevel() {
    return this._accessLevel
  }

  get ac() {
    return this._ac
  }

  get currentLocale() {
    return this.ac.getLocale(true, false) || this.ac.getLocale()
  }

  get eq() {
    return this._eq
  }

  get orgId() {
    return utils.path(this.ac, 'orgId')
  }

  get reqId() {
    return utils.path(this.ac, 'reqId') || utils.path(this.ac, 'script.ac.reqId')
  }

  bumpAccessLevel(accessLevel) {
    this._accessLevel = Math.max(this.accessLevel, acl.fixAllowLevel(accessLevel, true, this.accessLevel))
  }

  _logSlowQuery(message, timeMs, aborted) {

    // config('query.slowQueryThresholdMs')
    const script = this._ac.script,
          now = new Date(),
          log = new modules.db.models.log({
            req: this.reqId || utils.createId(),
            org: this._ac.orgId,
            beg: now,
            end: now,
            src: consts.logs.sources.api,
            in: 0,
            out: 0,
            pid: this._ac.principalId,
            oid: this._ac.option('originalPrincipal') || this._ac.principalId,
            exp: new Date(Date.now() + (86400 * 1000 * 30)),
            lvl: consts.logs.levels.warn,
            sid: script ? script.configuration._id : undefined,
            stp: script ? script.configuration.type : undefined,
            ops: 0,
            ctt: 0,
            cms: 0
          })

    log.trc = modules.db.models.log._getTrace(utils.path(script, 'lastTrace'))
    log.err = undefined

    log.dat = {
      message: message,
      durationMs: timeMs,
      aborted: aborted || undefined,
      object: this.model.objectName,
      query: this._client_query
    }

    modules.db.models.log.collection.insertOne(log.toObject(), () => {})

  }

  getVariables(variableContext) {

    const variables = this._variables[variableContext] || {}
    return Object.keys(variables).map(function(key) {
      return {
        name: key,
        type: variables[key] // where/map/group/sort OR match/project/unwind/group/sort/skip/limit
      }
    })
  }

  get principal() {
    return this._ac.principal
  }

  get strict() {
    return this._strict
  }

  get unindexed() {
    return this._unindexed
  }

  get relax() {
    return this._relax
  }

  get model() {
    return this._models[0] // top model.
  }

  get models() {
    return this._models
  }

  calculateSkip(skip) {

    skip = utils.rInt(skip, 0)
    if (skip < 0 || (!this.relax && skip > ParserConsts.MAX_SKIP)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'skip query option must be an integer between 0 and ' + ParserConsts.MAX_SKIP + ', inclusive' })
    }
    return skip

  }

  calculateLimit(limit = null, applyLimit = false, allowPastMax = false) {

    // false explicitly asks for no limit, null turns into whatever the defaults are.
    if (applyLimit) {

      if (limit === null || (limit === false && !this._nolimit)) {
        limit = this._defaultLimit
      }
      if (limit !== false) {
        limit = utils.rInt(limit, null)
        if (limit === null || limit < 1) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'limit query option must be positive integer' })
        } else if (!allowPastMax && limit > this._maxLimit) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'limit query option must be an integer between 1 and ' + this._maxLimit + ', inclusive' })
        }

        limit = utils.queryLimit(limit, this._ac.script, this._defaultLimit, allowPastMax ? -1 : this._maxLimit)
        limit++
      }
    }

    return {
      limit: limit,
      addedToLimit: applyLimit && limit !== false
    }

  }

  /**
     * For internal use only (mostly by group readers), batches calls with a field + values array, so we can get discrete limits for grouped reads.
     * this is very taxing because we have to repeat the query as many times as there are values in the array.
     *
     * @param field
     * @param values
     */
  setBatch(field, values) {
    this._batch = !field ? null : { field: field, values: values }
  }

  /**
     * Returns true if there is a batch setup.
     * @returns {boolean}
     */
  isBatch() {
    return !!this._batch
  }

  /**
     * return all candidate properties where array is "false"
     */
  getUnwoundPaths() {
    return (utils.path(this._pipeline.last, 'properties') || []).filter(prop => prop.isArray === false).map(prop => prop.propertyFullpath)
  }

  /**
     * retrieve the correct model for a document based on the input documents.
     *
     * @param doc
     * @param forcedType force a type hint on a doc without a type.
     * @param candidateModels false. if true, uses the original parser input models.
     */
  discernDocumentModel(doc, forcedType, candidateModels) {

    const models = candidateModels || (this._pipeline.length > 0 ? this._pipeline.last.models : this._models),
          objectName = doc.object

    // for object re-typing only.
    if (forcedType) {
      const candidates = models.filter(model => model.objectName === doc.object && model.objectTypeName === forcedType)
      if (candidates.length === 0) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Cannot find an object type to match ' + forcedType })
      } else if (candidates.length > 1) {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Ambiguous typing for object instance ' + doc._id })
      }
      return candidates[0]
    }

    // if the candidate is a generated model, it must be the match.
    if (models.length === 1 && models[0].__ParserModel__) {
      return models[0]
    }

    // attempt to discern the object
    if (!objectName) {
      // some objects don't have the object property (like connection, notification, etc.)
      if (models.length === 1) {
        const objectProperty = models[0].schema.node.properties.object
        if (!objectProperty || objectProperty.virtual) {
          return models[0]
        }
      }
      throw Fault.create('cortex.notFound.sourceObject')
    }

    // discern object type.
    let candidates = models.filter(model => {
      if (model.objectName === objectName) {
        if (model.postType) { // handle posts/comments
          return (model.postType === doc.type)
        }
        if (!doc.type && model.objectTypeName === undefined) { // eg: [null, 'c_foo', 'c_bar']
          return true
        }
        return model.objectTypeName === doc.type
      }
      return false
    })
    if (candidates.length === 0) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'An untyped document loaded. This could mean the object type has recently been deleted, or a query has excluded required type information.' })
    } else if (candidates.length > 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Ambiguous typing for object instance ' + doc._id })
    }
    return candidates[0]

  }

  /**
     * Register for an event by name. Example: parser.hook('exec').before((vars, callback) => {
     *     vars.parser.addRawMatch({state: consts.connectionStates.active});
     *     callback();
     * });
     * @param name
     * @returns a hook instance which can be called with .before(), .after() and .fail().
     *
     */
  hook(name) {
    return this._hooks.register(name)
  }

  /**
     * returns the collection object used by the query.
     */
  get collection() {
    return this.model.collection
  }

  get baseFind() {
    return this._base_find
  }

  watchProperties(fullpath, fn) {
    utils.array(fullpath, !!fullpath).forEach(fullpath => {
      (this._watched_paths[fullpath] || (this._watched_paths[fullpath] = [])).push(fn)
    })
  }

  // called when a node has been authorized because it's being used somewhere
  _nodeAuthorized(node, component) {
    const watching = this._watched_paths[node.fullpath]
    if (watching) {
      watching.forEach(fn => fn(this, node, component))
    }
  }

  /**
     * adds an initial match before other pipeline stages.
     *
     * @param match
     */
  addRawMatch(match) {

    const stage = this._createStage('$match', match, { raw: true })
    if (!stage.isEmpty) {
      this._match.push(stage)
      this._validated = false
    }
  }

  addNativeStage(stage) {

    if (!utils.isPlainObject(stage)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Object expected for pipeline stage', path: '' })
    }
    const stageKeys = Object.keys(stage),
          stageKey = stageKeys[0],
          supported = ['$lookup', '$graphLookup', '$addFields', '$bucket', '$bucketAuto', '$count', '$facet', '$geoNear', '$redact', '$replaceRoot', '$sample', '$sortByCount']

    if (stageKeys.length !== 1) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'pipeline stages require a single key', path: '' })
    }

    if (!this.engine.exists(stageKey) && !supported.includes(stageKey)) {
      throw Fault.create('cortex.invalidArgument.query', '"' + stageKey + '" is not a valid pipeline stage.')
    }

    this._nativePipeline.push(stage)
    this._validated = false

  }

  get projectedPaths() {

    // get the last stage that projected anything (group, addFields or project stage)
    let stage = this._pipeline.last,
        projected = ['$addFields', '$project', '$group']

    while (!stage.isFirst && !projected.includes(stage.type)) {
      stage = stage.prev
    }
    if (projected.includes(stage.type)) {
      const projection = utils.flattenProjection(stage.build()[stage.type])
      if (projection._id === null) {
        delete projection._id
      }
    }
    return this._select

  }

  /**
     *
     * @param options
     * @param select
     * @param baseFind adds itself to all indexed and native indexed predicates
     */
  parse(options, select, baseFind) {

    options = options || {}

    if (this._parsed) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Query parser called multiple times.' })
    }
    this._parsed = true

    this._base_find = baseFind || {}

    this._select = utils.isPlainObjectWithSubstance(select) ? select : null
    if (!this._select && !this._withVariables) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Query parser requires input selections.' })
    }

    if (options.pipeline || options.nativePipeline) {
      this._parse(options)
    } else {
      this._parseLegacy(options)
    }

    // @todo testing to determine if this is actually helping.
    // if there are no selection transformations, limit to initially selected paths, adding anything sorted or unwound.
    // for good measure, ensure these additions have all their dependencies loaded.
    const numProjections = this._pipeline.filter(stage => ~['$group', '$project', '$addFields'].indexOf(stage.type)).length
    if (numProjections === 0) {

      // start collecting paths after we hit the last index-able field. we don't need to project initial matches.
      const additionaPaths = {}
      let startingStage = this._pipeline.first,
          stage = startingStage,
          addedPaths = false,
          collecting = false

      while (stage) {
        if (!~['$match', '$sort'].indexOf(stage.type)) {
          collecting = true
        }
        if (collecting) {
          if (stage.type === '$match' || stage.type === '$unwind' || stage.type === '$sort') {
            stage.flattenedPropertyPaths.forEach(path => {
              if (!this._select[path]) {
                additionaPaths[path] = true
                addedPaths = true
              }
            })
          }
        } else {
          startingStage = stage
        }

        stage = stage === this._pipeline.last ? null : stage.next
      }

      // add additional paths and deps, and optimize. typed models have already been split up so avoid excessive selectPaths processing.
      if (addedPaths) {
        this._models.map(model => model.schema.node).forEach(node => utils.extend(this._select, node.resolveSelectionDependencies(this.principal, additionaPaths)))
        utils.optimizePathSelections(this._select)
      }

      // add to pipeline before the first stage that cannot use an index.
      if (this._select) {
        const project = this._createStage('$project', this._select, { raw: true })
        if (!startingStage) {
          this._pipeline.push(project)
        } else if (~['$unwind'].indexOf(startingStage.type)) {
          this._pipeline.insertBefore(startingStage, project)
        } else {
          this._pipeline.insertAfter(startingStage, project)
        }
      }

    }

    this._validated = false
    this._validate()

  }

  _validate() {

    if (this._validated) {
      return
    }

    this._pipeline.forEach(n => n.validate())

    // validate use

    this._validated = true

  }

  /**
     * true when there are only explicit match, sort, limit and skip operations.
     */
  get canBeCalledAsQuery() {

    if (this._nativePipeline.length) {
      return false
    }

    let is = true
    this._pipeline.forEach(stage => {
      if (!(stage.type === '$match' || stage.type === '$sort' || stage.type === '$limit' || stage.type === '$skip' || ((stage.type === '$project' || stage.type === '$addFields') && stage.isRaw))) {
        is = false
      }
    })
    return is

  }

  /**
     *
     * @param options
     *   select - initial projections. these establish the first list of available nodes.
     *   pipeline
     *   skip
     *   limit
     *
     * @private
     */
  _parse(options) {

    if (_.some([options.startingAfter, options.endingBefore, options.where || options.map || options.group || options.sort], option => option !== undefined)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'startingAfter, endingBefore, where, map, group and sort are incompatible with pipeline.' })
    }

    this._skipOption = options.skip
    this._limitOption = options.limit

    let pipeline,
        optimizing = false // do we need to optimize?

    if (_.isString(options.pipeline)) {
      try {
        pipeline = JSON.parse(options.pipeline)
      } catch (e) {
        pipeline = null
        const fault = Fault.create('cortex.invalidArgument.query', { reason: 'Invalid pipeline JSON format', path: '' })
        fault.add(e)
        throw fault
      }
    } else {
      pipeline = (options.pipeline ? utils.array(options.pipeline, true) : [])
    }

    if (!_.isArray(pipeline)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Array expected for pipeline', path: '' })
    }

    if (!this.relax && pipeline.length > ParserConsts.MAX_STAGES) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid pipeline. Maximum stages (' + ParserConsts.MAX_STAGES + ') exceeded', path: '' })
    }

    if (options.preMatch) {
      let preMatch
      if (!((preMatch = this._createStage('$match', options.preMatch)).isEmpty)) {
        preMatch.skpiAcl = true
        this._pipeline.push(preMatch)
      }
    }
    if (options.preSort) {
      let preSort
      if (!((preSort = this._createStage('$sort', options.preSort)).isEmpty)) {
        preSort.skpiAcl = true
        this._pipeline.push(preSort)
      }
    }

    if (options.nativePipeline) {
      if (!Array.isArray(options.nativePipeline)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Array expected for native pipeline', path: '' })
      }
      options.nativePipeline.forEach(stage => {
        this.addNativeStage(stage)
      })
    }

    // convert to linked list of (stage, value) for easier optimizing.
    const ll = LinkedList.fromArray(pipeline.map((stage, i) => {

      if (_.isString(stage)) {
        try {
          stage = JSON.parse(stage)
        } catch (e) {
          stage = null
          const fault = Fault.create('cortex.invalidArgument.query', { reason: 'Invalid pipeline stage (' + i + ') JSON format', path: '' })
          fault.add(e)
          throw fault
        }
      }
      if (!utils.isPlainObject(stage)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Object expected for pipeline stage (' + i + ')', path: '' })
      }
      const stageKeys = Object.keys(stage),
            stageKey = stageKeys[0],
            node = new LinkedList.Node(stage[stageKey])

      if (stageKeys.length !== 1) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'stage (' + i + ') requires a single key', path: '' })
      }
      if (!this.engine.exists(stageKey)) {
        throw Fault.create('cortex.invalidArgument.query', '"' + stageKey + '" is not a valid pipeline stage.')
      }

      node.stage = stageKey
      return node
    }))

    // optimize and coalesce locally in order to have better control over index usage.
    while (optimizing) {

      optimizing = false

      let curr = ll.first
      while (curr && !optimizing && !curr.isLast) {

        const next = curr.next

        if (curr.stage === '$sort' && next.stage === '$match') {

          // $sort + $match Sequence Optimization
          ll.remove(curr)
          ll.insertAfter(next, curr)
          optimizing = true
        } else if (curr.stage === '$skip' && next.stage === '$limit') {

          // $skip + $limit Sequence Optimization
          next._value = utils.rInt(curr._value, 0) + utils.rInt(next._value, 0)
          ll.remove(curr)
          ll.insertAfter(next, curr)
          optimizing = true

          // $redact + $match Sequence Optimization ($redact not yet implemented)

        } else if (curr.stage === '$project' && (next.stage === '$skip' || next.stage === '$limit')) {

          // $project + $skip or $limit Sequence Optimization
          ll.remove(curr)
          ll.insertAfter(next, curr)
          optimizing = true

          // $sort + $limit Coalescence (automatic)

        } else if (curr.stage === '$limit' && next.stage === '$limit') {

          // $limit + $limit Coalescence

          curr._value = Math.min(utils.rInt(curr._value, 0), utils.rInt(next._value, 0))
          ll.remove(next)
          optimizing = true

        } else if (curr.stage === '$skip' && next.stage === '$skip') {

          // $skip + $skip Coalescence

          curr._value = utils.rInt(curr._value, 0) + utils.rInt(next._value, 0)
          ll.remove(next)
          optimizing = true

        } else if (curr.stage === '$match' && next.stage === '$match') {

          // $match + $match Coalescence

          curr._value = { $and: [curr._value, next._value] }
          ll.remove(next)
          optimizing = true

          // $lookup + $unwind Coalescence ($lookup not yet implemented)
        }

        curr = curr.next
      }
    }

    ll.forEach((entry, i) => {
      const stage = this._createStage(entry.stage, entry.value)
      if (stage.isEmpty) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Empty ' + entry.stage + ' pipeline stage (' + i + ')', path: entry.stage })
      }
      this._client_query.push({ [entry.stage]: entry.value })
      this._pipeline.push(stage)
    })

    // compile variables
    if (this._withVariables) {
      this._pipeline.forEach(stage => {
        this._variables['pipeline'] = utils.extend(this._variables['pipeline'], stage.variables)
      })
    }

  }

  /**
     *
     * @param options
     *  where - match expression
     *  map - single top-level [doc]array + match expression
     *  group - $by + aggregations. must have aggregations. auto-named. $by fields must not be uniquely indexed, _id fields.
     *  sort - top level indexed properties or (with group) any field in the output (eg. avg_dayOfMonth_dob)
     *  skip - offset into results.
     *  limit - number of documents to return
     *  startingAfter
     *  endingBefore
     *
     * @private
     */
  _parseLegacy(options) {

    if ((options.startingAfter !== undefined || options.endingBefore !== undefined) && (options.where || options.map || options.group || options.sort || options.cursor)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'startingAfter/endingBefore is incompatible with where, map, group, sort and streaming cursors.' })
    }

    this._skipOption = options.skip
    this._limitOption = options.limit

    let where = options.where,
        sort = options.sort,
        startingAfter,
        endingBefore,
        stage,
        stages = {}

    // when using endingBefore, reverse the order and reverse the output.
    if ((startingAfter = utils.getIdOrNull(options.startingAfter)) || (endingBefore = utils.getIdOrNull(options.endingBefore))) {
      this._reverseResult = !startingAfter
      where = utils.path({}, '_id.' + (this._reverseResult ? '$gt' : '$lt'), startingAfter || endingBefore, true)
      sort = { _id: this._reverseResult ? 1 : -1 }
    }

    // pre-match stage.
    if (options.preMatch) {
      if (!((stage = this._createStage('$match', options.preMatch)).isEmpty)) {
        stage.skipAcl = true
        this._pipeline.push(stage)
      }
    }
    if (options.preSort) {
      if (!((stage = this._createStage('$sort', options.preSort)).isEmpty)) {
        stage.skipAcl = true
        this._pipeline.push(stage)
      }
    }

    if (where && !((stage = this._createStage('$match', where)).isEmpty)) {
      this._client_query.push({ $match: where })
      this._pipeline.push(stages.where = stage)
    }

    // split map up into $unwind and possible $match. the variables for the match will
    if (options.map) {

      let map = options.map, path

      // if the map is a string, an likely a property name, create an object.
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
          const fault = Fault.create('cortex.invalidArgument.query', { reason: 'Invalid map JSON format', path: '' })
          fault.add(e)
          throw fault
        }
      }
      if (!utils.isPlainObject(map)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Object expected for map component', path: '' })
      }

      const mapKeys = Object.keys(map), mapKey = mapKeys[0]
      if (mapKeys.length !== 1) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Map component requires a single field', path: '' })
      }
      if (mapKey !== utils.normalizeObjectPath(mapKey, true, true, true)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid field name: (' + mapKey + ')', path: '' })
      }

      this._client_query.push({ $unwind: mapKey })
      this._pipeline.push(this._createStage('$unwind', mapKey))

      // is there a match?
      if (map[mapKey]) {

        // consider only what is in the mapping object but treat it as a new top-level query that can only match against the mapped field.
        const match = clone(map[mapKey])
        if (!utils.isPlainObject(match)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'A mapped document array expression must be an object.', path: mapKey })
        }

        // replace each field name with the prefix from the unwound property.
        Object.keys(match).forEach(function(key) {
          if (key[0] !== '$') {
            match[mapKey + '.' + key] = match[key]
            delete match[key]
          }
        })
        map = match

        stage = this._createStage('$match', map)
        if (stage.isEmpty) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'The where expression from a map existed but resolved to nothing.', path: mapKey })
        }

        this._client_query.push({ $unwind: map })
        this._pipeline.push(stage)
      }

    }

    if (options.group && (!(stage = this._createStage('$group', options.group)).isEmpty)) {
      this._client_query.push({ $group: options.group })
      this._pipeline.push(stages.group = stage)
    }

    if (!sort && !stages.group && this._ac.org.configuration.defaultIdentifierSortOrder !== 0) {
      sort = { _id: this._ac.org.configuration.defaultIdentifierSortOrder }
    }
    if (sort) {
      stage = this._createStage('$sort', sort)
      if (!stage.isEmpty) {
        this._client_query.push({ $sort: sort })
        this._pipeline.push(stages.sort = stage)
      }
    }

    // compile variables
    if (this._withVariables) {
      Object.keys(stages).forEach(stageName => {
        this._variables[stageName] = clone(stages[stageName].variables)
      })
    }

  }

  explainCursor(cursor, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    try {

      const privileged = config('debug.allowCursorExplain') || this.ac.principal.isSupportLogin || this.ac.principal.isSysAdmin()

      async.series({
        engine: callback => {
          callback(null, this.engineName)
        },
        query: callback => {
          if (!privileged || !options.query) {
            return callback(null, undefined)
          }
          const operation = cursor.operation || {}
          callback(null, operation.pipeline ? _.pick(cursor.operation, 'readPreference', 'pipeline') : operation.cmd)
        },
        plan: callback => {
          if (!options.plan) {
            return callback(null, undefined)
          }
          cursor.explain((err, result) => {
            if (!err) {
              if (!privileged) {
                result = undefined // @todo implement
              }
            }
            callback(err, result)
          })
        }
      }, callback)

    } catch (err) {
      callback(err)
    }

  }

  /**
     *
     * @param options
     * @param skip
     * @param limit
     * @param callback
     * @returns {*}
     */
  execCount(options, skip, limit, callback) {

    if (!this.canBeCalledAsQuery) {
      return callback(Fault.create('cortex.invalidArgument.query', { reason: 'cannot execute a count on a pipeline.' }))
    }

    try {
      this._validate()
    } catch (err) {
      return callback(err)
    }

    const query = this._buildQuery(),
          cursor = this.collection.find(query.find).project(this._select)

    try {
      skip = this.calculateSkip(skip)
    } catch (err) {
      return callback(err)
    }

    if (skip !== null && skip !== undefined) {
      if (skip < 0 || (!this.relax && skip > ParserConsts.MAX_SKIP)) {
        return callback(Fault.create('cortex.invalidArgument.query', { reason: 'skip option must be an integer between 0 and ' + ParserConsts.MAX_SKIP + ', inclusive' }))
      }
      cursor.skip(skip)
    }
    if (limit !== null && limit !== undefined) {
      if (limit <= 0 || (!this.relax && limit > ParserConsts.MAX_LIMIT)) {
        return callback(Fault.create('cortex.invalidArgument.query', { reason: 'limit option must be an integer between 1 and ' + ParserConsts.MAX_LIMIT + ', inclusive' }))
      }
      cursor.limit(limit)
    }

    callback = _.once(callback)

    try {

      if (options.explain) {
        cursor.count((skip !== null && skip !== undefined) || (limit !== null && limit !== undefined), { maxTimeMS: options.maxTimeMS || null })
        return this.explainCursor(cursor, options.explain, callback)
      }

      const start = Date.now()
      return cursor.count((skip !== null && skip !== undefined) || (limit !== null && limit !== undefined), { maxTimeMS: options.maxTimeMS || null }, (err, count) => {

        if (Date.now() - start > config('query.slowQueryThresholdMs')) {
          this._logSlowQuery('Slow database count detected', Date.now() - start, utils.path(err, 'codeName') === 'ExceededTimeLimit')
          if (config('query.verboseWarnings')) {
            logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow count detected (${Date.now() - start})`, 'Request: ' + this.reqId + ' - ' + JSON.stringify(query.find))
          } else {
            logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow count detected (${Date.now() - start})`, 'Request: ' + this.reqId)
          }
        }
        callback(err, count)
      })

    } catch (err) {
      callback(err)
    }

  }

  /**
     * @param options
     *      cursor: false - callback with cursor options instead of results. { batchSize: 1 }
     *      maxTimeMS: null - integer. limit the max query execution time.
     *      explain: false - if true, attaches explain to the result.
     * @param callback
     */
  exec(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback, false, false)

    const promise = Promise.resolve(null).then(async() => {

      if (this._withVariables) {
        throw Fault.create('cortex.unsupportedOperation.query', 'Cannot execute query containing variables.')
      }

      this._validate()

      await promised(this._hooks, 'fire', this, 'exec.before', null, { parser: this })

      // skip aggregation when it isn't required.
      if (this.canBeCalledAsQuery && config('runtime.allowCallingAsQuery')) {
        return promised(this, 'execAsQuery', options)
      }

      // check for limit before first match
      let idxLimit = -1,
          idxMatch = -1

      for (let i = 0; i < this._pipeline.length; i++) {
        const current = this._pipeline.at(i)
        if (current.key === '$limit') {
          idxLimit = i
        } else if (current.key === '$match') {
          idxMatch = i
          break
        }
      }
      if (idxLimit > -1 && idxMatch > -1 && idxLimit < idxMatch) {
        const limit = this._pipeline.at(idxLimit),
              match = this._pipeline.at(idxMatch)
        this._pipeline.remove(limit)
        this._pipeline.insertAfter(match, limit)
      }

      const parsedPipeline = this._pipeline.map(stage => stage.json),
            pipeline = this._match.map(stage => stage.json).concat(parsedPipeline),
            hasNativePipeline = this._nativePipeline.length > 0

      if (hasNativePipeline) {

        if (!options.cursor && !options.explain) {
          throw Fault.create('cortex.unsupportedOperation.query', 'Native pipelines currently only support cursors.')
        }
        // @temp, @todo for now, protect by simply culling these. eventually, integrate in parser model and hide anything
        // that is not readable or is system-only
        pipeline.push({
          $project: {
            meta: 0,
            org: 0,
            did: 0,
            acl: 0,
            aclv: 0,
            sequence: 0,
            reap: 0,
            favorites: 0,
            idx: 0,
            facets: 0
          }
        }, ...this._nativePipeline)

        return promised(this, '_exec', { pipeline, totalsPipeline: null }, options, false, false)

      } else {

        let skip = this.calculateSkip(this._skipOption),
            $skip = skip ? { $skip: skip } : null,
            minLimit = false,
            stageIdx,
            totalsPipeline = null

        if ($skip) {
          this._client_query.push($skip)
          pipeline.push($skip)
        }

        // remove any limit after the final stages, and add it back after the totals. this way, totaling still works as expected.
        stageIdx = pipeline.length
        while (stageIdx--) {
          let stage = pipeline[stageIdx]
          if (stage.$unwind !== undefined || stage.$match !== undefined || stage.$group !== undefined) {
            break
          }
          if (stage.$limit !== undefined) {
            if (minLimit === false || stage.$limit < minLimit) {
              minLimit = stage.$limit
            }
            pipeline.splice(stageIdx, 1)
          }
        }

        // if there is no minLimit already set, add one if it's required (when there's no cursor).
        if ((minLimit === false && !options.cursor) || (this._limitOption !== null && this._limitOption !== undefined)) {
          const { limit, addedToLimit } = this.calculateLimit(this._limitOption, true, !!options.cursor)
          if (limit) {
            const realLimit = addedToLimit ? limit - 1 : limit
            if (minLimit === false || realLimit < minLimit) {
              this._client_query.push({ $limit: realLimit })
              minLimit = realLimit
            }
          }
        }

        if (this._total) {
          // optimization. remove any final $project stages, since the number of document will be the same.
          let len = pipeline.length,
              numToRemove = 0
          while (len-- && pipeline[len].$project) {
            numToRemove++
          }
          totalsPipeline = (numToRemove ? pipeline.slice(0, pipeline.length - numToRemove) : pipeline).concat({ $group: { _id: null, total: { $sum: 1 } } })
        }

        const { limit, addedToLimit } = this.calculateLimit(minLimit, true, !!options.cursor),
              reader = {
                pipeline: pipeline,
                totalsPipeline: totalsPipeline
              }

        if (limit) {
          pipeline.push({ $limit: limit })
        }
        if (pipeline.length === 0) {
          pipeline.push({ $match: {} })
        }

        if (this.isBatch()) {

          if (options.cursor) {
            throw Fault.create('cortex.unsupportedOperation.query', 'Cannot return a cursor for batched operations')
          }

          const results = {
            object: 'map',
            data: {}
          }

          return new Promise((resolve, reject) => {
            async.eachLimit(
              this._batch.values,
              ParserConsts.BATCH_LIMIT,
              (value, callback) => {
                const match = [{ $match: { [this._batch.field]: value } }],
                      batched = {
                        pipeline: match.concat(reader.pipeline),
                        totalsPipeline: reader.totalsPipeline ? match.concat(reader.totalsPipeline) : null
                      }
                this._exec(batched, options, limit, addedToLimit, (err, result) => {
                  if (!err) {
                    results.data[value] = result
                  }
                  callback(err)
                })
              },
              err => {
                err ? reject(err) : resolve(results)
              }
            )
          })
        }

        return promised(this, '_exec', reader, options, limit, addedToLimit)

      }

    })

    if (callback) {
      promise
        .then(v => callback(null, v))
        .catch(callback)
    }

    return promise

  }

  /**
     * @param options
     *      cursor: false - callback with cursor options instead of results. { batchSize: 1 }
     *      maxTimeMS: null
     * @param callback
     */
  execAsQuery(options, callback) {

    try {

      const query = this._buildQuery()

      if (this.isBatch()) {

        if (options.cursor) {
          return callback(Fault.create('cortex.unsupportedOperation.query', 'Cannot return a cursor for batched operations'))
        }

        const results = {
          object: 'map',
          data: {}
        }
        async.eachLimit(
          this._batch.values,
          ParserConsts.BATCH_LIMIT,
          (value, callback) => {

            const batched = utils.extend({}, query, {
              find: (Object.keys(query.find).length) ? { $and: [{ [this._batch.field]: value }, query.find] } : { [this._batch.field]: value }
            })

            this._execQuery(batched, options, (err, result) => {
              if (!err) {
                results.data[value] = result
              }
              callback(err)
            })
          },
          err => {
            callback(err, results)
          }
        )

      } else {
        this._execQuery(query, options, callback)
      }
    } catch (err) {
      callback(err)
    }

  }

  buildMatch() {

    // coalesce matches into find (or {})
    const match = this._match.map(stage => stage.json).concat(this._pipeline.filter(stage => stage.type === '$match').map(stage => stage.json))
    return match.reduce(function(find, entry) {
      if (!find) {
        return entry.$match
      } else if (!find.$and) {
        return { $and: [find, entry.$match] }
      }
      find.$and.push(entry.$match)
      return find
    }, null) || {}

  }

  /**
     * build a query.
     * note: may overwrite parser skip and limit properties.
     * @private
     */
  _buildQuery() {

    const query = {}

    query.find = this.buildMatch()

    // coalesce sort stages into single sort (or null)
    query.sort = this._pipeline.filter(stage => stage.type === '$sort').map(stage => stage.json).reduce((sort, entry) => {
      return utils.extend(sort, entry.$sort)
    }, null)

    return query

  }

  /**
     * executes a query.
     *
     * @param query
     * @param options
     *      cursor
     * @param callback -> err, {}
     * @returns {*}
     * @private
     */
  _execQuery(query, options, callback) {

    callback = _.once(callback)

    try {

      const cursor = this.collection.find(query.find).project(this._select),
            // coalesce skip stages when running as plain query.
            skip = this.calculateSkip(utils.rInt(this._skipOption, 0) + this._pipeline.reduce((skip, stage) => {
              if (stage.type === '$skip') {
                const json = stage.json
                if (json && json.$skip) {
                  skip += json.$skip
                }
              }
              return skip
            }, 0)),
            // for limit options, start with the most limiting. start off with limit option.
            limitOption = this._pipeline.reduce((limit, stage) => {
              if (stage.type === '$limit') {
                const json = stage.json
                if (json && json.$limit > 0) {
                  limit = utils.isInteger(limit) ? Math.min(json.$limit, limit) : json.$limit
                }
              }
              return limit
            }, utils.isNumeric(this._limitOption) ? parseInt(this._limitOption) : this._limitOption),
            { limit, addedToLimit } = this.calculateLimit(limitOption, true, !!options.cursor),
            start = Date.now()

      if (query.sort) {
        cursor.sort(query.sort)
      }
      if (skip) {
        cursor.skip(skip)
      }
      if (limit) {
        cursor.limit(limit)
      }
      if (options.maxTimeMS) {
        cursor.maxTimeMS(utils.rInt(options.maxTimeMS, 250))
      }
      if (options.cursor) {
        if (options.cursor.batchSize) {
          cursor.batchSize(Math.min(1000, Math.max(1, utils.rInt(options.cursor.batchSize, 100))))
        }
        return this._returnCursor(cursor, limit, addedToLimit, callback)
      }
      if (options.explain) {
        return this.explainCursor(cursor, options.explain, (err, result) => {
          callback(err, Object.assign(result || {}, { object: 'list', data: [], hasMore: false }))
        })
      }

      cursor.toArray((err, results) => {

        if (Date.now() - start > config('query.slowQueryThresholdMs')) {
          const slowMs = Date.now() - start
          this._logSlowQuery('Slow query detected', slowMs, utils.path(err, 'codeName') === 'ExceededTimeLimit')
          if (config('query.verboseWarnings')) {
            const start = Date.now()
            cursor.clone().explain((err_, results) => {
              logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow query detected (${slowMs}, ${Date.now() - start}), Env: ${this.orgId}, Request: ${this.reqId} - ${stringifySafe(query.find)}`)
              logger.warn(stringifySafe(results, null, 4))
            })
          } else {
            logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow query detected (${slowMs}), Env: ${this.orgId}, Request: ${this.reqId}`)
          }
        }

        if (err) {
          return callback(err)
        }

        try {

          const count = results.length

          if (addedToLimit && count === limit) {
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

          if (!this._total) {
            return callback(null, results)
          }

          this.collection.countDocuments(query.find, function(err, total) {
            if (!err) {
              results.total = total
            }
            callback(err, results)
          })

        } catch (err) {
          callback(err)
        }

      })
    } catch (err) {
      callback(err)
    }

  }

  _returnCursor(cursor, limit, addedToLimit, callback) {

    cursor.hasMore = false

    if (limit !== false && addedToLimit) {

      let count = 0

      const _hasNext = cursor.hasNext,
            _next = cursor.next

      cursor.hasNext = function(callback) {

        _hasNext.call(cursor, function(err, has) {

          if (has && count === limit - 1) {
            cursor.hasMore = true
            has = false
          }
          callback(err, has)

        })

      }

      cursor.next = function(callback) {

        if (count === limit - 1) {
          if (cursor.hasMore) {
            return callback()
          } else {
            return _hasNext.call(cursor, function(err, has) {
              cursor.hasMore = !!has
              callback(err)
            })
          }
        }

        _next.call(cursor, function(err, doc) {

          if (!err) {
            count++
          }
          callback(err, doc)

        })

      }

    }

    callback(null, cursor)
  }

  /**
     * executes a pipeline
     *
     * @param reader
     * @param options
     *      cursor
     *      maxTimeMS: null
     *      explain
     * @param limit limit to apply. may be false
     * @param addedToLimit added 1 for paging.
     * @param callback -> err, {}
     * @returns {*}
     * @private
     */
  _exec(reader, options, limit, addedToLimit, callback) {

    callback = _.once(callback)

    try {

      const pipeline = reader.pipeline,
            cursorOptions = {
              batchSize: Math.min(1000, Math.max(1, utils.rInt(utils.path(options, 'cursor.batchSize'), 100)))
            },
            cursor = this.collection.aggregate(pipeline, { cursor: cursorOptions }),
            start = Date.now()

      cursor.maxTimeMS(options.maxTimeMS || null)

      if (options.explain) {
        return this.explainCursor(cursor, options.explain, (err, result) => {
          callback(err, Object.assign(result || {}, { object: 'list', data: [], hasMore: false }))
        })
      }

      if (options.cursor) {
        return this._returnCursor(cursor, limit, addedToLimit, callback)
      }

      cursor.toArray((err, results) => {

        if (Date.now() - start > config('query.slowQueryThresholdMs')) {
          const slowMs = Date.now() - start
          this._logSlowQuery('Slow pipeline detected', slowMs, utils.path(err, 'codeName') === 'ExceededTimeLimit')
          if (config('query.verboseWarnings')) {
            const start = Date.now()
            this.collection.aggregate(pipeline, { explain: true }, (err_, results) => {
              logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow aggregation detected (${slowMs}, ${Date.now() - start})`, ('Request: ' + this.reqId) + ' - ' + JSON.stringify(reader.pipeline))
              logger.warn(stringifySafe(results, null, 4))
            })
          } else {
            logger.warn(`Parser: ${utils.path(err, 'codeName') === 'ExceededTimeLimit' ? 'ExceededTimeLimit' : ''} slow aggregation detected (${slowMs})`, ('Request: ' + this.reqId) + ' - ' + JSON.stringify(reader.pipeline.map(s => _.keys(s)[0])))
          }
        }

        if (err) {
          return callback(err)
        }

        try {

          const initResults = (err, results) => {

                  // if there has been a group stage, acl will be missing.
                  if (!err) {
                    if (this._pipeline.filter(stage => stage.key === '$group').length) {
                      const sharedAcl = [{ type: acl.AccessTargets.Account, target: this.ac.principalId, allow: this.accessLevel }]
                      results.data.forEach(entry => {
                        entry.acl = sharedAcl
                      })
                    }
                  }

                  callback(err, results)
                },
                count = results.length

          if (addedToLimit && count === limit) {
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

          if (!reader.totalsPipeline) {
            return initResults(null, results)
          }

          this.collection.aggregate(reader.totalsPipeline, { cursor: {} }).toArray(function(err, total) {
            if (!err) {
              results.total = utils.rInt(utils.path(total, '0.total'), 0)
            }
            initResults(err, results)
          })

        } catch (err) {
          callback(err)

        }

      })
    } catch (err) {
      callback(err)
    }

  }

  /**
     *
     * @param type
     * @param expression
     * @param options
     *  raw: false
     * @returns {type}
     * @private
     */
  _createStage(type, expression, options) {
    options = options || {}
    return this.engine.create(type, this, expression, options)
  }

  static get stages() {

    return Engines.latest

  }

  static get engineNames() {

    return Object.keys(Engines).sort()

  }

}

module.exports = Parser
