const { privatesAccessor } = require('../../../classes/privates'),
      _ = require('underscore'),
      { v4 } = require('uuid'),
      acl = require('../../../acl'),
      config = require('cortex-service/lib/config'),
      Memo = require('../../../classes/memo'),
      {
        OutputCursor,
        normalizeObjectPath,
        stringToBoolean,
        isSet,
        isCustomName,
        array: toArray,
        equalIds,
        couldBeId,
        isId,
        rString,
        rBool,
        sleep,
        promised
      } = require('../../../utils'),
      { runtime: { operations: { RuntimeOperation } } } = require('../../../modules')

let Undefined

class Operation extends RuntimeOperation {

  constructor(driver, operationName, options) {

    super(
      driver.org,
      `db.${operationName}`,
      {
        // parent: pathTo(driver.req, 'operation'), don't assume parentage.
        ...options
      }
    )

    Object.assign(privatesAccessor(this), {
      driver,
      operationName,
      executing: false
    })

  }

  get driver() {
    return privatesAccessor(this).driver
  }

  get operationName() {
    return privatesAccessor(this).operationName
  }

  export() {

    return {
      ...super.export(),
      dbOptions: privatesAccessor(this).dbOptions || {}
    }

  }

  async execute(userOptions, privilegedOptions, internalOptions) {

    return new Promise((resolve, reject) => {

      privatesAccessor(this).dbOptions = this.getExternalOptions(this.getOptions(userOptions, userOptions))

      this.start(err => {

        if (err) {

          reject(err)

        } else {

          privatesAccessor(this).executing = true

          this._execute(userOptions, privilegedOptions, internalOptions)
            .then(async result =>
              resolve(await this._afterExecute(result))
            )
            .catch(err => {
              privatesAccessor(this).executing = false
              this.stop(() => {
                reject(err)
              })

            })

        }

      })

    })

  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    void { this: this, userOptions, privilegedOptions, internalOptions }
    return Undefined

  }

  _waitStop(callback) {

    Promise
      .resolve(null)
      .then(async() => {

        const privates = privatesAccessor(this),
              interval = 250

        if (privates.cursor || privates.sourceCursor) {
          privates.cursor && await promised(privates.cursor, this.cancelled ? 'abort' : 'close')
          privates.sourceCursor && await promised(privates.sourceCursor, this.cancelled ? 'abort' : 'close')
          privates.executing = false
          privates.cursor = null
          privates.sourceCursor = null
        }

        while (privates.executing) {
          await sleep(interval)
        }

        super._waitStop(callback)

      })

  }

  async _afterExecute(result) {

    if (result instanceof OutputCursor) {

      privatesAccessor(this).cursor = result

      result.on('error', (err) => {
        this.cancel(err, () => {})
      })
      result.on('close', () => {
        this.stop(() => {})
      })
      result.on('exhausted', () => {
        this.stop(() => {})
      })

      return result

    } else {

      privatesAccessor(this).executing = false
      return new Promise(resolve => {
        this.stop(() => {
          resolve(result)
        })
      })
    }
  }

  normalizeRoles(input) {

    const { principal } = this.driver,
          { org } = principal,
          { roles } = org

    return toArray(input).reduce((memo, role) => {
      const r = roles.find(valid => valid.code === role || equalIds(valid._id, role))
      if (r) {
        memo.push(r._id)
      }
      return memo
    }, [])

  }

  normalizeTransform(input) {

    let transform = Undefined

    if (isSet(input)) {
      if (typeof input === 'string' || isId(input)) {
        transform = { script: input.toString(), autoPrefix: true }
      } else {
        transform = {
          script: rString(input.script, ''),
          autoPrefix: rBool(input.autoPrefix, false)
        }
        let memo = input.memo
        if (Memo.isMemoLike(memo)) {
          transform.memo = Memo.from(memo)
        }
      }
    }

    return transform
  }

  normalizeAsync(input) {

    let async = Undefined

    if (isSet(input)) {
      let isAsync = getBooleanOption(input, null)
      if (isAsync !== false) {
        if (isAsync === true) {
          input = {}
        }
        async = {
          lock: input.lock ? {
            name: rString(input.lock.name, v4()),
            restart: rBool(input.lock.restart, false),
            onSignal: rString(input.lock.onSignal)
          } : null,
          target: input.target ? {
            name: rString(input.target.name, null)
          } : null,
          onComplete: rString(input.onComplete)
        }
      }
    }

    return async

  }

  computeMatchAndPathOptions(match = null, userOptions = {}, defaultMatch = {}) {

    const { script } = privatesAccessor(this),
          allowedOptions = getAllowedOptions(script, userOptions, ['path'])

    let path = allowedOptions.path

    if (!isSet(match)) {
      match = defaultMatch
    }

    if (_.isString(match) && !couldBeId(match)) {
      const parts = normalizeObjectPath(String(match).replace(/\//g, '.')).split('.')
      match = { _id: parts[0] }
      path = parts.slice(1).join('.')
    } else if (isSet(path)) {
      path = normalizeObjectPath(String(path).replace(/\//g, '.'))
    }

    return { match, path }

  }

  /**
   * If the driver principal is privileged, user options are merged into privileged options.
   *
   * @param userPool
   * @param privilegedPool
   * @param internalPool
   * @param userOptions
   * @param privilegedOptions
   * @param internalOptions
   * @returns {*}
   */
  getAllowedOptions(userPool = [], privilegedPool = [], internalPool = [], userOptions = {}, privilegedOptions = {}, internalOptions = {}) {

    const { driver: { script, principal: { isPrivileged } } } = this

    return {
      ...getAllowedOptions(script, userOptions, userPool),
      ...getAllowedOptions(script, isPrivileged ? { ...userOptions, ...privilegedOptions } : privilegedOptions, privilegedPool),
      ...getAllowedOptions(null, internalOptions, internalPool)
    }

  }

  getExternalOptions(inputOptions = {}) {

    const outputOptions = {},
          keys = Object.keys(inputOptions)

    for (const option of keys) {
      switch (option) {
        case 'locale':
        case 'passive':
        case 'lean':
        case 'path':
        case 'dryRun':
        case 'skipAcl':
        case 'grant':
        case 'roles':
        case 'bypassCreateAcl':
        case 'isUnmanaged':
        case 'disableTriggers':
          if (isSet(inputOptions[option])) {
            outputOptions[option] = inputOptions[option]
          }
          break
        default:
      }
    }
    return outputOptions

  }

  getOutputOptions(allowedOptions = {}, managed = [], copy = [], { strict = true, extern = false, compact = false } = {}) {

    const { driver: { req, script, object, principal } } = this,

          outputOptions = {
            req,
            script,
            ...(_.pick(allowedOptions, ...copy))
          }

    for (const option of managed) {

      switch (option) {

        case 'locale':
          outputOptions.locale = allowedOptions.locale || (script && script.fixedLocale) || (req && req.fixedLocale)
          break

        case 'passive':
          outputOptions.passive = getBooleanOption(allowedOptions.passive, false)
          break

        case 'lean':
          outputOptions.lean = allowedOptions.lean === 'modified' ? 'modified' : getBooleanOption(allowedOptions.lean, false)
          break

        case 'path':

          if (isSet(allowedOptions.path)) {
            outputOptions.path = normalizeObjectPath(String(allowedOptions.path).replace(/\//g, '.'))
          }
          break

        case 'json':
          outputOptions.json = getBooleanOption(allowedOptions.json, true)
          break

        case 'dryRun':
          outputOptions.dryRun = getBooleanOption(allowedOptions.dryRun, false)
          break

        case 'skipAcl':
          outputOptions.skipAcl = getBooleanOption(allowedOptions.skipAcl, false)
          break

        case 'mergeDocuments':
          outputOptions.mergeDocuments = getBooleanOption(allowedOptions.mergeDocuments, false)
          break

        case 'grant':
          if (isSet(allowedOptions.grant)) {
            outputOptions.grant = Math.min(acl.fixAllowLevel(allowedOptions.grant, true), acl.AccessLevels.Script)
          }
          break

        case 'roles':
          if (isSet(allowedOptions.roles)) {
            outputOptions.roles = this.normalizeRoles(allowedOptions.roles)
          }
          break

        case 'bypassCreateAcl':
          if (isSet(allowedOptions.bypassCreateAcl) && (isCustomName(object.objectName) || isCustomName(object.objectName, 'o_', false) || object.allowBypassCreateAcl)) {
            outputOptions.bypassCreateAcl = getBooleanOption(allowedOptions.bypassCreateAcl, false)
          }
          break

        case 'isUnmanaged':
          if (isSet(allowedOptions.isUnmanaged) && (isCustomName(object.objectName) || isCustomName(object.objectName, 'o_', false))) {
            outputOptions.isUnmanaged = getBooleanOption(allowedOptions.isUnmanaged, false)
          }
          break

        case 'disableTriggers':
          if (isSet(allowedOptions.disableTriggers) && (isCustomName(object.objectName) || isCustomName(object.objectName, 'o_', false))) {
            outputOptions.disableTriggers = getBooleanOption(allowedOptions.disableTriggers, false)
          }
          break

        case 'crossOrg':
          if (isSet(allowedOptions.crossOrg)) {
            if (
              getBooleanOption(allowedOptions.crossOrg, false) &&
              principal.isSysAdmin() &&
              config('contexts.crossOrgQueryable').includes(object.objectName)
            ) {
              outputOptions.crossOrg = true
            }
          }
          break

        case 'transform': {
          const transform = this.normalizeTransform(allowedOptions.transform)
          if (transform) {
            outputOptions.transform = transform
          }
          break
        }

        case 'async': {
          const async = this.normalizeAsync(allowedOptions.async)
          if (async) {
            outputOptions.async = async
          }
          break
        }

        default:

          throw new RangeError(`unrecognized managed driver option: ${option}`)

      }

    }

    return outputOptions

  }

}

function getAllowedOptions(script, inputOptions, optionsPool) {

  return script
    ? script.allowedOptions(inputOptions, ...optionsPool)
    : _.pick(inputOptions, ...optionsPool)

}

function getBooleanOption(value, defaultValue = null) {

  if (_.isBoolean(value)) {
    return value
  }
  return stringToBoolean(value, defaultValue)

}

function updateToPathOperations(doc) {
  return Object.keys(doc || {}).reduce((ops, key) => {
    switch (key) {
      case '$set':
        ops.push({
          op: 'set',
          value: doc[key]
        })
        break
      case '$push':
        ops.push({
          op: 'push',
          value: doc[key]
        })
        break
      case '$unset':
        ops.push({
          op: 'unset',
          value: doc[key]
        })
        break
      case '$pull':
        ops.push({
          op: 'pull',
          value: doc[key]
        })
        break
      case '$remove':
        ops.push({
          op: 'remove',
          value: doc[key]
        })
        break
    }
    return ops
  }, [])
}

module.exports = {

  Operation,
  getBooleanOption,
  updateToPathOperations

}
