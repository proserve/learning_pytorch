'use strict'

const config = require('cortex-service/lib/config'),
      { randomInt, resolveOptionsCallback, array: toArray, rBool, nullFunc, rVal, pathParts, path: pathTo, equalIds, serializeObject, deserializeObject, roughSizeOfObject } = require('../../utils'),
      consts = require('../../consts'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      modules = require('../../modules'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      { MemoryCache } = require('cortex-service/lib/memory-cache'),
      ClusterServiceClient = require('cortex-service/lib/kube/cluster-service-client'),
      writableConfigItems = ['runtime.*'].map(v => v.toLowerCase().trim().split('.')),
      readableConfigItems = ['runtime', 'runtime.*'].map(v => v.toLowerCase().trim().split('.')),
      NAME = process.env.POD_NAME || 'localhost',
      AsyncFunction = Object.getPrototypeOf(async function() {}).constructor,
      shardMapCache = new MemoryCache({
        maxItems: 10,
        cycleStrategy: 'Queue'
      })

let Undefined

function isAllowedConfigItem(item, allowed) {

  item = String(item).toLowerCase().trim().split('.')
  return !!allowed.find(listed => {

    if (item.length !== listed.length) {
      return false
    }

    const to = Math.min(item.length, listed.length)

    for (let i = 0; i < to; i++) {

      if (listed[i] === '*' || listed[i] === item[i]) {
        if (i === to - 1) {
          return true
        }
      } else {
        return false
      }
    }
    return false

  })
}

function isWritableConfigItem(item) {
  return isAllowedConfigItem(item, writableConfigItems) && config(item) !== Undefined
}

function isReadableConfigItem(item) {
  return isAllowedConfigItem(item, readableConfigItems)
}

module.exports = class CortexApiClusterServiceClient extends ClusterServiceClient {

  _commands = new Map()
  _master = null
  _shardPair = null
  _endpoints = null

  #updateShardPair = () => {

    this._shardPair = null
    const endpoints = this._endpoints = this.endpoints
    for (let index = 0; index < endpoints.length; index += 1) {
      const { name } = endpoints[index]
      if (name === this.selfName) {
        this._shardPair = this.getShardMap(endpoints.length)[index]
        break
      }
    }
    if (this._shardPair === null) {
      logger.warn(`[events] server ${this.selfName} could not find a shard pair.`)
    } else {
      logger.silly(`[events] shard pair on ${this.selfName} update to ${this._shardPair}`)
    }
    return this._shardPair && this._shardPair.slice()

  }
  constructor(options) {

    super('cortex-api-cluster-service-client', options)

    this._endpoints = this.endpoints

    this.on('changed', () => {
      void this.master
      this.#updateShardPair()
    })

    this.once('started', () => {
      void this.master
      this.#updateShardPair()
    })

    this.on('cluster.master', () => {
      this.#updateShardPair()
    })

  }

  toJSON() {

    const { selfName, lowerBoundShardKey, upperBoundShardKey, master: primary } = this

    return {
      ...super.toJSON(),
      selfName,
      lowerBoundShardKey,
      upperBoundShardKey,
      commands: Array.from(this._commands.keys()).sort(),
      primary
    }
  }

  get selfName() {
    return NAME
  }

  get lowerBoundShardKey() {
    return this._shardPair ? this._shardPair[0] : -1
  }

  get upperBoundShardKey() {
    return this._shardPair ? this._shardPair[1] : -1
  }

  generateShardKey(max = 0xFFFFFFFF) {
    return randomInt(0, max)
  }

  getShardMap(count, max = 0xFFFFFFFF) {

    if (count > 0) {

      const key = `${count}_${max}`,
            map = shardMapCache.get(key) || [],
            value = max / count,
            floor = Math.floor(value),
            ceil = Math.ceil(value)

      if (map.length === 0) {

        let rest = max % count

        for (let i = 0; i < count; i += 1) {
          const next = rest > 0 ? ceil : floor
          if (i === 0) {
            map.push([0, next])
          } else {
            const last = map[i - 1][1]
            map.push([Math.min(last + 1, last + next), last + next])
          }
          if (map[i][1] === max) {
            break
          }
          rest -= 1
        }
        shardMapCache.set(key, map)

      }

      return map.slice().map(([a, b]) => [a, b])

    }

    return []

  }

  shardKeyToIndex(shardKey, count, max = 0xFFFFFFFF) {
    let idx = 0
    for (const [lower, upper] of this.getShardMap(count, max)) {
      if (shardKey >= lower && shardKey <= upper) {
        return idx
      }
      idx += 1
    }
    return -1
  }

  shardKeyToEndpoint(shardKey, count, max = 0xFFFFFFFF) {

    const idx = this.shardKeyToIndex(shardKey, count, max),
          endpoint = this._endpoints[idx]

    return endpoint && endpoint.name
  }

  clusterCloseRequest(reqId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    modules.db.models.org.loadOrg(options.org, (err, org) => {

      if (err) {
        return callback(err)
      }

      this.command(
        'api.request.delete',
        {
          body: {
            reqId,
            force: rBool(options.force, false),
            orgId: org._id
          }
        },
        (err, results) =>
          callback(
            err,
            Object.values(results || {}).find(v => v) === true
          )
      )

    })

  }

  /**
   * @param orgId
   * @param options
   *  verbose: false. true returns arrays with details
   * @param callback
   */
  clusterGetActivity(orgId, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let verbose = rBool(options.verbose, false)

    this.command('api.org.activity', { body: { orgId, verbose } }, (err, results) => {
      callback(
        err,
        Object.entries(results).reduce((activity, [host, result]) => {
          if (!Fault.from(result)) {
            Object.keys(result).forEach(key => {
              if (activity[key] === Undefined || activity[key] === null) {
                activity[key] = result[key]
              } else if (verbose) {
                activity[key] = [...activity[key], ...(Array.isArray(result[key]) ? result[key] : new Array(result[key]).fill({ _id: consts.emptyId }))] // in case we don't get back what we expect.
              } else {
                activity[key] += Array.isArray(result[key]) ? result[key].length : result[key] // in case we don't gat back what we expect.
              }
            })
          }
          return activity
        }, {})
      )
    })
  }

  clusterGetMetrics(options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    this.command('api.metrics', { body: options }, callback)
  }

  clusterGetConfig(path, callback = nullFunc) {

    if (!isReadableConfigItem(path)) {
      callback(Fault.create('cortex.accessDenied.unspecified'))
    } else if (config(path) === Undefined) {
      callback(Fault.create('cortex.notFound.unspecified'))
    } else {
      this.command(
        'api.config.get',
        {
          body: { path }
        },
        callback
      )
    }

  }

  clusterSetConfig(path, value, callback) {
    if (!isWritableConfigItem(path)) {
      callback(Fault.create('cortex.accessDenied.unspecified'))
    } else if (config(path) === Undefined) {
      callback(Fault.create('cortex.notFound.unspecified'))
    } else {
      this.command(
        'api.config.set',
        {
          body: { path, value }
        },
        callback
      )
    }
  }

  // ------------------------

  initClusterCommands(service) {

    this.addCommand('api.debug.gc', async() => {

      const before = process.memoryUsage()

      if (global.gc) {
        global.gc(true)
      }

      return {
        before,
        after: process.memoryUsage()
      }

    })

    this.addCommand('api.debug.loadOrg', async options => {

      const org = await modules.db.models.org.loadOrg(options && options.code)
      return org.code

    })

    this.addCommand('api.debug.getRuntimeSize', async options => {

      const org = await modules.db.models.org.loadOrg(options && options.code)
      return {
        before: roughSizeOfObject(org),
        runtime: roughSizeOfObject(await org.getRuntime()),
        after: roughSizeOfObject(org)
      }

    })

    this.addCommand('api.debug.getProviderMemoryUsage', async() => {

      return modules.workers.getWorker('push').getApproximateMemoryUsage()

    })

    this.addCommand('api.config.get', ({ path } = {}, callback) => {
      callback(null, isReadableConfigItem(path) && rVal(config(path), null))
    })

    this.addCommand('api.shards.update', (options, callback) => {
      callback(null, this.#updateShardPair())
    })

    this.addCommand('api.config.set', ({ path, value } = {}, callback) => {

      if (!isWritableConfigItem(path)) {
        return callback()
      }

      const [prefix, suffix] = pathParts(path),
            object = config(prefix)

      if (object) {
        pathTo(object, suffix, value)
        config.flush()
      }

      callback(null, config(path))
    })

    this.addCommand('api.metrics', (options, callback) => {

      service.metrics((err, metrics) => {

        if (!err) {
          if (options && options.keys) {
            metrics = toArray(options.keys, true).reduce((memo, key) => {
              pathTo(memo, key, pathTo(metrics, key))
              return memo
            }, {})
          }
        }
        callback(err, metrics)

      })

    })

    this.addCommand('api.org.activity', (options = {}, callback) => {
      callback(null, modules.metrics.orgActivity(options.orgId, { verbose: options.verbose }))
    })

    this.addCommand('api.request.delete', (options = {}, callback) => {

      const { reqId = null, force = false, orgId = null } = options,
            op = modules.runtime.db.findOne({ _id: reqId && reqId.toString(), type: 'request' }),
            r = op && op.req

      if (r && (!orgId || equalIds(orgId, r.orgId))) {

        const err = force ? Fault.create('cortex.error.aborted', { reason: 'Server aborted request operation.', path: op.context }) : null,
              activeCursor = !!op.activeCursor

        // note: control flow is a little weird here. only wait to output if there is an active cursor that can be aborted.
        op.cancel(err, () => {
          if (activeCursor) {
            callback(null, true)
          }
        })

        if (force) {
          try {
            r.destroy()
          } catch (err) {
            void err
          }
        }

        if (activeCursor) {
          return
        }

      }

      // if there's an active cursor, abort and wait.
      callback(null, !!force)

    })

  }

  addCommand(command, handler) {
    this._commands.set(command, handler)
  }

  listCommands(callback) {
    callback(null, Array.from(this._commands.keys()).sort())
  }

  handleCommand(command, payload, callback) {
    const cmd = this._commands.get(command)
    if (!cmd) {
      return callback(Fault.create('cortex.notFound.unspecified', { reason: 'command not found' }))
    } else if (cmd instanceof AsyncFunction) {
      let err
      cmd(payload)
        .catch(e => {
          err = e
          return Undefined
        })
        .then(result => {
          callback(err, result)
        })
    } else {
      cmd(payload, callback)
    }
  }

  command(command, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let { headers = {}, body, endpoint, stream } = options

    const sendHttp = () => {

      this.post(
        `/command/${command}`,
        {
          ...options,
          headers,
          stream: endpoint && stream,
          json: true,
          body: {
            serialized: serializeObject(body)
          }
        },
        (err, result) => {

          if (endpoint && stream && isReadableStream(result)) {

            callback(err, result)

          } else {

            [err, result] = this._deserializeResponse(err, result, !!endpoint)
            callback(err, result)

          }

        }
      )

    }

    if (this.isWsSupported && !(endpoint && stream)) {

      this.callWs(
        'command',
        {
          command,
          payload: { serialized: serializeObject(body) }
        },
        options,
        (err, result) => {

          [err, result] = this._deserializeResponse(err, result, !!endpoint)

          if (err && ['kWsTransmission', 'kWsTimeout'].includes(err.code)) {

            sendHttp()
            this.__log(`transmission failed, falling back to http - ${err.reason}`)

          } else {

            callback(err, result)

          }

        }
      )

    } else {

      sendHttp()

    }

  }

  _deserializeResponse(err, result, isSingleEndpoint = true) {

    if (!err) {

      try {

        if (isSingleEndpoint) {
          result = deserializeObject(pathTo(result, 'serialized'))
        } else {
          result = Object.keys(result).reduce((memo, endpoint) => {
            const value = result[endpoint]
            if (Fault.isFault(result[endpoint])) {
              memo[endpoint] = value
            } else {
              memo[endpoint] = deserializeObject(pathTo(value, 'serialized'))
            }
            return memo
          }, {})
        }
      } catch (e) {
        err = e
      }
    }

    return [err, result]
  }

  get master() {

    const current = this._master,
          endpoint = this.endpoints[0]

    this._master = endpoint ? endpoint.name : null
    if (current !== this._master) {
      this.emit('cluster.master', this._master)
    }
    return this._master
  }

  get isMaster() {
    return NAME === this.master
  }

}
