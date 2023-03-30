const { getIdOrNull, createId, equalIds } = require('../../../utils'),
      { once, isFunction } = require('underscore'),
      Startable = require('cortex-service/lib/startable'),
      config = require('cortex-service/lib/config'),
      registry = require('../registry'),
      { v1 } = require('uuid'),
      privatesAccessor = require('../../../classes/privates').createAccessor()

/**
 * A registered, running operation
 *
 * @todo merge with exporession work to make operations models so they can be read using the parser.
 *
 * @param org {Org}
 * @param type {String} the operation type.
 * @param options {Object}
 *  _id {ObjectID} the associated object _id. auto-generated if not passed.
 *  parent {RuntimeOperation}. if passed, parent aborts will abort operation.
 */
class RuntimeOperation extends Startable {

  constructor(org, type, options) {

    options = options || {}

    super(type, { log_level: config('modules.runtime.operations.log_level') })

    const parent = options.parent,
          privates = privatesAccessor(this)

    Object.assign(privates, {
      org,
      _id: getIdOrNull(options._id) || createId(),
      uuid: v1(),
      cancelled: false,
      started: null,
      stopped: null,
      err: null,
      parent,
      cancel: isFunction(options.cancel) ? options.cancel : null, // custom cancel implementation
      start: isFunction(options.start) ? options.start : null, // custom start implementation
      stop: isFunction(options.stop) ? options.stop : null, // custom stop implementation
      listeners: {
        cancel: (err) => {
          this.cancel(err, () => {})
        },
        stopped: () => {
          this.__log(`${this.context} parent (${parent.context}) stopped.`)
          this.stop(() => {})
        }
      }
    })

    if (parent) {
      parent.once('cancel', privates.listeners.cancel)
      parent.once('stopped', privates.listeners.stopped)
    }

  }

  get logName() {
    return this.context
  }

  detach() {

    this.__log(`${this.context} detaching.`)
    const { parent, listeners } = privatesAccessor(this)
    if (parent) {
      parent.removeListener('cancel', listeners.cancel)
      parent.removeListener('stopped', listeners.stopped)
    }

  }

  cancel(err, callback = () => {}) {

    if (this.__protectedCasStop(callback)) {

      // signal cancel immediately.
      this.emit('cancel', err)

      const privates = privatesAccessor(this),
            afterStop = once(err => {
              this.__protectedPostStop(err)
            }),
            afterCancel = once(err => {
              privates.err = err
              try {
                this._waitStop(afterStop)
              } catch (err) {
                afterStop(err)
              }
            })

      privates.cancelled = true
      privates.err = err

      try {
        const { cancel } = privates
        if (cancel) {
          cancel.call(this, err, afterCancel)
        } else {
          afterCancel(err)
        }
      } catch (err) {
        afterCancel(err)
      }
    }

  }

  _waitStart(callback = () => {}) {

    const { start } = privatesAccessor(this),
          next = () => {
            privatesAccessor(this).started = new Date()
            this._register()
            super._waitStart(err => {
              if (err) {
                privatesAccessor(this).stopped = new Date()
                this._unregister()
              }
              callback(err)
            })
          }

    if (start) {
      start.call(this, err => {
        if (err) {
          callback(err)
        } else {
          next()
        }
      })
    } else {
      next()
    }

  }

  _waitStop(callback = () => {}) {

    const { stop, parent, listeners } = privatesAccessor(this),
          next = (err) => {
            super._waitStop(e => {
              if (parent) {
                parent.removeListener('cancel', listeners.cancel)
                parent.removeListener('stopped', listeners.stopped)
              }
              privatesAccessor(this).stopped = new Date()
              this._unregister()
              callback(err || e)
            })
          }

    if (stop) {
      stop.call(this, err => next(err))
    } else {
      next()
    }

  }

  get cancelled() {
    return privatesAccessor(this).cancelled
  }

  get started() {
    return privatesAccessor(this).started
  }

  get stopped() {
    return privatesAccessor(this).stopped
  }

  get _id() {
    return privatesAccessor(this)._id
  }

  get uuid() {
    return privatesAccessor(this).uuid
  }

  get context() {

    let _id = `${this.name}.${this._id}`
    if (this.parent) {
      return `${this.parent.context}.${_id}`
    }
    return _id
  }

  get err() {
    return privatesAccessor(this).err
  }

  get parent() {
    return privatesAccessor(this).parent
  }

  get env() {
    return privatesAccessor(this).org.code
  }

  get envId() {
    return privatesAccessor(this).org._id
  }

  set org(org) {
    const privates = privatesAccessor(this)
    if (org) {
      privates.org = org
      if (!equalIds(org._id, privates.org._id)) {
        this._unregister()
        this._register()
      }
    }
  }

  export() {

    const { err, uuid, _id, org: { code: env }, cancelled, started, stopped } = privatesAccessor(this)

    return {
      uuid,
      _id,
      env,
      object: 'operation',
      type: this.name,
      cancelled,
      state: this.state,
      started,
      stopped,
      parent: this.parent && this.parent.uuid,
      context: this.context,
      err: err && err.toJSON()
    }

  }

  /**
   * Low-level operation registration. Do not call directly.
   *
   * @private
   */
  _register() {
    registry.register(this)
  }

  /**
   * Low-level operation de-registration. Do not call directly. Call cancel() or finish() instead
   *
   * @private
   */
  _unregister() {
    registry.unregister(this)
  }

  _getInsertDocument() {

    const { uuid, _id, env, envId, name: type } = this

    return {
      _id: _id.toString(),
      env,
      envId: envId.toString(),
      type,
      uuid
    }

  }

}

module.exports = RuntimeOperation
