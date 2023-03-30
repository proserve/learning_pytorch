'use strict'

const { OutputCursor } = require('../../../../utils')

let Undefined

class NativeDocumentCursor extends OutputCursor {

  constructor(cursor) {
    super()
    this._cursor = cursor
    cursor.once('close', () => {
      this.close(() => {})
    })
    cursor.once('error', err => {
      this.destroy(err, () => {})
    })
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: 'native'
    }
  }

  hasNext(callback) {
    if (this.isClosed() || this._cursor.isClosed()) {
      this._replyHasNext(null, false, callback)
    } else {
      this._cursor.hasNext((err, has) => {
        this._replyHasNext(err, !err && has, callback)
      })
    }
  }

  next(callback) {
    this.hasNext((err, has) => {
      if (err || !has) {
        this._replyNext(err, Undefined, callback)
      } else {
        this._cursor.next((err, doc) => {
          this._replyNext(err, doc, callback)
        })
      }
    })
  }

  hasMore() {
    return !!this._cursor.hasMore // added by the parser
  }

  close(callback) {
    if (!this._cursor.isClosed()) {
      this._cursor.close(() => {
        super.close(callback)
      })
    } else {
      super.close(callback)
    }
  }

}

module.exports = NativeDocumentCursor
