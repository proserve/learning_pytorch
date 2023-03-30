'use strict'

const JavascripTranspiler = require('../sandbox/transpiler'),
      config = require('cortex-service/lib/config'),
      { isCustomName, resolveOptionsCallback, rString, array: toArray, promised, rBool } = require('../../utils'),
      modules = require('../../modules'),
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      semver = require('semver'),
      clone = require('clone'),
      { createHash } = require('crypto'),
      logger = require('cortex-service/lib/logger'),
      ServiceClient = require('cortex-service/lib/kube/service-client'),
      importRegex = /^[a-zA-Z0-9_\\-]{1,40}$/,
      lazy = require('cortex-service/lib/lazy-loader').from({
        // this cache should be big enough to store many of the adhoc scripts, like in-script transforms and adhoc script runners.
        cache: () => modules.cache.memory.add('service.transpiler.scripts')
      })

module.exports = class TranspilerServiceClient extends ServiceClient {

  constructor(options) {

    super('transpiler-service-client', options)

  }

  /**
     * @param source
     * @param options
     *  language: rString({javascript:'javascript'}, 'javascript'),
     *  ast: rBool(false),
     *  astParser
     *  comments: rBool(false),
     *  allowReturnOutsideFunction: rBool(true),
     *  filename: rString('String').substr(0, 1024),
     *  specification: rString({es5:'es5', es6:'es6'}, 'es6'),
     *  sourceType: rString({script:'script', module:'module'}, 'module')
     *
     * @param callback
     */
  transpile(source, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback, false, true)

    const promise = Promise.resolve(null)
      .then(async() => {

        options = JavascripTranspiler.normalizeOptions({ ...options, source })

        const astParser = _.isFunction(options.astParser) ? options.astParser : null,
              returnAst = rBool(options.ast, false),
              { language, specification, sourceType, retainLines } = options,
              // filename can vary, so cache without it. this does not affect stack traces.
              cacheKey = !returnAst && createHash('sha256').update(`${language}.${specification}.${sourceType}.${retainLines}.${source}`).digest('hex')

        // never cache ast. it's huge.
        let { err, transpiled } = (cacheKey && lazy.cache.get(cacheKey)) || {}

        if (!err && !transpiled) {

          if (config('services.transpiler.fallback_enabled') && config('services.transpiler.fallback_only')) {

            try {
              transpiled = await this.transpileLocal(options)
            } catch (e) {
              err = e
            }

          } else {

            let tryLocal = false

            try {
              transpiled = await this.transpileRemote(options)
            } catch (e) {
              err = e
            }

            // either fall back to local or force a local transpile for < supported version (1.0.4)
            try {
              if (err) {
                if (err.code !== 'kScriptCompilationError') {
                  if (!Fault.isFault(err)) { // some kind of remote service error?
                    if (config('services.transpiler.fallback_enabled')) {
                      tryLocal = true
                    } else {
                      err = Fault.from(err, false, true)
                    }
                  }
                }
              } else if (!transpiled || !semver.satisfies(String(transpiled.version), '>=1.0.4')) {
                // < 1.0.4 did not support integrated imports
                tryLocal = true
              }
            } catch (e) {
              tryLocal = true
            }

            if (tryLocal) {
              try {
                err = null
                transpiled = await this.transpileLocal(options)
              } catch (e) {
                err = e
              }
            }

          }

          if (err) {
            transpiled = null
          } else {

            const { source, ast, classes, imports, requires, accounts, scriptHash } = transpiled || {}

            transpiled = {
              source,
              scriptHash,
              ast,
              classes,
              imports: _.uniq([...toArray(imports), ...toArray(requires)]).filter(value => isCustomName(value) && importRegex.test(value)),
              serviceAccounts: _.uniq(toArray(accounts)).filter(value => isCustomName(value) && !(modules.validation.isEmail(value)))
            }
          }

          if (cacheKey) {

            // only cache script compilation errors.
            lazy.cache.set(
              cacheKey, {
                err: (err && err.errCode !== 'cortex.invalidArgument.scriptCompilation' ? err : null),
                transpiled
              })
          }

        }

        transpiled = clone(transpiled)

        if (err) {
          throw err
        }

        if (transpiled.ast && astParser) {
          await JavascripTranspiler.traverseAstTree(transpiled.ast.program, astParser)
        }

        return transpiled

      })

    if (callback) {
      promise
        .then(v => callback(null, v))
        .catch(e => callback(e))
    }

    return promise

  }

  async transpileRemote(options) {

    options = JavascripTranspiler.normalizeOptions(options)
    return promised(this, 'post', '/transpile', { json: true, body: options })

  }

  get javascriptTranspiler() {

    if (!this._javascriptTranspiler) {
      this._javascriptTranspiler = new JavascripTranspiler()
    }
    return this._javascriptTranspiler
  }

  async transpileLocal(options) {

    options = options || {}

    if (!config('services.transpiler.skip_fallback_warning')) {
      logger.warn('using fallback transpiler')
    }

    const language = rString(options.language, 'javascript').toLowerCase()

    switch (language) {

      case 'javascript':

        return promised(this.javascriptTranspiler, 'transpile', options)

      default:

        throw Fault.create('cortex.unsupportedOperation.unspecified', { path: 'script.language' })

    }
  }

}
