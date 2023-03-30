
const {
        isSet, clamp, isString, compact
      } = require('util.values'),
      objects = require('objects'),
      { BufferedApiCursor } = require('util.cursor'),
      { createOperation, getAllowedOptions } = require('db.util'),
      { register } = require('db.factory'),
      pEngine = Symbol('engine'),
      pExplain = Symbol('explain'),
      pMaxTimeMs = Symbol('max_time_ms'), // the max time a query will be allowed to run.
      pName = Symbol('name'), // the plural name of the object
      pSkipAcl = Symbol('skip_acl'), // skip acl access checks
      pBypassCreateAcl = Symbol('bypass_create_acl'), // bypass create acl.
      pLean = Symbol('lean'), // lean updates do not return updated or inserted documents.
      pMerge = Symbol('merge'), // merge mode allows merging of documents, allowing push and pull at once.
      pLocale = Symbol('locale'), // locale selection
      pTransform = Symbol('transform'), // transform selection
      pAsync = Symbol('async'), // bulk operation async options
      pDocument = Symbol('document'), // the input document
      pGrant = Symbol('grant'), // grant access level
      pRoles = Symbol('roles'), // roles granted
      pPrefix = Symbol('prefix'), // update operation path prefix
      pCrossOrg = Symbol('crossOrg'), // used for medable support cases
      pDryRun = Symbol('dryRun'), // dry run for write operations
      fOptions = Symbol('options'), // cursor options function
      pMatch = Symbol('match'), // the where component of the query
      pSkip = Symbol('skip'), // the skip component of the query
      pLimit = Symbol('limit'), // the limit component of the query
      pSort = Symbol('sort'), // the sort component of the query
      pExpand = Symbol('expand'), // the expand component of the query
      pThrowNotFound = Symbol('throwNotFound'), // throw when read one operation finds nothing.
      pPaths = Symbol('paths'), // select specific paths
      pPassive = Symbol('passive'), // passive option for write errors.
      pInclude = Symbol('include'), // optional paths to include
      pThrough = Symbol('through'), // list and reference read/write-through prefix,
      pBulk = Symbol('bulk'), // wrapper parent bulk operation
      pOperation = Symbol('operation'), // bulk operation/cursor object
      pBulkName = Symbol('bulkName'), // bulk operation name
      pHalt = Symbol('halt'), // bulk operation halt on errors
      pWrap = Symbol('wrap'), // wrap bulk output
      pOutput = Symbol('output'), // output bulk operation result
      pAs = Symbol('as'), // run bulk op as
      pIsUnmanaged = Symbol('isUnmanaged'), // run as isUnmanaged operation
      pDisableTriggers = Symbol('disableTriggers'), // disableTriggers
      pOps = Symbol('ops'), // wrapped operations.
      pOpName = Symbol('opName'), // operationName
      fOps = Symbol('bulkOps'), // bulk ops function,
      WRAPPER_OPTIONS = ['name', 'halt', 'wrap', 'output', 'as']

let Undefined

class Operation {

  constructor(name) {
    this[pName] = name
    this[pSkipAcl] = null
    this[pThrough] = null
    this[pGrant] = null
    this[pRoles] = null
    this[pCrossOrg] = null
    this[pDryRun] = null
    this[pPassive] = null
    this[pLocale] = null
  }

  skipAcl(v = true) {
    this[pSkipAcl] = Boolean(v)
    return this
  }

  object(name) {
    this[pName] = name
    return this
  }

  through(v = '') {
    this[pThrough] = String(v)
    return this
  }

  grant(v = null) {
    this[pGrant] = v
    return this
  }

  roles(...roles) {
    this[pRoles] = roles
    return this
  }

  crossOrg(v = true) {
    this[pCrossOrg] = Boolean(v)
    return this
  }

  dryRun(v = true) {
    this[pDryRun] = Boolean(v)
    return this
  }

  passive(v = true) {
    this[pPassive] = Boolean(v)
    return this
  }

  locale(v) {
    this[pLocale] = v
    return this
  }

  [fOptions]() {
    return {
      skipAcl: this[pSkipAcl],
      grant: this[pGrant],
      roles: this[pRoles],
      crossOrg: this[pCrossOrg],
      dryRun: this[pDryRun],
      through: this[pThrough],
      passive: this[pPassive],
      locale: this[pLocale]
    }
  }

  getOptions() {
    return compact({
      object: this[pName],
      operation: this[pOpName],
      ...this[fOptions]()
    }, Undefined, null)
  }

  get userOptions() {
    return ['passive', 'dryRun', 'locale']
  }

  get privilegedOptions() {
    return ['grant', 'roles', 'skipAcl']
  }

  setOptions(userOptions = {}, privilegedOptions = {}) {

    const allowedOptions = getAllowedOptions(
      this.userOptions,
      this.privilegedOptions,
      userOptions,
      privilegedOptions
    )

    Object.entries(allowedOptions).forEach(([fn, value]) => {
      this[fn](value)
    })

    return this

  }

}

// ---------------------------------------------------------------

class ReadOneOperation extends Operation {

  constructor(name, where) {
    super(name)
    this[pMatch] = where
    this[pThrowNotFound] = true
    this[pMaxTimeMs] = script.config.query.defaultMaxTimeMS
  }

  where(where) {
    this[pMatch] = where
    return this
  }

  expand(v, ...more) {
    this[pExpand] = Array.isArray(v) ? v : [v].concat(more)
    return this
  }

  paths(v, ...more) {
    this[pPaths] = Array.isArray(v) ? v : [v].concat(more)
    return this
  }

  include(v, ...more) {
    this[pInclude] = Array.isArray(v) ? v : [v].concat(more)
    return this
  }

  sort(v) {
    this[pSort] = v
    return this
  }

  path(v = '') {
    this[pPrefix] = v
    return this
  }

  throwNotFound(v = true) {
    this[pThrowNotFound] = v
    return this
  }

  engine(v = 'stable') {
    this[pEngine] = v
    return this
  }

  explain(v = true) {
    this[pExplain] = v
    return this
  }

  maxTimeMS(v) {
    this[pMaxTimeMs] = clamp(v, script.config.query.minTimeMS, script.config.query.maxTimeMS)
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      where: this[pMatch],
      paths: this[pPaths],
      include: this[pInclude],
      expand: this[pExpand],
      path: this[pPrefix],
      sort: this[pSort],
      throwNotFound: this[pThrowNotFound],
      engine: this[pEngine],
      explain: this[pExplain],
      maxTimeMS: this[pMaxTimeMs]
    }
  }

  execute() {
    return objects.driver.readOne(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      where: this[pMatch],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('where', 'paths', 'include', 'expand', 'path', 'sort', 'throwNotFound', 'engine', 'explain', 'maxTimeMS')
  }

  get [pOpName]() {
    return 'readOne'
  }

}

// ---------------------------------------------------------------

class CountOperation extends Operation {

  constructor(name, where) {
    super(name)
    this[pMatch] = where
    this[pMaxTimeMs] = script.config.query.defaultMaxTimeMS
  }

  limit(v) {
    this[pLimit] = v
    return this
  }

  skip(v) {
    this[pSkip] = v
    return this
  }

  where(where) {
    this[pMatch] = where
    return this
  }

  engine(v = 'stable') {
    this[pEngine] = v
    return this
  }

  explain(v = true) {
    this[pExplain] = v
    return this
  }

  maxTimeMS(v) {
    this[pMaxTimeMs] = clamp(v, script.config.query.minTimeMS, script.config.query.maxTimeMS)
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      skip: this[pSkip],
      limit: this[pLimit],
      where: this[pMatch],
      engine: this[pEngine],
      explain: this[pExplain],
      maxTimeMS: this[pMaxTimeMs]
    }
  }

  execute() {
    return objects.driver.count(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      where: this[pMatch],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('where', 'skip', 'limit', 'engine', 'explain', 'maxTimeMS')
  }

  get [pOpName]() {
    return 'count'
  }

}

// ---------------------------------------------------------------

class WriteOneOperation extends Operation {

  constructor(name) {
    super(name)
    this[pPaths] = null
    this[pInclude] = null
    this[pLean] = true
    this[pIsUnmanaged] = null
    this[pDisableTriggers] = null
  }

  isUnmanaged(v = true) {
    this[pIsUnmanaged] = Boolean(v)
    return this
  }

  disableTriggers(v = true) {
    this[pDisableTriggers] = Boolean(v)
    return this
  }

  paths(v, ...more) {
    this[pPaths] = Array.isArray(v) ? v : [v].concat(more)
    this[pLean] = false
    return this
  }

  include(v, ...more) {
    this[pInclude] = Array.isArray(v) ? v : [v].concat(more)
    this[pLean] = false
    return this
  }

  lean(v = true) {
    this[pLean] = v === 'modified' ? v : Boolean(v)
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      paths: this[pPaths],
      include: this[pInclude],
      lean: this[pLean],
      isUnmanaged: this[pIsUnmanaged],
      disableTriggers: this[pDisableTriggers]
    }
  }

  get userOptions() {
    return super.userOptions.concat('paths', 'include', 'lean')
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('isUnmanaged', 'disableTriggers')
  }

}

// ---------------------------------------------------------------

class InsertOperation extends WriteOneOperation {

  constructor(name, document) {
    super(name)
    this.document(document)
    this[pBypassCreateAcl] = null
  }

  bypassCreateAcl(v = true) {
    this[pBypassCreateAcl] = Boolean(v)
    return this
  }

  document(document) {
    this[pDocument] = document
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      bypassCreateAcl: this[pBypassCreateAcl]
    }
  }

  execute() {
    return objects.driver.insertOne(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      document: this[pDocument],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('document')
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('bypassCreateAcl')
  }

  get [pOpName]() {
    return 'insertOne'
  }

}

class WriteManyOperation extends Operation {

  constructor(name, document = []) {
    super(name)
    this[pIsUnmanaged] = null
    this[pDisableTriggers] = null
  }

  isUnmanaged(v = true) {
    this[pIsUnmanaged] = Boolean(v)
    return this
  }

  disableTriggers(v = true) {
    this[pDisableTriggers] = Boolean(v)
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      isUnmanaged: this[pIsUnmanaged],
      disableTriggers: this[pDisableTriggers]
    }
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('isUnmanaged', 'disableTriggers')
  }

}

class InsertManyOperation extends WriteManyOperation {

  constructor(name, document = []) {
    super(name)
    this.documents(document)
    this[pBypassCreateAcl] = null
  }

  bypassCreateAcl(v = true) {
    this[pBypassCreateAcl] = Boolean(v)
    return this
  }

  documents(document) {
    this[pDocument] = Array.isArray(document) ? document : [document]
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      bypassCreateAcl: this[pBypassCreateAcl]
    }
  }

  execute() {
    return objects.driver.insertMany(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      documents: this[pDocument],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('documents')
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('bypassCreateAcl')
  }

  get [pOpName]() {
    return 'insertMany'
  }

}

class PatchOperation extends WriteOneOperation {

  constructor(name, match, ops) {
    super(name)
    this[pMatch] = match
    this[pOps] = ops
    this[pPrefix] = null
    this[pMerge] = false
  }

  [fOptions]() {

    if (this[pPrefix] && this[pThrough]) {
      throw new TypeError('through() and pathPrefix cannot be used together.')
    }

    return {
      ...super[fOptions](),
      path: this[pPrefix],
      mergeDocuments: this[pMerge]
    }
  }

  ops(ops) {
    this[pOps] = ops
    return this
  }

  match(match) {
    this[pMatch] = match
    return this
  }

  merge(v = true) {
    this[pMerge] = Boolean(v)
    return this
  }

  mergeDocuments(v = true) {
    return this.merge(v) // alias of merge for setOptions
  }

  pathPrefix(v = null) {
    if (v !== null) {
      v = String(v)
    }
    if (this[pLean] === null) this[pLean] = false
    this[pPrefix] = v
    return this
  }

  path(v = null) {
    return this.pathPrefix(v) // // alias of pathPrefix for setOptions
  }

  execute() {
    return objects.driver.patchOne(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      match: this[pMatch],
      ops: this[pOps],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('path', 'mergeDocuments', 'match', 'ops')
  }

  get [pOpName]() {
    return 'patchOne'
  }

}

class PatchManyOperation extends WriteManyOperation {

  constructor(name, match, ops = null) {
    super(name)
    this[pMatch] = ops === null ? {} : match
    this[pOps] = ops === null ? match : ops
    this[pLimit] = null
    this[pMerge] = false
  }

  limit(v) {
    this[pLimit] = v
    return this
  }

  ops(ops) {
    this[pOps] = ops
    return this
  }

  match(match) {
    this[pMatch] = match
    return this
  }

  merge(v = true) {
    this[pMerge] = Boolean(v)
    return this
  }

  mergeDocuments(v = true) {
    return this.merge(v) // alias of merge for setOptions
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      limit: this[pLimit],
      mergeDocuments: this[pMerge]
    }
  }

  execute() {
    return objects.driver.patchMany(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      match: this[pMatch],
      ops: this[pOps],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('mergeDocuments', 'match', 'ops', 'limit')
  }

  get [pOpName]() {
    return 'patchMany'
  }

}

class UpdateOperation extends WriteOneOperation {

  constructor(name, match, document) {
    super(name)
    this[pMatch] = match
    this[pDocument] = document
    this[pPrefix] = null
    this[pMerge] = false
  }

  [fOptions]() {

    if (this[pPrefix] && this[pThrough]) {
      throw new TypeError('through() and pathPrefix cannot be used together.')
    }

    return {
      ...super[fOptions](),
      path: this[pPrefix],
      mergeDocuments: this[pMerge]
    }
  }

  match(match) {
    this[pMatch] = match
    return this
  }

  update(document) {
    this[pDocument] = document
    return this
  }

  merge(v = true) {
    this[pMerge] = Boolean(v)
    return this
  }

  mergeDocuments(v = true) {
    return this.merge(v) // alias of merge for setOptions
  }

  pathPrefix(v = null) {
    if (v !== null) {
      v = String(v)
    }
    if (this[pLean] === null) this[pLean] = false
    this[pPrefix] = v
    return this
  }

  path(v = null) {
    return this.pathPrefix(v) // // alias of pathPrefix for setOptions
  }

  pathDelete(path = null) {
    if (path !== null) {
      this.pathPrefix(path)
    }
    return objects.delete(this[pName], this[pMatch], this[fOptions]())
  }

  pathUpdate(path = null, body = null) {
    if (typeof path !== 'string') {
      body = path
      path = null
    }
    if (path !== null) {
      this.pathPrefix(path)
    }
    return objects.update(this[pName], this[pMatch], body, this[fOptions]())
  }

  pathPush(path = null, body = null) {
    if (typeof path !== 'string') {
      body = path
      path = null
    }
    if (path !== null) {
      this.pathPrefix(path)
    }
    return objects.push(this[pName], this[pMatch], body, this[fOptions]())
  }

  pathPatch(path = null, body = null) {
    if (typeof path !== 'string') {
      body = path
      path = null
    }
    if (path !== null) {
      this.pathPrefix(path)
    }
    return objects.patch(this[pName], this[pMatch], body, this[fOptions]())
  }

  execute() {
    return objects.driver.updateOne(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      match: this[pMatch],
      update: this[pDocument],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('path', 'mergeDocuments', 'match', 'update')
  }

  get [pOpName]() {
    return 'updateOne'
  }

}

class UpdateManyOperation extends WriteManyOperation {

  constructor(name, match, document = null) {
    super(name)
    this[pMatch] = document === null ? {} : match
    this[pDocument] = document === null ? match : document
    this[pLimit] = null
    this[pMerge] = false
  }

  limit(v) {
    this[pLimit] = v
    return this
  }

  match(match) {
    this[pMatch] = match
    return this
  }

  update(document) {
    this[pDocument] = document
    return this
  }

  merge(v = true) {
    this[pMerge] = Boolean(v)
    return this
  }

  mergeDocuments(v = true) {
    return this.merge(v) // alias of merge for setOptions
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      limit: this[pLimit],
      mergeDocuments: this[pMerge]
    }
  }

  execute() {
    return objects.driver.updateMany(this[pName], this.getOptions())
  }

  getOptions() {
    return compact({
      match: this[pMatch],
      update: this[pDocument],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('limit', 'mergeDocuments', 'match', 'update')
  }

  get [pOpName]() {
    return 'updateMany'
  }

}

// ---------------------------------------------------------------

class DeleteOperation extends Operation {

  constructor(name, match = {}) {
    super(name)
    this[pMatch] = match
    this[pDisableTriggers] = null
  }

  match(match) {
    this[pMatch] = match
    return this
  }

  disableTriggers(v = true) {
    this[pDisableTriggers] = Boolean(v)
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      disableTriggers: this[pDisableTriggers]
    }
  }

  execute() {
    return objects.delete(this[pName], this[pMatch], this[fOptions]())
  }

  getOptions() {
    return compact({
      match: this[pMatch],
      ...super.getOptions()
    }, Undefined, null)
  }

  get userOptions() {
    return super.userOptions.concat('match')
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('disableTriggers')
  }

  get [pOpName]() {
    return 'deleteOne'
  }

}

class DeleteManyOperation extends DeleteOperation {

  constructor(name, match) {
    super(name, match)
    this[pLimit] = null
  }

  limit(v) {
    this[pLimit] = v
    return this
  }

  [fOptions]() {
    return {
      ...super[fOptions](),
      limit: this[pLimit]
    }
  }

  execute() {
    return objects.deleteMany(this[pName], this[pMatch], this[fOptions]())
  }

  get userOptions() {
    return super.userOptions.concat('limit')
  }

  get [pOpName]() {
    return 'deleteMany'
  }

}

// ---------------------------------------------------------------

class BulkOperationWrapper {

  constructor(bulk, operation, options = {}) {

    this[pBulk] = bulk
    this[pOperation] = operation

    if (isSet(options)) {
      WRAPPER_OPTIONS.forEach((prop) => {
        if (isSet(options[prop])) {
          this[prop](options[prop])
        }
      })
    }

  }

  name(v = '') {
    this[pBulkName] = String(v)
    return this
  }

  halt(v = true) {
    this[pHalt] = Boolean(v)
    return this
  }

  wrap(v = true) {
    this[pWrap] = Boolean(v)
    return this
  }

  output(v = true) {
    this[pOutput] = Boolean(v)
    return this
  }

  as(id, options = {}) {
    if (isString(id)) {
      this[pAs] = { id, ...(options || {}) }
    } else if (isSet(id)) {
      this[pAs] = id
    }
    return this
  }

  get bulk() {
    return this[pBulk]
  }

  get operation() {
    return this[pOperation]
  }

  getOptions() {
    return compact({
      name: this[pBulkName],
      halt: this[pHalt],
      wrap: this[pWrap],
      output: this[pOutput],
      as: this[pAs],
      ...this.operation.getOptions()
    }, Undefined)
  }

}

class BulkOperation extends BufferedApiCursor {

  constructor(name) {

    const execute = function() {
      return objects.driver.bulk(
        '',
        this[fOptions]()
      )
    }

    super(null, execute, { shared: false })

    this[pName] = name
    this[pOps] = []
    this[pTransform] = null
    this[pAsync] = null
  }

  object(name) {
    this[pName] = name
    return this
  }

  add(operation, options) {

    const wrapped = new BulkOperationWrapper(this, operation, options)
    this[pOps].push(wrapped)
    return this

  }

  ops(ops, ...more) {

    const operations = Array.isArray(ops) ? ops : [ops].concat(more)
    operations.forEach((options) => {

      // @todo. inherit privileged options
      const operations = createOperation({ object: this[pName], ...options })
      this.add(operations, options)

    })
    return this

  }

  transform(v) {
    this[pTransform] = v
    return this
  }

  async(v = {}) {
    this[pAsync] = v
    return this
  }

  [fOptions]() {
    return {
      ops: this[fOps](),
      transform: this[pTransform],
      async: this[pAsync]
    }
  }

  [fOps]() {
    return this[pOps].map((op) => op.getOptions())
  }

  getOptions() {
    return compact({
      operation: 'bulk',
      object: this[pName], // can be null. used as a default for child operations.
      ...this[fOptions]()
    }, Undefined, null)
  }

  setOptions(...args) {
    return Operation.prototype.setOptions.call(this, ...args)
  }

  get userOptions() {
    return ['object', 'ops']
  }

  get privilegedOptions() {
    return ['transform', 'async']
  }

}

register('insertOne', InsertOperation)
register('insertMany', InsertManyOperation)
register('updateOne', UpdateOperation)
register('updateMany', UpdateManyOperation)
register('patchOne', PatchOperation)
register('patchMany', PatchManyOperation)
register('deleteOne', DeleteOperation)
register('deleteMany', DeleteManyOperation)
register('bulk', BulkOperation)
register('readOne', ReadOneOperation)
register('count', CountOperation)

export {
  InsertOperation,
  InsertManyOperation,
  UpdateOperation,
  UpdateManyOperation,
  PatchOperation,
  PatchManyOperation,
  DeleteOperation,
  DeleteManyOperation,
  BulkOperation,
  ReadOneOperation,
  CountOperation
}
