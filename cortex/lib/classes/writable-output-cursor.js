'use strict'

const Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      { OutputCursor } = require('../utils'),
      { isFunction } = require('underscore'),
      Memo = require('./memo'),
      modulePrivates = require('./privates').createAccessor()

let Undefined
/**
 * Takes a stream in object mode and continues to output until the cursor is closed.
 */
class WritableOutputCursor extends OutputCursor {

  constructor({ inputCursor = null, writeTransform = null, readTransform = null, name } = {}) {

    super()

    const privates = modulePrivates(this)

    privates.writable = true
    privates.objects = []
    privates.queue = []
    privates.pumping = false
    privates.pumpCallbacks = []
    privates.writeTransform = isFunction(writeTransform) ? writeTransform : null
    privates.readTransform = isFunction(readTransform) ? readTransform : null
    privates.memo = new Memo()
    privates.inputCursor = inputCursor
    privates.name = name

    privates.action = (fn) => {
      privates.queue.push(fn)
      privates.pump()
    }

    // not re-entrant. the action will be picked up in the async loop if it's still running.
    privates.pump = callback => {

      if (isFunction(callback)) {
        privates.pumpCallbacks.push(callback)
      }

      if (privates.pumping) {
        return
      }

      privates.pumping = true

      async.whilst(

        () => privates.pumping,

        callback => {

          if (privates.queue.length === 0 || !(this.isClosed() || privates.objects.length > 0)) {
            privates.pumping = false
            return callback()
          }

          try {
            const action = privates.queue.shift()
            action(
              (this.isClosed() && privates.err) || null,
              privates.objects
            )
          } catch (e) { // if something throws internally, don't continue.
            if (!privates.err) {
              privates.err = Fault.from(e)
            }
            privates.writable = false
            privates.objects = []
          }

          setImmediate(callback)

        },

        () => {

          const callbacks = privates.pumpCallbacks
          privates.pumpCallbacks = []
          callbacks.forEach(callback => {
            callback()
          })

        }

      )

    }

  }

  toJSON() {

    const privates = modulePrivates(this),
          { writable, queue, pumping, objects, inputCursor, stream, name } = privates

    return {
      ...super.toJSON(),
      type: 'writable',
      writable,
      queue: queue.length,
      size: objects.length,
      name,
      pumping,
      cursor: inputCursor && inputCursor.toJSON(),
      stream: stream && {
        paused: stream.isPaused(),
        readable: stream.readable,
        destroyed: stream.destroyed,
        readableEncoding: stream.readableEncoding,
        readableEnded: stream.readableEnded,
        readableFlowing: stream.readableFlowing,
        readableLength: stream.readableLength,
        readableObjectMode: stream.readableObjectMode
      }
    }
  }

  get size() {
    return modulePrivates(this).objects.length
  }

  get stream() {
    return modulePrivates(this).stream
  }

  fromStream(stream, { dataEvent = 'data' } = {}) {

    const privates = modulePrivates(this),
          { objects, pump } = privates

    privates.stream = stream

    stream.on(dataEvent, object => {
      if (privates.writable) {
        objects.push(object)
      }
      pump()
    })

    stream.on('end', () => {
      privates.writable = false
      pump()
    })

    stream.on('error', err => {
      privates.err = err
      privates.writable = false
      pump()
    })

  }

  push(...args) {

    const { objects, writable, writeTransform, pump } = modulePrivates(this)

    if (writable) {
      args.forEach(object => {
        const output = writeTransform ? writeTransform(object) : object
        if (output !== Undefined) {
          objects.push(output)
        }
      })
    }

    pump()
  }

  end(err = null) {

    const privates = modulePrivates(this)
    if (privates.err === Undefined) {
      privates.err = err
    }
    privates.writable = false
    privates.pump()

  }

  hasMore() {

    const { inputCursor } = modulePrivates(this)
    return !!(inputCursor && inputCursor instanceof OutputCursor && inputCursor.hasMore())
  }

  hasNext(callback) {
    modulePrivates(this).action((err, objects) => {
      this._replyHasNext(err, !err && objects.length > 0, callback)
    })

  }

  next(callback) {

    const { readTransform } = modulePrivates(this)

    modulePrivates(this).action((err, objects) => {

      err = err || this.error

      const object = err ? null : objects.shift(),
            output = (!err && readTransform && object !== Undefined) ? readTransform(object) : object

      this._replyNext(err, output, callback)

    })
  }

  isClosed() {
    const { writable, objects } = modulePrivates(this)
    return !writable && objects.length === 0
  }

  close(callback) {
    const privates = modulePrivates(this)
    privates.writable = false
    privates.objects = []
    privates.pump(() => {
      super.close(callback)
    })
  }

  get memo() {
    return modulePrivates(this).memo
  }

  set memo(memo) {
    modulePrivates(this).memo = Memo.from(memo)
  }

}

module.exports = WritableOutputCursor
