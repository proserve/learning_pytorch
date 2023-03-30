const Factory = require('./factory'),
      { Operation, getBooleanOption } = require('./operation'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      { AccessContext } = require('../../../acl'),
      { privatesAccessor: protectedAccessor } = require('../../../classes/privates'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        ScriptTransform: `${__dirname}/../../sandbox/script-transform`
      }),
      { expressions: { createPipeline, getRuntime } } = require('../../../modules'),
      {
        path: pathTo,
        promised,
        clamp,
        rInt,
        rString,
        getIdOrNull,
        normalizeObjectPath,
        OutputCursor,
        isCustomName,
        digIntoResolved,
        isSet,
        isUuidString,
        extend
      } = require('../../../utils')

let Undefined

async function executePipeline(driver, pipeline, input) {

  if (isCustomName(pipeline, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/)) {

    pipeline = await getRuntime(driver.org, pipeline, { type: 'pipeline' })
  }

  const ec = createPipeline(
    driver.createAccessContext(),
    pipeline
  )

  return ec.evaluate({ input })

}

class CursorOperation extends Operation {

  constructor(driver, operationName = 'cursor', options = {}) {
    super(driver, operationName, options)
  }

  /**
   * Opens a ContextCursor
   *
   * @param userOptions
   * @param privilegedOptions
   * @param internalOptions
   * @returns {Promise<*>}
   */
  async _execute(userOptions, privilegedOptions, internalOptions) {

    const cursorOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { principal, object, req, script } = this.driver

    // get a cursor to a buried list.
    if (cursorOptions.prefix) {

      return new Promise((resolve, reject) => {

        const parts = normalizeObjectPath(String(cursorOptions.prefix).replace(/\//g, '.')).split('.'),
              _id = getIdOrNull(parts[0]),
              path = parts.slice(1).join('.'),
              through = _.once(async(err, result) => {

                if (!err) {

                  if (cursorOptions.asList && pathTo(result, 'object') !== 'list') {
                    err = Fault.create('cortex.invalidArgument.query', { reason: 'list() with prefix must produce a list object.' })
                  } else if (!cursorOptions.asList && !(result instanceof OutputCursor)) {
                    err = Fault.create('cortex.invalidArgument.query', { reason: 'cursor() with prefix must produce a cursor.' })
                  }

                  if (cursorOptions.expressionPipeline) {
                    try {
                      result = await executePipeline(this.driver, cursorOptions.expressionPipeline, result)
                    } catch (e) {
                      err = e
                    }
                  }

                }

                try {

                  if (cursorOptions.transform) {
                    const transform = new lazy.ScriptTransform(new AccessContext(principal, null, {
                      object,
                      req,
                      script
                    }))
                    await transform.init(cursorOptions.transform)
                    protectedAccessor(this).sourceCursor = result instanceof OutputCursor && result
                    result = await transform.run(
                      err,
                      result,
                      {
                        runtimeArguments: {
                          cursorOptions: this.getExternalOptions(cursorOptions)
                        }
                      }
                    )
                  }
                } catch (e) {
                  err = e
                }

                err ? reject(err) : resolve(result)

              }),
              readOptions = {
                paths: [path],
                singlePath: path,
                singleCursor: !cursorOptions.asList,
                singleOptions: cursorOptions,
                singleCallback: through,
                passive: cursorOptions.passive,
                req,
                script,
                locale: cursorOptions.locale
              }

        if (!_id || !path) {
          if (object.uniqueKey && (isCustomName(parts[0], ['c_', 'o_']) || isUuidString(parts[0]))) {
            readOptions.allowNullSubject = true
            readOptions.where = { [object.uniqueKey]: parts[0] }
          } else {
            return reject(Fault.create('cortex.invalidArgument.query', { reason: 'Invalid path prefix for Cursor.open(). An _id and property are required.' }))
          }
        }

        object.aclReadOne(principal, _id, readOptions, function(err, result) {
          through(err, digIntoResolved(result, path, false, false, true)) // just in case it didn't get picked up.
        })

      })

    }

    // --------------------

    let err, result

    try {
      result = await promised(object, cursorOptions.asList ? 'aclList' : 'aclCursor', principal, cursorOptions)
    } catch (e) {
      err = e
    }

    if (!err && cursorOptions.expressionPipeline) {
      try {
        result = await executePipeline(this.driver, cursorOptions.expressionPipeline, result)
      } catch (e) {
        err = e
      }
    }

    if (cursorOptions.transform) {
      const transform = new lazy.ScriptTransform(new AccessContext(principal, null, { object, req, script }))
      await transform.init(cursorOptions.transform)
      protectedAccessor(this).sourceCursor = result instanceof OutputCursor && result
      result = await transform.run(
        err,
        result,
        {
          runtimeArguments: {
            cursorOptions: this.getExternalOptions(cursorOptions)
          }
        }
      )
    }

    if (err) {
      throw err
    }
    return result

  }

  getExternalOptions(inputOptions = {}) {

    const outputOptions = super.getExternalOptions(inputOptions),
          keys = Object.keys(inputOptions)

    for (const option of keys) {

      switch (option) {
        case 'paths':
        case 'include':
        case 'expand':
        case 'skip':
        case 'limit':
        case 'where':
        case 'map':
        case 'sort':
        case 'group':
        case 'pipeline':
        case 'prefix':
          if (isSet(inputOptions[option])) {
            outputOptions[option] = inputOptions[option]
          }
          break
        default:
      }
    }

    outputOptions.object = this.driver.object.objectName

    return outputOptions

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const { principal, req, script } = this.driver,
          { org } = principal,
          { configuration } = org,
          { queries: queryConfiguration } = configuration,
          allowedOptions = this.getAllowedOptions(
            [
              'favorites', 'maxTimeMS', 'crossOrg', 'engine', 'explain',
              'paths', 'include', 'expand', 'passive', 'locale',
              'accessLevel', 'startingAfter', 'endingBefore',
              'skip', 'limit', 'where', 'map', 'sort', 'group', 'pipeline',
              'prefix'
            ],
            ['grant', 'roles', 'skipAcl', 'strict', 'unindexed', 'nativePipeline', 'transform', 'expressionPipeline'],
            ['json', 'asList', 'total', 'allowUnindexed', 'internalWhere'],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            ['skipAcl', 'locale', 'passive', 'grant', 'roles', 'crossOrg', 'json', 'transform'],
            [
              'paths', 'include', 'expand', 'accessLevel', 'startingAfter', 'endingBefore', 'skip', 'limit',
              'where', 'map', 'sort', 'group', 'pipeline', 'prefix'
            ]
          )

    // user options ---------------------------------------

    if (isSet(allowedOptions.favorites)) {
      const favorites = getBooleanOption(allowedOptions.favorites, null)
      if (favorites === true) {
        pathTo(outputOptions, 'internalWhere', { 'favorites': principal._id })
      } else if (favorites === false) {
        pathTo(outputOptions, 'internalWhere', { 'favorites': { $ne: principal._id } })
      }
    }

    outputOptions.parserExecOptions = {
      maxTimeMS: clamp(rInt(allowedOptions.maxTimeMS, config('query.defaultMaxTimeMS')), config('query.minTimeMS'), config('query.maxTimeMS')),
      engine: rString(allowedOptions.engine)
    }

    if (allowedOptions.explain) {

      const { explain } = allowedOptions,
            isPrivileged = config('debug.allowCursorExplain') || principal.isSupportLogin || principal.isSysAdmin(),
            isAllowed = isPrivileged || principal.isDeveloper()

      if (!isAllowed) {
        throw Fault.create('cortex.accessDenied.unspecified', { reason: 'explain is not available.' })
      }
      outputOptions.parserExecOptions.explain = {
        query: getBooleanOption(pathTo(explain, 'query'), true) && isPrivileged,
        plan: getBooleanOption(pathTo(explain, 'plan'), true) && isPrivileged
      }

    }

    // allow limit to be false but default to contexts.default for backwards compatibility.
    // this only affects non-script, request based cursors.
    // scripts do not impose a default limit on cursors.
    if (!script && (config('runtime.streamLists') || isNdJSONRequest(req))) {

      if (allowedOptions.limit === Undefined) {
        outputOptions.limit = config('contexts.defaultLimit')
      } else if (getBooleanOption(outputOptions.limit) === false) {
        outputOptions.limit = false
      }
    }

    // privileged options ---------------------------------------

    outputOptions.strict = !(allowedOptions.strict === false && queryConfiguration.allowParserStrictOption)
    outputOptions.unindexed = allowedOptions.unindexed === true && queryConfiguration.allowUnidexedMatchesOption
    outputOptions.nativePipeline = queryConfiguration.enableNativePipelines && allowedOptions.nativePipeline
    outputOptions.expressionPipeline = allowedOptions.expressionPipeline

    // internal options ---------------------------------------

    outputOptions.allowUnindexed = getBooleanOption(allowedOptions.allowUnindexed, false)
    outputOptions.asList = outputOptions.parserExecOptions.explain ? true : getBooleanOption(allowedOptions.asList, false)
    outputOptions.total = outputOptions.asList && getBooleanOption(allowedOptions.total, false)
    outputOptions.internalWhere = extend(outputOptions.internalWhere, allowedOptions.internalWhere)

    return outputOptions

  }

}
Factory.register('cursor', CursorOperation)

function isNdJSONRequest(req) {

  return req && rString(req.header('accept'), '').indexOf('application/x-ndjson') === 0

}

module.exports = CursorOperation
