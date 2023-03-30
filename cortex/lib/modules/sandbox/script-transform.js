
const { isCustomName, couldBeId, promised, sleep, OutputCursor, isSet, toJSON, createId, rString, rBool, array: toArray, isPlainObject } = require('../../utils'),
      modulePrivates = require('../../classes/privates').createAccessor(),
      { doDuring, parallel } = require('async'),
      WritableOutputCursor = require('../../classes/writable-output-cursor'),
      Memo = require('../../classes/memo'),
      { db: { models }, sandbox, services: { transpiler } } = require('../../modules'),
      Fault = require('cortex-service/lib/fault'),
      { emptyId } = require('../../consts'),
      maxScriptSize = 1024 * 50,
      scriptPrefix = `const { transform } = require('decorators-transform'); module.exports = @transform`

class Handler {

  constructor(ac, script, memo, runtimeArguments = {}, contextApi = null) {

    Object.assign(modulePrivates(this), {
      ac,
      script,
      memo: Memo.from(memo),
      runtimeArguments,
      contextApi
    })

  }

  async handleError(err) {

    const privates = modulePrivates(this),
          { ac, script, runtimeArguments, memo } = privates,
          scriptOptions = {
            context: {
              _id: createId(),
              object: 'transform',
              ac: ac.toObject(),
              err: toJSON(err),
              kind: 'error'
            }
          }

    runtimeArguments.memo = memo.data

    await promised(sandbox, 'executeModel', ac, null, script, scriptOptions, runtimeArguments)

    throw err

  }

}

class ResultHandler extends Handler {

  async run(err, result) {

    if (err) {
      return this.handleError(err)
    }

    const privates = modulePrivates(this),
          { ac, script, runtimeArguments, memo, contextApi } = privates,
          scriptOptions = {
            context: {
              _id: createId(),
              object: 'transform',
              ac: ac.toObject(),
              kind: 'result'
            },
            api: {
              context: {
                ...(contextApi || {}),
                getResult: function(script, message, callback) {
                  callback(null, result)
                },
                setResult: function(script, message, value, callback) {
                  result = value
                  callback()
                }
              }
            }
          }

    runtimeArguments.memo = memo.data

    await promised(sandbox, 'executeModel', ac, null, script, scriptOptions, runtimeArguments)

    return result

  }

}

class CursorHandler extends Handler {

  async run(err, source) {

    if (err) {
      return this.handleError(err)
    }

    source.on('error', err => {
      void err
    })

    return new Promise((resolve) => {

      const sink = new WritableOutputCursor({ inputCursor: source }),
            privates = modulePrivates(this),
            { ac, script, runtimeArguments, memo, contextApi } = privates,
            api = {
              context: contextApi || {},
              runtime: {
                count: 0,
                position: 0,
                ended: false,
                ending: false,
                setEnded: function(script, message, callback) {
                  api.runtime.ended = true
                  callback()
                }
              },
              memo: memo.getScriptApi(),
              cursor: {

                toObject: function(script, message, cursorId, callback) {
                  callback(null, source.toJSON())
                },

                hasNext: function(script, message, cursorId, callback) {
                  source.hasNext(callback)
                },

                isClosed: function(script, message, cursorId, callback) {
                  callback(null, source.isClosed())
                },

                close: function(script, message, cursorId, callback) {
                  sink.close(() => {})
                  callback()
                },

                next: function(script, message, cursorId, callback) {
                  source.next((err, object) => {
                    if (!err) {
                      api.runtime.position += 1
                    }
                    callback(err, object)
                  })
                },

                fetch: function(script, message, cursorId, options, callback) {
                  source.fetch(options.count, (err, result) => {
                    if (!err && result && result.buffer) {
                      api.runtime.position += result.buffer.length
                    }
                    callback(err, result)
                  })
                },

                passthru: function(script, message, options, callback) {
                  source.fetch(options.count, (err, result) => {
                    let hasNext = false, count = 0
                    if (!err && result && result.buffer) {
                      hasNext = result.hasNext
                      count = result.buffer.length
                      api.runtime.position += count
                      if (!sink.isClosed()) {
                        sink.push(...result.buffer)
                      }
                    }
                    callback(err, { hasNext, count })
                  })
                },

                push: function(script, message, cursorId, objects, callback) {
                  let err
                  if (!sink.isClosed()) {
                    sink.push(...objects)
                  } else if (sink.aborted) {
                    err = Fault.create('cortex.error.aborted', { reason: 'Server closed the output stream.' })
                  }
                  callback(err)
                }
              }
            },
            scriptOptions = {
              context: {
                _id: createId(),
                object: 'transform',
                ac: ac.toObject(),
                kind: 'cursor'
              },
              api,
              closeAllResourcesOnExit: true // ensure the runtime can't return an open cursor or stream.
            },
            speedUp = ['hasNext', 'isClosed', 'next', 'fetch', 'passthru', 'push'],
            sinkClose = sink.close,
            sourceClose = source.close

      // optimize out the stats and trace for the calls that will happen frequently
      speedUp.forEach(fn => {
        api.cursor[fn].$trace = false
        api.cursor[fn].$stats = false
      })

      sink.memo = memo

      // ensure the transform script is no longer actually running before reporting either the sink or source as closed.
      let transformEnded = false

      sink.close = function(callback) {

        parallel([
          callback => source.close(callback),
          callback => {
            sinkClose.call(sink, async(err) => {
              while (1) {
                if (transformEnded) {
                  break
                }
                await sleep(10)
              }
              callback(err)
            })
          }
        ], callback)
      }

      source.close = function(callback) {
        sourceClose.call(source, async(err) => {
          while (1) {
            if (transformEnded) {
              break
            }
            await sleep(10)
          }
          callback(err)
        })
      }

      resolve(sink)

      doDuring(

        async() => {

          api.runtime.count += 1

          let isFirst = api.runtime.count === 1,
              isEnding = source.isClosed() || !(await promised(source, 'hasNext')),
              lastPosition = api.runtime.position

          api.runtime.ending = api.runtime.ending || isEnding

          await promised(sandbox, 'executeModel', ac, null, script, scriptOptions, runtimeArguments)

          if (isEnding) {

            // if the cursor was closed coming in, give the script one last chance to call afterAll.
            api.runtime.ending = true

          } else if (!isFirst && lastPosition === api.runtime.position && !api.runtime.ended) {

            // force the script to get at least 1 object from the input cursor or blame it.
            throw Fault.create('cortex.throttled.stalledCursor')

          }

        },

        async() => !api.runtime.ended,

        async(err) => {

          transformEnded = true

          if (err) {
            try {
              await this.handleError(err)
            } catch (e) {
              err = e
            }
          }

          if (!sink.isClosed()) {
            if (err) {
              try {
                await promised(sink, 'destroy', err)
              } catch (err) {
                void err
              }
            }
            try {
              sink.end(err)
            } catch (err) {
              void err
            }
          }

          if (!source.isClosed()) {
            try {
              await promised(source, 'close')
            } catch (err) {
              void err
            }
          }

        }
      )

    })

  }

}

class ScriptTransform {

  constructor(ac) {

    modulePrivates(this).ac = ac
  }

  /**
   * @param options
   *  script: string / id / export / model
   *  compiled: pre-compiled script
   *  required: pre-existing list
   *  label: 'Transform'
   *  autoPrefix: true,
   *  memo: An initial memo object to pass into the transform from either the last operation or the initial script.
   *  contextApi: custom script.context api
   * @returns {Promise<ScriptTransform>}
   */
  async init(options) {

    if (typeof options === 'string') {
      options = { script: options }
    } else if (!isSet(options)) {
      options = {}
    }

    let transformScript,
        compiled = rString(options.compiled),
        requires = toArray(options.requires, options.requires),
        scriptLabel = rString(options.label, 'Transform'),
        scriptBody = rString(options.script, '')

    const autoPrefix = rBool(options.autoPrefix, true),
          Script = models.getModelForType('script', 'library'),
          privates = modulePrivates(this),
          { ac } = privates,
          { org } = ac,
          isId = couldBeId(scriptBody),
          isCustom = !isId && isCustomName(scriptBody, 'c_', true, /^[a-zA-Z0-9-_]{0,}$/),
          isModel = !isId && !isCustom && options.constructor === Script // all transforms are either adhoc or run in a library.

    if (!org.configuration.scripting.scriptsEnabled) {
      throw Fault.create('cortex.scripts.disabled')
    }

    if (isModel) {

      transformScript = options

    } else if (isCustom) {

      const runtime = await ac.org.getRuntime(),
            transform = runtime.transforms.find(transform => transform.name === scriptBody)

      if (!transform) {
        throw Fault.create('cortex.notFound.script', { reason: 'Missing transform.', resource: `script#library.name(${transform})` })
      }
      transformScript = await sandbox.getRuntimeModel(ac.org, runtime, transform, { type: 'route' })

    } else {

      if (isId) {

        transformScript = await sandbox.requireScript(ac, scriptBody)

      } else {

        if (!compiled) {

          scriptBody = scriptBody.trim()

          if (scriptBody.length > maxScriptSize) {
            throw Fault.create('cortex.invalidArgument.maxScriptLength', { reason: `Your script exceeds the maximum length of ${maxScriptSize} by ${scriptBody.length - maxScriptSize}` })
          }
          if (autoPrefix) {
            const startWithClass = /^class\s?{/.test(scriptBody),
                  scriptResult = startWithClass ? scriptBody : `class { ${scriptBody} }`
            scriptBody = `${scriptPrefix} ${scriptResult}`
          }

          const transpileOptions = {
                  filename: 'Transform',
                  language: 'javascript',
                  specification: 'es6'
                },
                { source, imports } = await promised(transpiler, 'transpile', scriptBody, transpileOptions)

          compiled = source
          requires = imports

        }

        transformScript = new Script({
          _id: emptyId,
          org: org._id,
          object: 'script',
          active: true,
          script: scriptBody,
          compiled,
          requires
        })

      }

      transformScript.runtimeContext = {
        label: scriptLabel,
        type: 'transform',
        metadata: {
          runtime: true,
          adhoc: true, // adhoc
          scriptId: transformScript._id
        }
      }

    }

    privates.script = transformScript

    // initialize the memo here so handlers get its reference and executors can reach it.
    if (Memo.isMemoLike(options.memo)) {
      privates.memo = Memo.from(options.memo)
    }

    if (isPlainObject(options.contextApi)) {
      privates.contextApi = options.contextApi
    }

    return this

  }

  async run(err, result, { runtimeArguments = {} } = {}) {

    const privates = modulePrivates(this),
          { ac, script, memo, contextApi } = privates,
          isCursor = result instanceof OutputCursor,
          Handler = isCursor ? CursorHandler : ResultHandler

    if (!script.active || !await sandbox.fulfillsConditions(ac, script.runtimeContext || script, { parentScript: script, runtimeArguments: { ...runtimeArguments, memo: Memo.to(memo) } })) {
      if (err) {
        throw err
      }
      return result
    }

    return new Handler(ac, script, memo, runtimeArguments, contextApi).run(err, result)
  }

}

module.exports = ScriptTransform
