'use strict'

const { OutputCursor } = require('../utils'),
      zlib = require('zlib'),
      miss = require('mississippi'),
      { PassThrough } = require('stream'),
      { rString } = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      bodyParser = require('body-parser'),
      { fromStream } = require('streaming-iterables'),
      { mimeToOptions, streamParser } = require('cortex-service/lib/utils/output'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      { parse } = require('cortex-service/lib/utils/json'),
      { array: toArray, promised, isSet } = require('../utils')

let Undefined

class IterableCursor extends OutputCursor {

  #iterator
  #isAsync
  #cursor
  #name
  #transform
  #queued
  #filter

  constructor({ iterable, name, transform, filter } = {}) {

    super()

    this.#cursor = iterable instanceof OutputCursor ? iterable : Undefined
    this.#isAsync = !!iterable[Symbol.asyncIterator]
    this.#iterator = this.#isAsync ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]()

    this.#name = name
    this.#transform = transform
    this.#filter = filter

  }

  /**
   *
   * @param stream
   * @param options
   *  limit
   * @return {Promise<IterableCursor|null>}
   */
  static async fromHttp(stream, options) {

    let err, pipeline

    if (!isReadableStream(stream) || !stream.headers) {
      return null
    }

    const contentType = rString(stream.headers['content-type'], '').toLowerCase(),
          streams = [],
          mimeOptions = mimeToOptions(contentType),
          encoding = rString(stream.headers['content-encoding'], 'identity').toLowerCase(),
          inflate = ['deflate', 'gzip', 'identity'].includes(encoding)

    if (!mimeOptions.supported) {
      return null
    }

    if (mimeOptions.delimited) {

      try {
        switch (encoding) {
          case 'deflate':
            streams.push(zlib.createInflate())
            break
          case 'gzip':
            streams.push(zlib.createGunzip())
            break
          case 'identity':
            // use a dummy pass-through so we can use the pump.
            streams.push(new PassThrough())
            break
          default:
            err = Fault.create('cortex.invalidArgument.unsupportedContentEncoding', { reason: `Unsupported content encoding "${encoding}"` })
        }
        if (!err) {
          streams.push(streamParser({ as: mimeOptions.as, strict: true }))
          pipeline = miss.pipeline.obj(...streams)
        }
      } catch (e) {
        err = e
      }

      if (err) {
        throw err
      }
      stream.pipe(pipeline)
      pipeline.pause()
      return new IterableCursor({
        ...options,
        iterable: fromStream(pipeline)
      })

    } else {

      const parser = bodyParser.raw({
        inflate,
        limit: options?.limit,
        type: [contentType.split(';')[0].trim()]
      })

      await promised(null, parser, stream, null)

      let iterable = parse(stream.body, mimeOptions.as)
      if (isSet(iterable)) {
        if (iterable.object === 'fault') {
          throw Fault.create(iterable)
        } else if (iterable.object === 'result') {
          iterable = [iterable.data]
        } else if (iterable.object === 'list') {
          iterable = toArray(iterable.data, true)
        } else {
          iterable = [iterable]
        }
      } else {
        iterable = [Undefined]
      }

      return new IterableCursor({
        ...options,
        iterable
      })

    }

  }

  toJSON() {

    return {
      ...super.toJSON(),
      type: 'iterable',
      name: this.#name,
      cursor: this.#cursor && this.#cursor.toJSON(),
      isAsync: this.#isAsync
    }
  }

  hasMore() {
    return !!(this.#cursor && this.#cursor.hasMore())
  }

  hasNext(callback) {

    if (this.#queued !== Undefined) {
      return this._replyHasNext(null, true, callback)
    }

    this.#queue((err) => {
      this._replyHasNext(err, !(err || this.#queued === Undefined), callback)
    })
  }

  next(callback) {

    if (this.#queued !== Undefined) {
      const queued = this.#queued
      this.#queued = Undefined
      return this._replyNext(null, queued, callback)
    }

    this.#queue((err) => {
      const queued = err ? Undefined : this.#queued
      this.#queued = Undefined
      return this._replyNext(err, queued, callback)
    })

  }

  isClosed() {
    if (this.#cursor) {
      return (this.#cursor.isClosed()) && this.#queued === Undefined
    }
    return this.#iterator === Undefined && this.#queued === Undefined
  }

  destroy(err, callback) {
    if (this.#cursor) {
      this.#cursor.destroy(err, () => {
        super.destroy(err, callback)
      })
    } else {
      super.destroy(err, callback)
    }
  }

  close(callback) {
    const iterator = this.#iterator
    this.#queued = Undefined
    this.#iterator = Undefined
    if (this.#cursor) {
      this.#cursor.close(() => {
        super.close(callback)
      })
    } else {
      if (isReadableStream(iterator)) {
        try {
          iterator.destroy(this.error)
        } catch (e) {
        }
      }
      callback()
    }
  }

  _next(callback) {

    if (!this.#iterator) {

      callback(null, Undefined)

    } else if (this.#isAsync) {

      this.#iterator.next()
        .then(({ done, value }) => {
          callback(null, done ? Undefined : value)
        })
        .catch(callback)

    } else {

      let err, next
      try {
        const { done, value } = this.#iterator.next()
        next = done ? Undefined : value
      } catch (e) {
        err = e
      }
      callback(err, next)

    }

  }

  #queue = (callback) => {

    if (this.#queued !== Undefined) {
      return callback()
    }
    this._next(async(err, next) => {
      try {
        if (!err && next !== Undefined && this.#transform) {
          next = await this.#transform(next)
        }
      } catch (e) {
        err = e
      }
      if (!err && (this.#filter && !this.#filter(next))) {
        return setImmediate(() => this.#queue(callback))
      }
      this.#queued = err ? Undefined : next
      callback(err)
    })

  }

}

module.exports = IterableCursor
