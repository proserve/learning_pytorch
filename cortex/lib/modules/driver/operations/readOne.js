const Factory = require('./factory'),
      { Operation, getBooleanOption } = require('./operation'),
      { isString } = require('underscore'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules'),
      {
        promised,
        clamp,
        rInt,
        rString,
        couldBeId,
        getIdOrNull,
        normalizeObjectPath,
        isPlainObject,
        digIntoResolved,
        pathParts
      } = require('../../../utils')

class ReadOneOperation extends Operation {

  constructor(driver, operationName = 'readOne', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const { principal, object } = this.driver,
          readOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { subject } = readOptions,
          { _id: subjectId } = subject || {}

    let inputPath = readOptions.path,
        inputMatch = readOptions.where,
        subjectMatch = null,
        propertyPath = null

    delete readOptions.path
    delete readOptions.where

    readOptions.allowNullSubject = true

    if (subject) {

      if (readOptions.lean === true) {
        return subjectId
      } else if (readOptions.lean === 'modified') {
        readOptions.paths = ['_id']
        readOptions.include = readOptions.modified
      }

      // dryRun would be coming from an insert or update operation.
      if (readOptions.dryRun) {
        readOptions.document = subject
      }

      subjectMatch = { _id: subjectId }
      propertyPath = inputPath

    } else {

      // if there is a path and the first part is an _id, allow _where_ to be used in a path search

      if (inputPath) {

        let [identifier, suffix] = pathParts(inputPath)
        if (couldBeId(identifier)) {
          subjectMatch = {
            _id: getIdOrNull(identifier)
          }
          propertyPath = suffix
        } else {
          propertyPath = inputPath
        }
        inputPath = null
      }

      if (inputMatch) {

        if (couldBeId(inputMatch)) {

          inputMatch = {
            _id: getIdOrNull(inputMatch)
          }

        } else if (isString(inputMatch)) {

          let matchObject = null
          try {
            const parsed = JSON.parse(inputMatch)
            if (isPlainObject(parsed)) {
              matchObject = parsed
            }
          } catch (err) {
            void err
          }

          if (matchObject) {

            inputMatch = matchObject

          } else {

            let [identifier, suffix] = pathParts(normalizeObjectPath(inputMatch).replace(/\//g, '.'))

            if (couldBeId(identifier)) {
              inputMatch = {
                _id: getIdOrNull(identifier)
              }
            } else if (object.uniqueKey) {
              inputMatch = {
                [object.uniqueKey]: identifier
              }
            }
            inputPath = suffix

          }

        }

        if (inputPath) {
          if (propertyPath) {
            throw Fault.create('cortex.invalidArgument.db', { reason: 'Conflicting path searches between path and where clauses.' })
          }
          propertyPath = inputPath
        }

        if (!isPlainObject(inputMatch)) {
          throw Fault.create('cortex.invalidArgument.db', { reason: 'Missing where clause.' })
        }

        if (subjectMatch) {
          readOptions.where = inputMatch
        } else {
          subjectMatch = inputMatch
        }

      }

    }

    if (propertyPath) {

      return new Promise((resolve, reject) => {

        /**
         * @temp @hack @todo
         * remove requirement for aclReadPath and ListProperty dependency on the request query arguments.
         * we should be converting all `paths, include, expand` into projections or some other system that passes
         * along pathed options like:
         *
         *  /c_ctxapi_205_parent?paths[]=c_a&paths[]=c_children.c_b&where={"c_a": "foo"}&c_children.where={"c_b": "bar"}
         *
         * here, we have a where option attached to a specific path that is not top level. there is currently no way to pass these
         * along without relying on the request object, which makes it hacky and brittle is we are reaching out to the top-level
         * global request. either
         * (a) turn the above into passive aggregations with expansions and projections.
         * (b) create an access context chain that can access these options at every level.
         */

        const holdover = 1

        if (holdover) {

          const {
                  grant, roles, skipAcl, paths, include, expand, // top-level options
                  passive, locale, throwNotFound, crossOrg, maxTimeMS, engine, explain, req, script // sharedOptions
                } = readOptions,
                pathOptions = {
                  grant,
                  roles,
                  skipAcl,
                  paths,
                  include,
                  expand,
                  passive,
                  locale,
                  throwNotFound,
                  crossOrg,
                  maxTimeMS,
                  engine,
                  explain,
                  req,
                  script,
                  where: subjectMatch,
                  allowNullSubject: true
                }

          object.aclReadPath(principal, null, propertyPath, pathOptions, function(err, result, ac) {
            if (err) {
              reject(err)
            } else if (!modules.storage.isPointer(result) || readOptions.returnPointers) {
              resolve(result)
            } else {
              modules.streams.getPointerUrl(ac, result, (err, result) => {
                if (err) {
                  reject(err)
                } else {
                  resolve(result)
                }
              })
            }

          })

        } else {

          const {
                  grant, roles, skipAcl, // top-level options
                  where, sort, paths, include, expand, pipeline, group, map, skip, limit, // singleOptions <-- for now rely on request.
                  passive, locale, throwNotFound, crossOrg, maxTimeMS, engine, explain, req, script // sharedOptions
                } = readOptions,
                singleOptions = {
                  where,
                  sort,
                  paths,
                  include,
                  expand,
                  pipeline,
                  passive,
                  group,
                  skip,
                  limit,
                  map,
                  locale,
                  throwNotFound,
                  crossOrg,
                  maxTimeMS,
                  engine,
                  explain,
                  req,
                  script
                },
                pathOptions = {
                  grant,
                  roles,
                  skipAcl,
                  passive,
                  locale,
                  throwNotFound,
                  crossOrg,
                  maxTimeMS,
                  engine,
                  explain,
                  req,
                  script,
                  where: subjectMatch,
                  allowNullSubject: true,
                  singlePath: propertyPath,
                  paths: [propertyPath],
                  singleOptions,
                  singleCursor: false,
                  singleCallback: null
                }

          object.aclReadOne(principal, null, pathOptions, function(err, result, ac) {
            if (!err) {
              result = digIntoResolved(result, propertyPath, false, false, true)
            }
            if (err) {
              reject(err)
            } else if (!modules.storage.isPointer(result) || readOptions.returnPointers) {
              resolve(result)
            } else {
              modules.streams.getPointerUrl(ac, result, (err, result) => {
                if (err) {
                  reject(err)
                } else {
                  resolve(result)
                }
              })
            }
          })
        }
      })
    }

    return promised(object, 'aclReadOne', principal, null, { ...readOptions, where: subjectMatch })

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const { principal } = this.driver,
          allowedOptions = this.getAllowedOptions(
            [
              'map', 'group', 'where', 'sort', 'path', 'paths', 'include', 'expand', 'pipeline', 'skip', 'limit',
              'passive', 'locale', 'throwNotFound', 'crossOrg',
              'maxTimeMS', 'explain', 'engine'
            ],
            ['grant', 'roles', 'skipAcl'],
            ['json', 'dryRun', 'modified', 'subject', 'lean', 'returnPointers', 'allowUnindexed'],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            [
              'locale', 'passive', 'lean', 'path', 'json', 'dryRun',
              'crossOrg', 'grant', 'roles', 'skipAcl'
            ],
            ['map', 'group', 'where', 'sort', 'paths', 'include', 'expand', 'modified', 'subject', 'pipeline', 'skip', 'limit']
          )

    outputOptions.throwNotFound = getBooleanOption(allowedOptions.throwNotFound, true)
    outputOptions.allowUnindexed = getBooleanOption(allowedOptions.allowUnindexed, false)

    outputOptions.parserExecOptions = {
      maxTimeMS: clamp(rInt(allowedOptions.maxTimeMS, config('query.defaultMaxTimeMS')), config('query.minTimeMS'), config('query.maxTimeMS')), // legacy default to max.
      explain: principal.isDeveloper() && getBooleanOption(allowedOptions.explain, false),
      engine: rString(allowedOptions.engine)
    }

    // some callers might want to have raw storage pointers returned
    outputOptions.returnPointers = getBooleanOption(allowedOptions.returnPointers, false)

    return outputOptions

  }

}

// _not_ registering as an externally callable driver operation.
Factory.register('readOne', ReadOneOperation)

module.exports = ReadOneOperation
