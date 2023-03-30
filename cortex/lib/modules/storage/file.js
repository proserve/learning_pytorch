'use strict'

const path = require('path'),
      _ = require('underscore'),
      MediaPointer = require('./pointer'),
      fs = require('fs'),
      logger = require('cortex-service/lib/logger'),
      mkdirp = require('mkdirp'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      utils = require('../../utils'),
      modules = require('../../modules'),
      consts = require('../../consts')

/**
 * can take an upload file
 * @type {Function}
 */
class FilePointer extends MediaPointer {

  constructor(node, entry, ac) {
    super(node, entry, ac)
    this.deleteOnDispose = false
    this.path = utils.path(entry, 'path') || this.getMeta('path')
  }

  delete(callback) {
    callback = utils.ensureCallback(callback)
    if (!this.getMeta('path')) {
      return callback()
    }
    const path = this.getMeta('path')
    fs.unlink(path, err => {
      if (err) {
        logger.info('FilePointer mopUp. Error deleting ' + path)
      } else {
        logger.silly('FilePointer mopUp. Deleted ' + path)
      }
      this.setMeta('path')
      callback(err)
    })
  }

  /**
   *
   * @param start
   * @param end
   * @param options
   *  stream: false. if true, returns a readable stream instead of a buffer
   * @param callback
   */
  range(start, end, options, callback) {

    if (_.isFunction(options)) {
      callback = options; options = null
    } else if (_.isFunction(end)) {
      callback = end; end = null; options = null
    }
    start = utils.rInt(start, 0)
    end = utils.rInt(end, null)

    callback = _.once(utils.ensureCallback(callback))

    let stream
    try {
      stream = fs.createReadStream(this.getMeta('path'), { start: start, end: end })
    } catch (err) {
      return callback(err)
    }
    if (utils.option(options, 'stream')) {
      return callback(null, stream)
    }

    const bufs = []
    stream.on('data', function(d) {
      bufs.push(d)
    })
    stream.on('end', function() {
      const buf = Buffer.concat(bufs)
      if (callback) {
        callback(null, buf)
      }
    })
    stream.on('error', function(err) {
      callback(err)
    })
  }

  stream(options, callback) {
    if (_.isFunction(options)) {
      callback = options
      options = {}
    }
    callback(null, fs.createReadStream(this.getMeta('path'), options))
  }

  generatePropertyFileKey(rootDocument, propertyPath, facetId, contentType, callback) {

    super.generatePropertyFileKey(rootDocument, propertyPath, facetId, contentType, (err, key) => {
      if (!err) {
        key = path.join(config('uploads.files'), key)
      }
      callback(err, key)
    })

  }

  /**
   *
   * @param pointer
   * @param options
   *      streamOptions: passed to the stream call of the pointer being streamed
   *      key: a path to override the write.
   * @param callback
   */
  _doWrite(pointer, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const dirname = path.dirname(this.getMeta('path'))

    try {
      mkdirp.sync(dirname)
    } catch (err) {
      return callback(err)
    }

    let done = false,
        ws = fs.createWriteStream(this.getMeta('path'), options)

    pointer.stream(options.streamOptions || {}, (err, stream) => {
      if (err) {
        callback(err)
      } else {
        stream.pipe(ws)
          .on('error', err => {
            if (!done) {
              done = true
              this.state = consts.media.states.error
              callback(err)
            }
          })
          .on('finish', () => {
            if (!done) {
              done = true
              this.state = consts.media.states.ready
              callback()
            }
          })
      }
    })

  }

  url(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)
    setImmediate(callback, Fault.create('cortex.notImplemented.pointerUrl'))

  }

  // ---------------------------------------------------------------

  getLocationType() {
    return consts.LocationTypes.File
  }

  getMime(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (this.mime) {
      setImmediate(callback.bind(null, null, this.mime))
    } else {
      this.detectMime(function(err, mime) {
        if (!err) {
          this.mime = mime
        }
        callback(err, mime)
      }.bind(this))
    }
  }

  getSize(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (this.size != null) {
      setImmediate(callback.bind(null, null, this.size))
    } else {
      fs.stat(this.getMeta('path'), (err, stats) => {
        if (!err && !stats.isFile()) {
          err = Fault.create('cortex.notFound.file', { reason: 'The file does not exist.' })
        }
        if (!err) {
          this.size = stats.size
        }
        callback(err, this.size)
      })
    }
  }

  getETag(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (this.ETag != null) {
      setImmediate(callback.bind(null, null, this.ETag))
    } else {
      modules.streams.hashFile(this.getMeta('path'), 'md5', (err, ETag) => {
        if (err) {
          err = Fault.create('cortex.error.unspecified', { reason: 'ETag calculation failure.' })
        } else {
          this.ETag = ETag
        }
        callback(err, this.ETag)
      })
    }
  }

  getFileName(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    if (this.filename == null) {
      this.filename = path.basename(this.getMeta('path'))
    }
    setImmediate(callback.bind(null, null, this.filename))
  }

}

Object.defineProperty(FilePointer.prototype, 'path', {
  get: function() {
    return this.getMeta('path')
  },
  set: function(path) {
    // this.reset();
    this.setMeta('path', path)
  },
  enumerable: true
})

module.exports = FilePointer
