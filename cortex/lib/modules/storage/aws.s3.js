'use strict'

const _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      MediaPointer = require('./pointer'),
      TempFilePointer = require('./temp-file'),
      modules = require('../../modules'),
      Fault = require('cortex-service/lib/fault'),
      mime = require('mime'),
      logger = require('cortex-service/lib/logger'),
      async = require('async'),
      utils = require('../../utils'),
      consts = require('../../consts')

/**
 * The AwsS3 pointer stores in S3 and serves from sw3.
 * files are stored keyed by org for bandwidth usage tracking, since we can't track usage for non-grid streaming.
 *
 * @type {exports}
 */
class AwsS3Pointer extends MediaPointer {

  constructor(node, entry, ac) {

    super(node, entry, ac)

    this.awsFile = null
    this._localLoading = false
    this._doLocal = false
    this._localCallbacks = []
    this._local = null

  }

  getLocation(callback) {

    if (this._location) {
      setImmediate(callback, null, this._location)
    } else {
      modules.aws.getLocation(this.ac.org, this.getLocationType(), this.storageId, (err, location) => {
        if (!err) {
          this._location = location
        }
        callback(err, this._location)
      })
    }
    return this._location

  }

  setLocation(location = null) {

    if (!location || (location instanceof modules.aws.S3Location && this.location && location.storageId && utils.equalIds(this.storageId, location.storageId))) {
      this._location = location
    }

  }

  dispose() {
    if (this._local) {
      this._local.dispose()
    }
    this._triggerCallbacks()
    super.dispose()
    this.awsFile = null
    this._location = null
  }

  delete(callback) {

    callback = utils.ensureCallback(callback)
    const awsId = this.getMeta('awsId')
    if (!awsId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'aws id not present.' }))
    }
    this.getLocation((err, location) => {
      if (err) {
        return callback(err)
      }
      location.deleteObject({ Key: awsId }, { includePrefix: false }, err => callback(err))
    })
  }

  _loadLocal(source, callback) {

    if (this._localLoading) {
      this._localCallbacks.push(callback)
    } else if (this._local) {
      this._local.stream(callback)
    } else {
      this._localCallbacks.push(callback)
      this._localLoading = true
      const local = this._local = (new TempFilePointer()) // set it here just so that we can dispose while streaming.
      local.write(source, (err, local) => {
        setImmediate(() => {
          this._triggerCallbacks(err, local)
        })
      })
    }

  }

  /**
   * @param options
   *  {
 *      cacheLocally: false                                     // copies to a local temp file that must be disposed.
 *  }
   * @param callback
   */
  stream(options, callback) {

    if (_.isFunction(options)) {
      callback = options
      // noinspection JSUnusedAssignment
      options = {}
    }

    let doLocal = utils.option(options, 'cacheLocally', false)
    doLocal = (doLocal === null) ? this._doLocal : !!doLocal

    if (doLocal || this._local) {

      this._loadLocal(this, callback)

    } else {

      this._open(true, err => {

        if (err) {
          return callback(err)
        }
        this.getLocation((err, location) => {
          let stream = null
          if (!err) {
            logger.silly('downloading from aws')
            stream = location.createReadStream({ Key: this.getMeta('awsId') }, { includePrefix: false })
          }
          callback(err, stream)
        })
      })

    }

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
      callback = options
      options = null
    } else if (_.isFunction(end)) {
      callback = end
      end = null
      options = null
    }
    start = utils.rInt(start, 0)
    end = utils.rInt(end, null)

    this.getLocation((err, location) => {

      let stream = null
      if (!err) {
        const params = {
          Key: this.getMeta('awsId'), // the prefix is written into the key
          Range: 'bytes=' + start + '-' + (end == null ? '' : end)
        }
        stream = location.getObject(params, { includePrefix: false, createReadStream: true }).createReadStream()
      }

      if (err || utils.option(options, 'stream')) {
        callback(err, stream)
      } else {

        const bufs = []
        callback = _.once(utils.ensureCallback(callback))
        stream.on('data', function(d) {
          bufs.push(d)
        })
        stream.on('end', function() {
          const buf = Buffer.concat(bufs)
          callback(null, buf)
        })
        stream.on('error', function(err) {
          callback(err)
        })
      }

    })

  }

  _triggerCallbacks(err, local) {

    const callbacks = this._localCallbacks

    this._local = local
    this._localCallbacks = []
    this._localLoading = false

    if (!err && !local) {
      err = Fault.create('cortex.notFound.file', { reason: 'Aws pointer not found.' })
    }

    callbacks.forEach(function(handler) {
      if (_.isFunction(handler)) {
        if (err) handler(err)
        else local.stream(handler)
      }
    })

  }

  /**
   * @param sourcePointer
   * @param options
   *     useLocally (cache a local copy of the file upon upload) defaults to false.
   *     key: a predetermined key.
   * @param callback
   * @private
   */
  _doWrite(sourcePointer, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    this.setMeta('awsId') // resets awsId to null
    this.awsFile = null

    let doLocal = utils.path(options, 'cacheLocally')
    doLocal = (doLocal == null) ? this._doLocal : !!doLocal

    async.waterfall([

      // attempt to cache locally before upload?
      callback => {

        if (doLocal && !this._localLoading && !this._local) {
          this._loadLocal(sourcePointer, (err, stream) => {
            if (!err) {
              sourcePointer = this._local
              stream.close()
            }
            callback(err)
          })
        } else {
          callback()
        }
      },

      callback => {
        sourcePointer.getETag(callback)
      },

      (ETag, callback) => {
        sourcePointer.getSize((err, size) => {
          callback(err, size, ETag)
        })
      },

      (size, ETag, callback) => {
        sourcePointer.getMime((err, contentType) => {
          callback(err, contentType, size, ETag)
        })
      },

      (contentType, size, ETag, callback) => {
        this.getLocation((err, thisLocation) => {
          if (err) {
            callback(err)
          } else if (sourcePointer instanceof AwsS3Pointer) {
            sourcePointer.getLocation((err, sourceLocation) => callback(err, contentType, size, ETag, thisLocation, sourceLocation))
          } else {
            callback(null, contentType, size, ETag, thisLocation, null)
          }
        })
      },

      (contentType, contentLength, ETag, thisLocation, sourceLocation, callback) => {

        const awsFile = {
          Key: utils.option(options, 'key', thisLocation.buildKey('hashed/' + ETag + '.' + (mime.extension(contentType) || 'dat'))), // include location prefix in key
          ContentType: contentType,
          CacheControl: 'no-cache, no-store, private' // do not allow any caching @todo: revise this?
        }

        if (thisLocation.equals(sourceLocation, { matchLocations: true, matchEndpoints: true, matchBuckets: false, matchCredentials: true })) {

          logger.silly('copying from aws to aws')

          if (config('isChina')) {
            awsFile.Bucket = sourceLocation.bucket
            awsFile.CopySource = sourcePointer.getMeta('awsId')
          } else {
            awsFile.CopySource = sourceLocation.bucket + '/' + encodeURIComponent(sourcePointer.getMeta('awsId'))
          }

          thisLocation.copyObject(awsFile, { includePrefix: false }, (err, result) => {
            if (!err) {
              awsFile.ETag = String(utils.option(result, 'ETag', '')).replace(/"/g, '')
              awsFile.ContentLength = contentLength
            }
            callback(err, awsFile)
          })

        } else {

          sourcePointer.stream((err, stream) => {
            if (err) callback(err)
            else {
              logger.silly('uploading to aws')
              awsFile.Body = stream
              awsFile.ContentLength = contentLength
              thisLocation.putObject(awsFile, { includePrefix: false }, (err, result) => {
                if (!err) {
                  awsFile.ETag = String(utils.option(result, 'ETag', '')).replace(/"/g, '')
                }
                callback(err, awsFile)
              })

            }
          })
        }

      },

      (awsFile, callback) => {

        this.setMeta('awsId', awsFile.Key)
        this.size = awsFile.ContentLength
        this.mime = awsFile.ContentType
        this.ETag = String(utils.option(awsFile, 'ETag', '')).replace(/"/g, '')
        this.awsFile = awsFile
        this.state = consts.media.states.ready
        callback()
      }

    ], callback)

  }

  url(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    this.getLocation((err, location) => {

      if (err) {
        return callback(err)
      }

      const params = {
              Key: this.getMeta('awsId')
            },
            req = location.getObject(params, { includePrefix: false, meta: options.meta }),
            expireSeconds = utils.rInt(options.urlExpirySeconds ? options.urlExpirySeconds : this.node && this.node.urlExpirySeconds, location.readUrlExpiry)

      if (options.meta) {

        // build event not emitted during oss request, headers in oss are set using request parameters
        req.on('build', function(req) {
          req.httpRequest.headers['x-amz-meta-medable'] = options.meta
        })

      }

      req.presign(expireSeconds, callback)

    })

  }

  // --------------------------------------------------------------------------

  getLocationType() {
    return consts.LocationTypes.AwsS3
  }

  getMime(options, callback) {
    if (_.isFunction(options)) {
      callback = options
      // noinspection JSUnusedAssignment
      options = {}
    }
    this._getProperty('mime', callback)
  }

  getSize(options, callback) {
    if (_.isFunction(options)) {
      callback = options
      // noinspection JSUnusedAssignment
      options = {}
    }
    this._getProperty('size', callback)
  }

  getETag(options, callback) {
    if (_.isFunction(options)) {
      callback = options
      // noinspection JSUnusedAssignment
      options = {}
    }
    this._getProperty('ETag', callback)
  }

  getFileName(options, callback) {
    if (_.isFunction(options)) {
      callback = options
      // noinspection JSUnusedAssignment
      options = {}
    }
    this._getProperty('filename', callback)
  }

  generatePropertyFileKey(rootDocument, propertyPath, facetId, contentType, callback) {

    this.getLocation((err, location) => {
      let key
      if (!err) {
        key = location.buildKey(
          rootDocument.constructor.objectId + '/' + rootDocument._id + '.' + propertyPath + '/' + facetId + '.' + (mime.extension(contentType) || 'dat')
        )
      }
      callback(err, key)
    })
  }

  // --------------------------------------------------------------------------

  _getProperty(prop, callback) {
    if (this[prop] != null) {
      // noinspection JSUnresolvedFunction
      setImmediate(callback, null, this[prop])
    } else {
      const props = ['size', 'mime', 'ETag']
      // some things we can get from the locally cached file.
      if (this._local && !this._localLoading && ~props.indexOf(prop)) {
        this._local.info((err, info) => {
          callback(err, utils.path(info, prop))
        })
      } else {
        this._open(false, err => {
          callback(err, this[prop])
        })
      }
    }
  }

  _open(forceNew, callback) {

    if (!forceNew && this.awsFile) {
      return setImmediate(callback, null, this.awsFile)
    }

    const awsId = this.getMeta('awsId')
    if (!awsId) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'aws id not present.' }))
    }
    this.getLocation((err, location) => {
      if (err) {
        return callback(err)
      }
      location.headObject({ Key: awsId }, { includePrefix: false }, (err, awsFile) => {
        err = Fault.from(err)
        if (err) {
          this.state = consts.media.states.error
          if (err.code === 'kAwsS3NotFound') {
            err = Fault.create('cortex.notFound.file', { reason: 'The file does not exist' })
          } else {
            err = Fault.create('cortex.error.unspecified', { reason: 'Unexpected file stream error.' })
          }
          callback(err)
        } else {
          awsFile.Key = this.getMeta('awsId')
          this.size = utils.rInt(awsFile.ContentLength, 0)
          this.mime = awsFile.ContentType
          this.ETag = String(utils.option(awsFile, 'ETag', '')).replace(/"/g, '')
          this.awsFile = awsFile
          this.state = consts.media.states.ready
          callback(null, awsFile)
        }
      })
    })
  }

}

Object.defineProperty(AwsS3Pointer.prototype, 'filename', {
  get: function() {
    return this.__filename != null ? this.__filename : (this.awsFile ? this.awsFile.Key : null)
  },
  set: function(filename) {
    this.__filename = filename
  },
  enumerable: true
})

module.exports = AwsS3Pointer
