
try {
  require('logger').warn('The cursor module is deprecated.')
} catch (err) {
}

const objects = require('objects')

module.exports = function Cursor(pluralName, options) {

  if (!(this instanceof Cursor)) {
    return new Cursor(pluralName, options)
  }

  let _cursorId = objects.cursor_open(pluralName, options)._id,
      _batchSize = 10,
      _buffer = []

  this[Symbol.iterator] = function() {
    const _cursor = this
    return {
      next() {
        const next = _cursor.next()
        return next ? { value: next, done: false } : { done: true }
      }
    }
  }

  // public interface.
  Object.defineProperties(this, {
    next: {
      value() {
        let next = null
        if (_buffer.length > 0) {
          next = _buffer.shift()
          if (_buffer.length === 0) {
            _fill.call(this)
          }
        }
        return next
      }
    },

    hasNext: {
      value() {
        return _cursorId || _buffer.length > 0
      }
    },

    close: {
      value() {
        if (_cursorId) {
          objects.cursor_close(_cursorId)
          _cursorId = null
        }
      }
    }
  })

  // private interface
  function _fill() {
    if (_cursorId) {
      const { buffer, hasMore } = objects.cursor_fetch(_cursorId, _batchSize)
      _buffer = buffer
      void hasMore
      if (_buffer.length === 0 || _buffer.length < _batchSize) {
        this.close()
      }
    }
  }

  _fill.call(this)

}
