const Type = require('../type'),
      { isIterable } = require('../expression-utils'),
      { isSet, OutputCursor } = require('../../../utils'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      Fault = require('cortex-service/lib/fault'),
      { Transform } = require('stream'),
      IterableCursor = require('../../../classes/iterable-cursor'),
      WritableOutputCursor = require('../../../classes/writable-output-cursor')

class Type$Cursor extends Type {

  static isA(value) {

    return value instanceof OutputCursor || isReadableStream(value)
  }

  static $eq(a, b) {

    void a
    void b
    return false
  }

  static cast(value, { ac, path } = {}) {

    let cursor

    if (isSet(value)) {

      if (value instanceof OutputCursor) {
        cursor = value
      } else if (isIterable(value)) {
        cursor = new IterableCursor({ iterable: value })
      } else if (isReadableStream(value)) {

        const output = new WritableOutputCursor(),
              stream = new Transform({
                objectMode: true,
                transform(chunk, encoding, callback) {
                  this.push(chunk)
                  callback()
                }
              })
        output.fromStream(stream)
        output.flushOnWrite = true
        cursor = output
      }

      if (cursor) {
        cursor.on('error', () => {
          // noop. don't allow cursor to create uncaught exceptions.
        })
        return cursor
      }

    }
    throw Fault.create('cortex.invalidArgument.castError', { resource: ac && ac.getResource(), reason: `Could not cast "${value}" to Cursor.`, path })

  }

}

module.exports = Type$Cursor
