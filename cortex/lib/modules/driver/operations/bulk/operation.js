'use strict'

const Factory = require('../factory'),
      { Operation, getBooleanOption } = require('../operation'),
      OperationResult = require('./result'),
      WritableOutputCursor = require('../../../../classes/writable-output-cursor'),
      Memo = require('../../../../classes/memo'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      _ = require('underscore'),
      {
        array: toArray,
        path: pathTo,
        promised,
        rString,
        isSet,
        OutputCursor,
        toJSON,
        isInt,
        rBool,
        isCustomName,
        isUuidString
      } = require('../../../../utils'),
      { privatesAccessor: protectedAccessor, createAccessor } = require('../../../../classes/privates'),
      modulePrivates = createAccessor(),
      { db } = modules,
      lazy = require('cortex-service/lib/lazy-loader').from({
        Driver: `${__dirname}/../../driver`,
        ScriptTransform: `${__dirname}/../../../sandbox/script-transform`,
        WorkerLock: () => db.models.WorkerLock
      }),
      maxDepth = 3,
      { Transactions: { Signals, SignalsLookup } } = require('../../../../consts')

let Undefined

class OperationWrapper extends Operation {

  constructor(bulkOp, operationName, parentOp, index = 0, memo = {}) {

    super(bulkOp.driver, operationName, { parent: bulkOp })

    Object.assign(modulePrivates(this), {
      parentOp,
      name: '',
      operationName: rString(operationName),
      index,
      memo
    })

  }

  get path() {

    const { parentOp, index, name, operationName } = modulePrivates(this)
    let { path } = modulePrivates(this)
    if (!path) {
      path = parentOp?.path ? `${parentOp.path}.${name || operationName}` : `${name || operationName}`
      path = `${path}[${index}]`
      modulePrivates(this).path = path
    }
    return path

  }

  get memo() {

    return modulePrivates(this).memo

  }

  get operation() {

    return modulePrivates(this).operation

  }

  _waitStop(callback) {

    const { operation } = modulePrivates(this)

    if (!operation) {
      super._waitStop(callback)
    } else if (this.cancelled) {
      operation.cancel(this.err, () => {
        super._waitStop(callback)
      })
    } else {
      operation.stop(() => {
        super._waitStop(callback)
      })
    }

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const allowedOptions = this.getAllowedOptions(
            [
              'operation', // the operation (insertMany, bulk, etc.)
              'object', // use a new object,
              'name' // a custom name for wrapping
            ],
            ['as'], // {account, safe, principal, acl, modules}
            [
              'privileged', // also pass the user options as privileged options.
              'cursor',
              'wrap',
              'halt',
              'depth',
              'memo'
            ],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            [],
            ['name', 'operation', 'object', 'cursor', 'wrap', 'depth', 'memo']
          )

    outputOptions.wrap = getBooleanOption((userOptions || {}).wrap, rBool(allowedOptions.wrap, true))
    outputOptions.halt = getBooleanOption((userOptions || {}).halt, rBool(allowedOptions.halt, true))
    outputOptions.output = getBooleanOption((userOptions || {}).output, rBool(allowedOptions.output, true))
    outputOptions.privileged = getBooleanOption(allowedOptions.privileged, false)

    if (isSet(allowedOptions.as)) {
      outputOptions.as = _.isString(allowedOptions.as)
        ? { id: allowedOptions.as }
        : _.pick(allowedOptions.as, 'id', 'safe', 'principal', 'acl', 'modules')
    }

    return outputOptions

  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    let err, index = 0, asPrincipal

    const wrapperOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { driver } = this,
          { principal, script, req, object } = driver,
          { org } = principal,
          { cursor,
            wrap,
            depth,
            privileged,
            halt,
            output,
            operation: operationName,
            name: customName,
            object: objectName
          } = wrapperOptions,
          writeResult = async data => {
            if (!(data instanceof OperationResult)) {
              data = new OperationResult(
                data,
                wrap,
                output,
                `${this.path}[${index++}]`
              )
            }
            return cursor.push(data)
          },
          writeErr = async err => {
            if (halt) {
              throw err
            }
            return writeResult(toJSON(Fault.from(err, false, true)))
          }

    modulePrivates(this).name = rString(customName)
    modulePrivates(this).operationName = rString(operationName)

    if (depth > maxDepth) {
      err = Fault.create('cortex.invalidArgument.operationBulkDepthExceeded', { path: this.path })
    } else if (!Factory.get(operationName)) {
      err = Fault.create('cortex.invalidArgument.unsupportedBulkOperation', { path: this.path })
    }

    // try catch block for pushPrincipal so we guarantee popPrincipal later on.
    if (!err) {
      try {
        const { as } = wrapperOptions,
              { id } = as || {}

        if (script && as) {
          asPrincipal = await promised(script, 'pushPrincipal', id, as)
        }
      } catch (e) {
        err = e
      }
    }

    // set the memo to be the previous one, unless a new one is passed in on a transform.
    if (privilegedOptions && privilegedOptions.transform && privilegedOptions.transform.memo) {
      modulePrivates(this).memo = Memo.from(privilegedOptions.transform.memo)
    } else if (wrapperOptions.memo) {
      modulePrivates(this).memo = Memo.from(wrapperOptions.memo)
    }

    // add the memo to the transform, if applicable, to ensure it's propagated.
    if (privilegedOptions && privilegedOptions.transform && privilegedOptions.transform.memo !== modulePrivates(this).memo) {
      privilegedOptions.transform = this.normalizeTransform(privilegedOptions.transform)
      privilegedOptions.transform.memo = Memo.from(modulePrivates(this).memo)
    }

    if (!err) {

      let operationResult

      try {

        const executionPrincipal = asPrincipal || principal,
              executionObject = objectName ? await promised(org, 'createObject', objectName) : object,
              executionDriver = (objectName || asPrincipal)
                ? new lazy.Driver(executionPrincipal, executionObject, { req, script })
                : driver,
              { operation, result } = await executionDriver.executeOperation(operationName, userOptions, privilegedOptions, { privileged, depth, wrap, output, halt, parent: this })

        operationResult = result

        modulePrivates(this).operation = operation

        if (result instanceof OutputCursor) {

          result.on('error', e => {
            err = e
          })

          while (await promised(result, 'hasNext') && !cursor.isClosed()) {
            await writeResult(await promised(result, 'next'))
            if (err) {
              break
            }
          }

        } else {
          await writeResult(result)
        }

      } catch (e) {

        err = e

      } finally {

        // make sure to undo script principal
        if (asPrincipal) {
          script.popPrincipal()
        }

      }

      if (operationResult instanceof WritableOutputCursor) {
        modulePrivates(this).memo = Memo.from(operationResult.memo)
      }

    }

    if (err) {
      await writeErr(err)
    }

  }

}

/**
 * Bulk Operation
 */
class BulkOperation extends Operation {

  constructor(driver, operationName = 'bulk', options = {}) {

    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    if (Array.isArray(userOptions)) {
      userOptions = { ops: userOptions }
    }

    const privates = modulePrivates(this),
          bulkOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { depth } = bulkOptions,
          { ops } = userOptions || {}

    privates.operations = toArray(ops, ops)
    privates.ac = this.driver.createAccessContext()
    privates.bulkOptions = bulkOptions
    privates.inputCursor = new WritableOutputCursor({ writeTransform: depth === 1 ? toJSON : null }) // convert at the top-level

    let inputCursor = privates.inputCursor,
        outputCursor = inputCursor,
        triedLock = false,
        gotLock = false,
        { ac } = privates,
        { lock: lockOptions } = bulkOptions.async || {}

    if (bulkOptions.async) {
      if (depth !== 1) {
        throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Nested bulk operations do not support async operation.' })
      } else {
        privates.asyncOptions = bulkOptions.async
      }
    }

    // if there is a lock, acquire if before any operations run.
    if (lockOptions) {

      triedLock = true

      const { name, instance } = await acquireLock(ac, lockOptions)
      privates.lock = {
        name,
        instance
      }

      gotLock = !!instance

      if (instance) {

        // trap signals for lock instance.

        privates.lock.handler = async(lock, signal) => {

          let err = Fault.from(instance.getLastError())

          if (signal === Signals.Restart) {
            privates.restart = true
            try {
              const { currentOperation } = privates
              if (currentOperation) {
                await promised(currentOperation, 'stop')
              }
            } catch (err) {
              void err
            }
          } else {
            try {
              if (err) {
                await promised(this, 'cancel', err)
              } else {
                await promised(this, 'stop')
              }
            } catch (err) {
              void err
            }
          }

          // call signal script asynchronously (informational only)
          if (lockOptions.onSignal) {
            try {
              runScript(
                this,
                lockOptions.onSignal,
                {
                  signal: rString(SignalsLookup[signal], String(signal)).toLowerCase(),
                  err: toJSON(err),
                  operation: this.export()
                }
              )
            } catch (err) {
              void err
            }
          }
        }

        instance.on('signal', privates.lock.handler)

      } else {

        privates.asyncOptions = null // will not be called.

      }

    }

    if (bulkOptions.transform && (!triedLock || gotLock)) {

      if (depth !== 1) {

        throw Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'Nested bulk operations do not support transforms.' })

      } else {

        const transform = new lazy.ScriptTransform(this.driver.createAccessContext())
        await transform.init(bulkOptions.transform)
        protectedAccessor(this).sourceCursor = inputCursor instanceof OutputCursor && inputCursor
        outputCursor = await transform.run(
          null,
          inputCursor,
          {
            runtimeArguments: {
              cursorOptions: this.getExternalOptions(bulkOptions)
            }
          }
        )

      }

    }

    return outputCursor

  }

  _waitStop(callback) {

    Promise.resolve(null)
      .then(async() => {

        try {
          const { currentOperation } = modulePrivates(this)
          if (currentOperation) {
            if (this.cancelled) {
              await promised(currentOperation, 'cancel', this.err)
            } else {
              await promised(currentOperation, 'stop', this.err)
            }
          }
        } catch (err) {
          void err
        }

        try {
          await this._releaseResources(this.err)
        } catch (err) {
          void err
        }

        super._waitStop(callback)

      })
  }

  /**
   *
   * @nothrow
   * @param err
   * @returns {Promise<void>}
   * @private
   */
  async _releaseResources(err) {

    const { lock: { instance, handler } = {}, asyncOptions: { onComplete } } = modulePrivates(this)

    // if there is a lock, release it.
    if (instance && handler) {
      instance.removeListener('signal', handler)
      try {
        await releaseLock(instance)
      } catch (err) {
        void err
      }
    }

    if (onComplete) {

      modulePrivates(this).asyncOptions.onComplete = null

      // merge memos from top output cursor and operations
      const { cursor: outputCursor } = protectedAccessor(this),
            memo = Memo.from(Object.assign({}, pathTo(outputCursor, 'memo.data'), pathTo(this.operationsMemo, 'data')))

      try {
        await runScript(
          this,
          onComplete,
          {
            err: toJSON(err),
            operation: this.export(),
            memo // send it as plain object
          }
        )
      } catch (err) {
        modules.db.models.Log.logApiErr(
          'script',
          Fault.from(err, null, true),
          this.driver.createAccessContext()
        )

      }

    }

  }

  async _afterExecute(outputCursor) {

    let outputResult
    const privates = modulePrivates(this),
          { asyncOptions, lock = {} } = privates,
          didNotLockOrAcquiredLock = !lock.name || lock.instance,
          exhaust = () => {
            outputCursor.next((err, value) => {
              if (err) {
                this._releaseResources(err)
                  .catch(err => {
                    void err
                  })
              } else if (value !== Undefined) {
                setImmediate(exhaust)
              }
            })
          },
          outputExport = () => {
            const cursor = new WritableOutputCursor()
            cursor.push(this.export())
            cursor.end()
            return cursor
          }

    if (lock.name && !lock.instance) {

      // if locked elsewhere, restarted the operation elsewhere.
      outputResult = super._afterExecute(outputExport())

    } else if (!asyncOptions) {

      // if not async, return the cursor as is.
      outputResult = super._afterExecute(outputCursor)

    } else {

      // headless operation, detach from parent.
      this.detach()
      privates.async = true
      protectedAccessor(this).cursor = outputCursor

      outputCursor.on('error', (err) => {
        this.cancel(err, () => {})
      })
      outputCursor.on('close', () => {
        this.stop(() => {})
      })
      outputCursor.on('exhausted', () => {
        this.stop(() => {})
      })

      outputResult = outputExport()

      // exhaust the cursor
      setImmediate(exhaust)

    }

    // run operations
    setImmediate(async() => {

      const { operations, inputCursor, bulkOptions: { privileged, wrap, halt, depth, parent, transform } } = privates

      let err

      if (didNotLockOrAcquiredLock) {

        if (operations.length) {
          let memo = Memo.from(transform ? transform.memo : {})
          try {
            for (let index = 0; index < operations.length; index += 1) {

              if (operations[index].transform) {
                const opMemo = Memo.from(operations[index].transform.memo)
                memo = Memo.from(Object.assign({}, memo.data, opMemo.data))
              }

              const userOptions = operations[index],
                    privilegedOptions = privileged ? userOptions : {}, // if the run is privileged, pass along the privileged options.
                    internalOptions = {
                      privileged,
                      cursor: inputCursor,
                      wrap,
                      halt,
                      depth
                    },
                    wrapper = new OperationWrapper(this, pathTo(userOptions, 'operation'), parent, index, memo)

              privates.currentOperation = wrapper

              await wrapper.execute(userOptions, privilegedOptions, internalOptions)

              memo = Memo.from(Object.assign({}, memo.data, wrapper.memo.data))

              // is state has changed, don't process any more operations.
              if (!this.isStarted) {
                break
              }

              if (privates.restart) {
                privates.restart = false
                index = -1
              }

            }

            privates.currentOperation = null

          } catch (e) {
            err = e
          }
          privates.operationsMemo = memo

        }

        try {
          if (err) {
            this.cancel(err)
            inputCursor.end(err)
            // inputCursor.destroy(err, () => {})
          } else {
            inputCursor.end()
          }
        } catch (err) {
          void err
        }

      }

    })

    return outputResult

  }

  get activeCursor() {
    const { cursor } = protectedAccessor(this)
    return (cursor instanceof OutputCursor && !cursor.isClosed()) ? cursor : null
  }

  get lock() {
    return modulePrivates(this).lock
  }

  get operationsMemo() {

    return modulePrivates(this).operationsMemo

  }

  getExternalOptions(inputOptions = {}) {

    const outputOptions = super.getExternalOptions(inputOptions),
          keys = Object.keys(inputOptions)

    for (const option of keys) {

      switch (option) {
        case 'privileged':
        case 'depth':
        case 'wrap':
        case 'halt':
        case 'output':
          if (isSet(inputOptions[option])) {
            outputOptions[option] = inputOptions[option]
          }
          break
        default:
      }
    }

    return outputOptions

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const allowedOptions = this.getAllowedOptions(
            [],
            ['transform', 'async'],
            ['privileged', 'depth', 'wrap', 'halt', 'output', 'parent'], // wrap/halt is allowed in user input but used internally to set a default.
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            ['transform', 'async']
          )

    // use the parent's wrap value by default
    outputOptions.privileged = getBooleanOption(allowedOptions.privileged, false)
    outputOptions.wrap = getBooleanOption((userOptions || {}).wrap, rBool(allowedOptions.wrap, true))
    outputOptions.halt = getBooleanOption((userOptions || {}).halt, rBool(allowedOptions.halt, true))
    outputOptions.output = getBooleanOption((userOptions || {}).output, rBool(allowedOptions.output, true))
    outputOptions.depth = isInt(allowedOptions.depth) ? allowedOptions.depth + 1 : 1
    outputOptions.parent = allowedOptions.parent

    return outputOptions

  }

  _getInsertDocument() {
    return {
      ...super._getInsertDocument(),
      ...this._getDocument()
    }
  }

  _getDocument() {

    const { lock, async } = modulePrivates(this),
          { name, instance, signal } = lock || {},
          { _id } = instance || {}

    return {
      async: !!async,
      lock: { name, _id, signal }
    }
  }

  export() {
    return {
      ...super.export(),
      ...this._getDocument()
    }

  }

}
Factory.register('bulk', BulkOperation)

module.exports = BulkOperation

function getIdentifier(ac, identifier) {
  if (!(isCustomName(identifier) || isUuidString(identifier)) || identifier.length > 100) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Lock identifiers must be namespaced or uuid strings <= 100 characters in length.' })
  }
  return `env.operation.bulk.${ac.org.code}.${identifier}`
}

/**
 * Acquire a lock. throws if the lock cannot be acquired. if restart is true
 *
 * @param ac {AccessContext}
 * @param lockOptions
 *  restart {Boolean:false} If true, cancels the other operation before acquiring another lock on this one. If multiple
 *  lock are competing, an error will be throw.
 *  name
 */
async function acquireLock(ac, lockOptions = {}) {

  const restart = rBool(lockOptions.restart, false),
        name = rString(lockOptions.name, '')

  let instance

  if (restart) {
    instance = await promised(lazy.WorkerLock, 'createOrSignalRestart', getIdentifier(ac, name), { timeoutMs: 30000 })
  } else {
    instance = await promised(lazy.WorkerLock, 'acquire', getIdentifier(ac, name), { timeoutMs: 30000 })
  }

  return {
    name,
    instance
  }

}

async function releaseLock(instance) {

  try {
    await promised(instance, 'complete')
  } catch (err) {
    void err
  }

}

async function runScript(operation, script, runtimeArguments) {

  const { ac } = modulePrivates(operation)

  return promised(
    null,
    modules.sandbox.sandboxed(
      ac,
      script,
      {
        skipTranspile: false,
        compilerOptions: {
          label: operation.uuid,
          type: 'operation',
          language: 'javascript',
          specification: 'es6'
        },
        scriptId: operation._id
      },
      runtimeArguments
    )
  )
}
