'use strict'

// Copyright (C) 2011-2013 John Hewson
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

const stream = require('stream'),
      util = require('util')

// convinience API
module.exports = exports = function(readStream, options) {
  return exports.createStream(readStream, options)
}

// basic API
exports.createStream = function(readStream, options) {
  if (readStream) {
    return createLineStream(readStream, options)
  } else {
    return new LineStream(options)
  }
}

// deprecated API
exports.createLineStream = function(readStream) {
  return createLineStream(readStream)
}

function createLineStream(readStream, options) {
  if (!readStream) {
    throw new Error('expected readStream')
  }
  if (!readStream.readable) {
    throw new Error('readStream must be readable')
  }
  const ls = new LineStream(options)
  readStream.pipe(ls)
  return ls
}

//
// using the new node v0.10 "streams2" API
//

exports.LineStream = LineStream

function LineStream(options) {
  stream.Transform.call(this, options)
  options = options || {}

  // use objectMode to stop the output from being buffered
  // which re-concatanates the lines, just without newlines.
  this._readableState.objectMode = true
  this._lineBuffer = []
  this._keepEmptyLines = options.keepEmptyLines || false

  // take the source's encoding if we don't have one
  this.on('pipe', function(src) {
    if (!this.encoding) {
      this.encoding = src._readableState.encoding
    }
  })
}
util.inherits(LineStream, stream.Transform)

LineStream.prototype._transform = function(chunk, encoding, done) {
  // decode binary chunks as UTF-8
  encoding = encoding || 'utf8'

  if (Buffer.isBuffer(chunk)) {
    if (encoding === 'buffer') {
      chunk = chunk.toString() // utf8
      encoding = 'utf8'
    } else {
      chunk = chunk.toString(encoding)
    }
  }
  this._chunkEncoding = encoding

  const lines = chunk.split(/\r\n|\r|\n/g)

  if (this._lineBuffer.length > 0) {
    this._lineBuffer[this._lineBuffer.length - 1] += lines[0]
    lines.shift()
  }

  this._lineBuffer = this._lineBuffer.concat(lines)

  // always buffer the last (possibly partial) line
  while (this._lineBuffer.length > 1) {
    const line = this._lineBuffer.shift()
    // skip empty lines
    if (this._keepEmptyLines || line.length > 0) {
      if (!this.push(this._reencode(line, encoding))) {
        break
      }
    }
  }

  done()
}

LineStream.prototype._flush = function(done) {
  // flush all buffered lines
  while (this._lineBuffer.length > 0) {
    const line = this._lineBuffer.shift()
    // skip empty lines
    if (this._keepEmptyLines || line.length > 0) {
      if (!this.push(this._reencode(line, this._chunkEncoding))) {
        break
      }
    }
  }
  done()
}

// see Readable::push
LineStream.prototype._reencode = function(line, chunkEncoding) {
  if (this.encoding && this.encoding !== chunkEncoding) {
    return Buffer.from(line, chunkEncoding).toString(this.encoding)
  } else if (this.encoding) {
    // this should be the most common case, i.e. we're using an encoded source stream
    return line
  } else {
    return Buffer.from(line, chunkEncoding)
  }
}
