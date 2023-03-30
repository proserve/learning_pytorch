
/* eslint-disable no-new-func */
import { clamp, rBool, compact } from 'util.values'
import { BufferedApiCursor } from 'util.cursor'
import { getAllowedOptions } from 'db.util'
import objects from 'objects'
import { register } from 'db.factory'

// ---------------------------------------------------------------

const pName = Symbol('name'), // the plural name of the object
      pEngine = Symbol('engine'),
      pMaxTimeMs = Symbol('max_time_ms'), // the max time a query will be allowed to run.
      pSkipAcl = Symbol('skip_acl'), // skip acl access checks
      pGrant = Symbol('grant'), // grant access level
      pRoles = Symbol('roles'), // roles granted
      pPrefix = Symbol('prefix'), // update operation path prefix
      pAccess = Symbol('access'), // only return documents with the level of access specified
      pCrossOrg = Symbol('crossOrg'), // used for medable support cases
      pStrict = Symbol('strict'), // strict mode parsing
      pLocale = Symbol('locale'), // locale selection
      pTransform = Symbol('transform'), // transform selection
      pUnindexed = Symbol('indexed'), // force lookups to be indexed
      fOptions = Symbol('options'), // cursor options function
      pMatch = Symbol('match'), // the where component of the query
      pSort = Symbol('sort'), // the where component of the query
      pSkip = Symbol('skip'), // the skip component of the query
      pLimit = Symbol('limit'), // the limit component of the query
      pPaths = Symbol('paths'), // select specific paths
      pInclude = Symbol('include'), // optional paths to include
      pExpand = Symbol('expand'), // paths to expand
      pPassive = Symbol('passive'), // ignore missing paths
      pThrough = Symbol('through'), // list through prefix
      fAdd = Symbol('add'),
      pPipeline = Symbol('pipeline'),
      pNativePipeline = Symbol('nativePipeline'),
      pExpressionPipeline = Symbol('expressionPipeline')

let Undefined

class Cursor extends BufferedApiCursor {

  constructor(name) {

    const execute = function() {

      return objects.driver.cursor(
        this[pName],
        this[fOptions]()
      )
    }
    super(null, execute, { shared: false })

    this[pName] = name
    this[pMaxTimeMs] = script.config.query.defaultMaxTimeMS
    this[pSkipAcl] = null
    this[pGrant] = null
    this[pRoles] = null
    this[pAccess] = null
    this[pCrossOrg] = null
    this[pPrefix] = null
    this[pStrict] = null
    this[pUnindexed] = null
    this[pThrough] = null
    this[pLocale] = null
    this[pTransform] = null
  }

  object(name) {
    this[pName] = name
    return this
  }

  expressionPipeline(v) {
    this[pExpressionPipeline] = v
    return this
  }

  access(v) {
    this[pAccess] = clamp(v, 1, 8)
    return this
  }

  accessLevel(v) {
    return this.access(v) // alias for setOptions()
  }

  pathPrefix(v = null) {
    if (v !== null) {
      v = String(v)
    }
    this[pPrefix] = v
    return this
  }

  prefix(v = null) {
    return this.pathPrefix(v) // alias for setOptions()
  }

  crossOrg(v = true) {
    this[pCrossOrg] = Boolean(v)
    return this
  }

  strict(v = true) {
    this[pStrict] = Boolean(v)
    return this
  }

  indexed(v = true) {
    this[pUnindexed] = !v
    return this
  }

  engine(v = 'stable') {
    this[pEngine] = v
    return this
  }

  explain(explain = true) {
    return objects.list(this[pName], Object.assign(this[fOptions](), { explain }))
  }

  grant(v = null) {
    this[pGrant] = v
    return this
  }

  roles(...roles) {
    this[pRoles] = roles
    return this
  }

  limit() {
    throw new Error('script.error.pureVirtual')
  }

  map(fn) {
    const out = []
    for (const value of this) {
      out.push(fn(value))
    }
    return out
  }

  through(v) {
    this[pThrough] = v
    return this
  }

  maxTimeMS(v) {
    this[pMaxTimeMs] = clamp(v, script.config.query.minTimeMS, script.config.query.maxTimeMS)
    return this
  }

  skip() { throw new Error('Pure Virtual') }

  skipAcl(v = true) {
    this[pSkipAcl] = Boolean(v)
    return this
  }

  sort() { throw new Error('script.error.pureVirtual') }

  toArray() {
    const buffer = []
    for (const value of this) {
      buffer.push(value)
    }
    return buffer
  }

  toList() {
    return objects.list(this[pName], this[fOptions]())
  }

  locale(v) {
    this[pLocale] = v
    return this
  }

  transform(v) {
    this[pTransform] = v
    return this
  }

  [fOptions]() {
    return {
      maxTimeMS: this[pMaxTimeMs],
      engine: this[pEngine],
      skipAcl: this[pSkipAcl],
      grant: this[pGrant],
      roles: this[pRoles],
      crossOrg: this[pCrossOrg],
      accessLevel: this[pAccess],
      strict: this[pStrict],
      prefix: this[pPrefix],
      unindexed: this[pUnindexed],
      through: this[pThrough],
      locale: this[pLocale],
      transform: this[pTransform],
      expressionPipeline: this[pExpressionPipeline]
    }
  }

  getOptions() {
    return compact({
      operation: 'cursor',
      object: this[pName],
      ...this[fOptions]()
    }, Undefined, null)
  }

  get userOptions() {
    return ['maxTimeMS', 'crossOrg', 'engine', 'explain', 'locale', 'accessLevel', 'prefix']
  }

  get privilegedOptions() {
    return ['grant', 'roles', 'skipAcl', 'strict', 'unindexed', 'transform', 'expressionPipeline']
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

class QueryCursor extends Cursor {

  constructor(name, where) {
    super(name)
    this[pMatch] = where
  }

  count() {
    return objects.driver.count(this[pName], this.getOptions())
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

  passive(v = true) {
    this[pPassive] = Boolean(v)
    return this
  }

  limit(v) {
    this[pLimit] = v
    return this
  }

  skip(v) {
    this[pSkip] = v
    return this
  }

  sort(v) {
    this[pSort] = v
    return this
  }

  [fOptions]() {
    return Object.assign(super[fOptions](), {
      paths: this[pPaths],
      include: this[pInclude],
      expand: this[pExpand],
      passive: this[pPassive],
      where: this[pMatch],
      sort: this[pSort],
      skip: this[pSkip],
      limit: this[pLimit]
    })
  }

  get userOptions() {
    return super.userOptions.concat('paths', 'include', 'expand', 'passive', 'where', 'sort', 'skip', 'limit')
  }

  toUrl() {

    return [
      ['where', pMatch],
      ['paths', pPaths],
      ['include', pInclude],
      ['expand', pExpand],
      ['sort', pSort],
      ['skip', pSkip],
      ['limit', pLimit]
    ]
      .filter((v) => this[v[1]] !== null && this[v[1]] !== Undefined)
      .map((v) => {
        const value = this[v[1]]
        if (!Array.isArray(value) || value.length <= 1) {
          return `${v[0]}=${encodeURIComponent(JSON.stringify(this[v[1]]))}`
        }
        return value
          .filter((v1) => v1 !== null && v1 !== Undefined)
          .reduce((arr, v1) => [...arr, `${v[0]}[]=${encodeURIComponent(v1)}`], [])
          .join('&')
      })
      .join('&')

  }

  toJSON() {
    return JSON.stringify({
      where: this[pMatch],
      paths: this[pPaths],
      include: this[pInclude],
      expand: this[pExpand],
      sort: this[pSort],
      skip: this[pSkip],
      limit: this[pLimit]
    })
  }

  toString() {
    return this.toJSON()
  }

  pathRead(path, options) {

    options = options || {}

    return objects.driver.readOne(this[pName], {
      ...this[fOptions](),
      path,
      where: this[pMatch],
      throwNotFound: rBool(options.throwNotFound, true)
    })
  }

}

register('find', QueryCursor)

// ---------------------------------------------------------------

class AggregationCursor extends Cursor {

  constructor(name, pipeline) {
    super(name)
    this[pPipeline] = Array.isArray(pipeline) ? pipeline : []
  }

  pipeline(pipeline) {
    this[pPipeline] = Array.isArray(pipeline) ? pipeline : []
    return this
  }

  group(v) {
    return this[fAdd]('$group', v)
  }

  limit(v) {
    if (v === false || v === Undefined) {
      this[pLimit] = v
      return this
    }
    return this[fAdd]('$limit', v)
  }

  match(v) {
    return this[fAdd]('$match', v)
  }

  project(v) {
    return this[fAdd]('$project', v)
  }

  addFields(v) {
    return this[fAdd]('$addFields', v)
  }

  native(v) {
    this[pNativePipeline] = v
    return this
  }

  nativePipeline(v) {
    return this.native(v) // alias for setOptions
  }

  skip(v) {
    return this[fAdd]('$skip', v)
  }

  sort(v) {
    return this[fAdd]('$sort', v)
  }

  unwind(v) {
    return this[fAdd]('$unwind', v)
  }

  [fAdd](type = null, v) {
    this[pPipeline].push(type ? { [type]: v } : v)
    return this
  }

  [fOptions]() {
    return Object.assign(super[fOptions](), {
      limit: this[pLimit],
      pipeline: this[pPipeline],
      nativePipeline: this[pNativePipeline]
    })
  }

  get userOptions() {
    return super.userOptions.concat('pipeline', 'limit')
  }

  get privilegedOptions() {
    return super.privilegedOptions.concat('nativePipeline')
  }

  toUrl() {
    return `pipeline=${encodeURIComponent(JSON.stringify(this[pPipeline]))}`
  }

  toJSON() {
    return JSON.stringify(this[pPipeline])
  }

  toString() {
    return this.toJSON()
  }

}

register('aggregate', AggregationCursor)

export {
  QueryCursor,
  AggregationCursor
}
