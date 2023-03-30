
import objects from 'objects'
import { clamp, isFunction } from 'util.values'

const sDefaultBatchSize = 100,
      sMinBatchSize = 1,
      sMaxBatchSize = 100,
      pId = Symbol('id'), // the cursor id
      pOpened = Symbol(''), // the cursor id
      pBuffer = Symbol('buffer'), // the local buffer
      pShared = Symbol('shared'), // shared cursors will not have a local buffer and will only fetch 1 at a time.
      pBatchSize = Symbol('batch_size'), // the batch size between sandbox and api (not underlying cursor batch size)
      pHasMore = Symbol('hasMore'), // true if a cursor is exhausted and has a limit that detected more items past the end.
      pHasNext = Symbol('hasNext'), // hint from fetch
      pProvider = Symbol('provider'), // remote cursor api
      fOpen = Symbol('open'), // cursor open function
      fOpener = Symbol('opener'), // cursor opener function
      fFill = Symbol('fill') // cursor fill function

let Undefined

class Cursor {

  close() {
  }

  hasNext() {
    return false
  }

  isClosed() {
    return true
  }

  next() {
    throw new RangeError('Iterator out of bounds.')
  }

  passthru() {
    return null
  }

  // ----------------------------------------

  forEach(fn) {
    for (const value of this) {
      fn(value)
    }
  }

  map(fn) {
    const out = []
    for (const value of this) {
      out.push(fn(value))
    }
    return out
  }

  find(fn) {
    for (const value of this) {
      if (fn(value)) {
        return value
      }
    }
    return Undefined
  }

  filter(fn) {
    const out = []
    for (const value of this) {
      if (fn(value)) {
        out.push(value)
      }
    }
    return out
  }

  reduce(fn, memo) {
    for (const value of this) {
      memo = fn(memo, value)
    }
    return memo
  }

  toArray() {
    const buffer = []
    for (const value of this) {
      buffer.push(value)
    }
    return buffer
  }

  [Symbol.iterator]() {
    return {
      next: () => (this.hasNext() ? { value: this.next(), done: false } : { done: true })
    }
  }

  /**
   * @param fnEach_
   * @param fnMap_
   * @example
   *    cursor.stream((value, total) => {
   *       return total < limit && script.getTimeLeft() >= 1000
   *    })
   */
  stream(fnEach_, fnMap_) {

    let buffer = '{ "data": [', // the initial json buffer structure (hasMore appended later)
        total = 0, // count cursor output to limit result size
        hasMore = false // let the client know if it should try for more

    // once header is written, errors will be swallowed, so try to ensure success.
    // if there is an error, output a fault, though the client will have to look for
    // a "fault" because the status will always be 200.
    const res = require('response'),
          fnEach = (typeof fnEach_ === 'function') ? fnEach_ : null,
          fnMap = (typeof fnMap_ === 'function') ? fnMap_ : null,
          maxBufferSize = 100 * 1024 // response buffer chunk size

    res.setHeader('Content-Type', 'application/json')

    try {
      for (const item of this) {
        ++total
        if (total > 1) buffer += ','
        buffer += JSON.stringify(fnMap ? fnMap(item) : item)
        if (buffer.length >= maxBufferSize) {
          res.write(buffer)
          buffer = ''
        }
        if (fnEach && (fnEach(item, total) === false)) {
          hasMore = !!this.hasNext()
          break
        }
      }
    } catch (err) {
      res.write(`${buffer}], "object": "fault", "errCode": "${err.errCode || 'cortex.error.unspecified'}", "code": "${err.code || 'kError'}", "reason": "${err.reason || err.message || 'Error'}"}`)
      return
    }
    res.write(`${buffer}], "object": "list", "hasMore": ${hasMore}}`)
  }

}

// ---------------------------------------------------------------

class ApiCursor extends Cursor {

  constructor(id, { provider = objects.cursor } = {}) {
    super()
    this[pId] = id
    this[pProvider] = provider
  }

  close() {
    if (this[pId]) {
      this[pProvider].close(this[pId])
      this[pId] = null
    }
  }

  hasNext() {
    return !!this[pId] && this[pProvider].hasNext(this[pId])
  }

  isClosed() {
    return !this[pId] || this[pProvider].isClosed(this[pId])
  }

  next() {
    const next = this[pProvider].next(this[pId])
    if (!next) {
      throw new RangeError('Iterator out of bounds.')
    }
    return next
  }

  passthru() {
    return { object: 'cursor', _id: this[pId] }
  }

  toObject() {
    return this[pProvider].toObject
      ? this[pProvider].toObject(this[pId])
      : {
        _id: this[pId]
      }
  }

}

// ---------------------------------------------------------------

class BufferedApiCursor extends ApiCursor {

  constructor(id, fnOpener, { shared = false, provider = objects.cursor } = {}) {

    super(id, { provider })
    this[pBatchSize] = sDefaultBatchSize
    this[pOpened] = false
    this[fOpener] = fnOpener
    this[pBuffer] = []
    this[pShared] = !!shared
    this[pHasMore] = false
    this[pHasNext] = Undefined

    if (!id && !isFunction(fnOpener)) {
      throw new TypeError('missing opener function.')
    }

  }

  shared(v = true) {
    if (this[pOpened]) {
      if (this[pShared] !== !!v) {
        throw new Error('cannot update shared property once opened')
      }
    } else {
      this[pShared] = !!v
    }
    return this
  }

  batchSize(v) {
    this[pBatchSize] = clamp(v, sMinBatchSize, sMaxBatchSize)
    return this
  }

  close() {
    super.close()
    if (this[pShared]) {
      this[pHasNext] = false
    }
  }

  hasNext() {
    if (!this[pOpened]) {
      this[fOpen]()
    }
    if (this[pShared]) {
      if (this[pHasNext] !== Undefined) {
        return this[pHasNext]
      }
      return super.hasNext()
    }
    return !!(this[pId] || this[pBuffer].length > 0)
  }

  isClosed() {
    if (this[pShared]) {
      return !this.hasNext()
    }
    return !this[pId] && this[pOpened] && this[pBuffer].length === 0
  }

  next() {
    if (!this.hasNext()) {
      throw new RangeError('Iterator out of bounds.')
    }
    let next = null
    if (this[pShared]) {
      const { buffer, hasMore, hasNext } = this[pProvider].fetch(this[pId], { count: 1 })
      next = buffer[0]
      this[pHasMore] = hasMore
      this[pHasNext] = hasNext
      if (buffer.length === 0) {
        throw new RangeError('Iterator out of bounds.')
      }
    } else if (this[pBuffer].length > 0) {
      next = this[pBuffer].shift()
      if (this[pBuffer].length === 0) {
        this[fFill]()
      }
    }
    return next
  }

  get hasMore() {
    if (this[pShared]) {
      return this[pHasMore]
    }
    return this[pHasMore] && this.isClosed() && this[pBuffer].length === 0
  }

  passthru(replay = true) {

    if (!replay && !this[pOpened]) {
      this[fOpen]()
    }

    return (replay) ? this[fOpener]() : super.passthru()
  }

  [fOpen]() {
    if (!this[pOpened]) {
      this[pOpened] = true
      if (!this[pId]) {
        this[pId] = this[fOpener]()._id
      }
      if (!this[pShared]) {
        this[fFill]()
      }
    }
  }

  [fFill]() {
    if (this[pId]) {
      const { buffer, hasMore } = this[pProvider].fetch(this[pId], { count: this[pBatchSize] })
      this[pBuffer] = buffer
      this[pHasMore] = hasMore
      if (this[pBuffer].length === 0 || this[pBuffer].length < this[pBatchSize]) {
        this.close()
      }
    }
  }

}

class WritableBufferedApiCursor extends BufferedApiCursor {

  push(...objects) {
    return this[pProvider].push(this[pId], objects)
  }

}

export {
  Cursor,
  ApiCursor,
  BufferedApiCursor,
  WritableBufferedApiCursor
}
