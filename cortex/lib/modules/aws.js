'use strict'

const AWS = require('aws-sdk'),
      OSS = require('ali-oss'),
      EventEmitter = require('events'),
      { PassThrough } = require('stream'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      consts = require('../consts'),
      utils = require('../utils'),
      https = require('https'),
      async = require('async'),
      modules = require('../modules'),
      Org = modules.db.models.Org

class AWSMockReq extends EventEmitter {

  constructor(options = {}) {
    super()

    this._name = options.name
    this._query = options.query
    this._params = options.params
    this._client = options.client
    this._readStream = options.readStream

    this._totalUploaded = 0
  }

  createReadStream() {
    return this._readStream
  }

  presign(expires, callback) {
    const url = this._client.signatureUrl(this._name, {
      expires,
      method: 'GET'
    })
    callback && callback(null, url)
    return url
  }

  onProgress(percentage, checkpoint, res) {
    this._totalUploaded = this._totalUploaded + res.size
    this.emit('httpUploadProgress', {
      total: this._totalUploaded / (percentage / 100),
      loaded: this._totalUploaded,
      key: this._name
    })
  }

  abort() {
    this._client.cancel()
  }

}

class StorageApi {

  constructor(s3Config) {

    this._sdk = config('isChina')
      ? new OSS({
        region: s3Config.region,
        accessKeyId: s3Config.accessKeyId,
        accessKeySecret: s3Config.secretAccessKey,
        bucket: s3Config.params.Bucket,
        secure: true // always
      })
      : new AWS.S3(s3Config)

  }

  static s3OssParamMap() {
    return {
      Metadata: 'meta',
      VersionId: 'versionId',
      CacheControl: 'headers.Cache-Control',
      ContentDisposition: 'headers.Content-Disposition',
      ContentEncoding: 'headers.Content-Encoding',
      expires: 'headers.Expires',
      IfMatch: 'headers.If-Match',
      IfModifiedSince: 'headers.If-Modified-Since',
      IfNoneMatch: 'headers.If-None-Match',
      IfUnmodifiedSince: 'headers.If-Unmodified-Since',
      Range: 'headers.Range',
      ServerSideEncryption: 'headers.x-oss-server-side-encryption',
      StorageClass: 'headers.x-oss-storage-class',
      Tagging: 'headers.x-oss-tagging'
    }
  }

  static s3ParamsToOss(params, options = {}) {

    const result = { params: { headers: {} }, query: {} },
          queryObjectParamMap = {
            'Prefix': 'prefix',
            'MaxKeys': 'max-keys',
            'Marker': 'marker',
            'Delimiter': 'delimiter'
          }

    // params
    for (let [param, value] of Object.entries(params)) {

      // translate known S3 params to OSS params
      const path = StorageApi.s3OssParamMap()[param]

      if (path) {

        let parts = path.split('.'),
            location = result.params

        for (let i = 0; i < parts.length; i++) {

          const pathPart = parts[i]

          location[pathPart] = i === (parts.length - 1)
            ? value
            : {}

          location = location[pathPart]
        }

      } else if (param === 'Key') {

        result.name = value

      } else if (param === 'Body') {

        result.file = value

      } else if (param === 'Delete') {

        result.params.quiet = value.Quiet

        result.names = value.Objects
          .map(({ VersionId: versionId, Key: key }) => {
            return versionId
              ? { versionId, key }
              : key
          })

      } else if (param === 'RequestPayer') {

        result.payer = value

      } else if (param === 'CopySource') {

        result.sourceName = value

      } else if (param === 'Bucket') {

        result.sourceBucket = value

      } else if (Object.keys(queryObjectParamMap).includes(param)) {

        result.query[queryObjectParamMap[param]] = value

      }

    }

    // options
    if (options.meta) {

      result.params.headers['x-oss-meta-medable'] = options.meta

    }

    return result
  }

  static ossResToS3(ossMethod, result) {

    function returnObjectMeta(result) {
      return {
        ContentLength: utils.path(result, 'res.headers.content-length'),
        ContentType: utils.path(result, 'res.headers.content-type'),
        ETag: utils.path(result, 'res.headers.etag')
      }
    }

    switch (ossMethod) {
      case 'head':
        return returnObjectMeta(result)
      case 'put':
        return returnObjectMeta(result)
      case 'putStream':
        return returnObjectMeta(result)
      case 'deleteMulti':
        return {
          Deleted: utils.path(result, 'deleted')
        }
      case 'copy':
        return {
          ETag: utils.path(result, 'data.etag'),
          LastModified: utils.path(result, 'data.lastModified')
        }
      case 'list':
        return {
          Contents: result.objects ? result.objects.map(object => ({
            Key: utils.path(object, 'name'),
            ETag: utils.path(object, 'etag'),
            LastModified: utils.path(object, 'lastModified'),
            Size: utils.path(object, 'size'),
            StorageClass: utils.path(object, 'storageClass'),
            Owner: {
              DisplayName: utils.path(object, 'owner.displayName'),
              ID: utils.path(object, 'owner.id')
            }
          })) : []
        }
      default:
        return result
    }

  }

  get config() {
    return config('isChina') ? {
      ...this._sdk.options,
      secretAccessKey: this._sdk.options.accessKeySecret,
      params: {
        Bucket: this._sdk.options.bucket
      }
    } : this._sdk.config
  }

  get sdk() {
    return this._sdk
  }

  deleteObject(params, callback) {

    if (config('isChina')) {

      const { name, params: ossParams } = StorageApi.s3ParamsToOss(params)

      this._sdk.delete(name, ossParams)
        .then(result => callback && callback(null, StorageApi.ossResToS3('delete', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        name,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.deleteObject(params, callback)

    }

  }

  deleteObjects(params, callback) {

    if (config('isChina')) {

      const { names, params: ossParams } = StorageApi.s3ParamsToOss(params)

      this._sdk.deleteMulti(names, ossParams)
        .then(result => callback && callback(null, StorageApi.ossResToS3('deleteMulti', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        names,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.deleteObjects(params, callback)

    }

  }

  headObject(params, callback) {

    if (config('isChina')) {

      const { name, params: ossParams } = StorageApi.s3ParamsToOss(params)

      this._sdk.head(name, ossParams)
        .then(result => callback && callback(null, StorageApi.ossResToS3('head', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        name,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.headObject(params, callback)

    }

  }

  getObject(params, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback, false)

    if (config('isChina')) {

      const { name, params: ossParams } = StorageApi.s3ParamsToOss(params, options)

      if (options.createReadStream) {

        const readStream = new PassThrough()

        this._sdk.getStream(name, ossParams)
          .then(result => {
            result.stream.pipe(readStream)
            result.stream.on('end', () => readStream.end())
            callback && callback(null, StorageApi.ossResToS3('getStream', result))
          })
          .catch(err => {
            readStream.emit('error', err)
            callback && callback(err)
          })

        return new AWSMockReq({
          name,
          readStream,
          params: ossParams,
          client: this._sdk
        })

      } else {

        this._sdk.get(name, ossParams)
          .then(result => callback && callback(null, StorageApi.ossResToS3('get', result)))
          .catch(err => callback && callback(err))

        return new AWSMockReq({
          name,
          params: ossParams,
          client: this._sdk
        })

      }

    } else {

      return this._sdk.getObject(params, callback)

    }

  }

  listObjects(params, callback) {

    if (config('isChina')) {

      const { query, params: ossParams } = StorageApi.s3ParamsToOss(params)

      this._sdk.list(query, ossParams)
        .then(result => callback && callback(null, StorageApi.ossResToS3('list', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        query,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.listObjects(params, callback)

    }

  }

  copyObject(params, callback) {

    if (config('isChina')) {

      const { name, sourceName, sourceBucket, params: ossParams } = StorageApi.s3ParamsToOss(params),
            args = sourceBucket
              ? [name, sourceName, sourceBucket, ossParams]
              : [name, sourceName, ossParams]

      this._sdk.copy(...args)
        .then(result => callback && callback(null, StorageApi.ossResToS3('copy', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        name,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.copyObject(params, callback)

    }

  }

  putObject(params, callback) {

    if (config('isChina')) {

      const { name, file, params: ossParams } = StorageApi.s3ParamsToOss(params)

      this._sdk.put(name, file, ossParams)
        .then(result => callback && callback(null, StorageApi.ossResToS3('put', result)))
        .catch(err => callback && callback(err))

      return new AWSMockReq({
        name,
        params: ossParams,
        client: this._sdk
      })

    } else {

      return this._sdk.putObject(params, callback)

    }

  }

  upload(params, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    options = Object.assign({ queueSize: 1, partSize: 5 * 1024 * 1024 }, options || {})

    if (config('isChina')) {

      const { name, file, params: ossParams } = StorageApi.s3ParamsToOss(params),
            awsMockReq = new AWSMockReq({
              name,
              params: ossParams,
              client: this._sdk
            })

      if (utils.isReadableStream(file)) {

        this._sdk.putStream(name, file, ossParams)
          .then(result => callback && callback(null, StorageApi.ossResToS3('putStream', result)))
          .catch(err => callback && callback(err))

      } else {

        this._sdk.multipartUpload(name, file, {
          progress: awsMockReq.onProgress,
          parallel: options.queueSize,
          partSize: options.partSize,
          ...ossParams
        })
          .then(result => callback && callback(null, StorageApi.ossResToS3('multipartUpload', result)))
          .catch(err => callback && callback(err))

      }

      return awsMockReq

    } else {

      return this._sdk.upload(params, options, callback)

    }

  }

}

const awsGlobalParams = config('aws')

if (awsGlobalParams) {
  AWS.config.s3 = awsGlobalParams
  AWS.config.sqs = awsGlobalParams
}

/**
 * Storage instances
 */
// eslint-disable-next-line one-var
const internalStorageInstance = new StorageApi({
        region: config('uploads.s3.region'),
        accessKeyId: config('uploads.s3.accessKeyId'),
        secretAccessKey: config('uploads.s3.secretAccessKey'),
        params: {
          Bucket: config('uploads.s3.bucket'),
          ServerSideEncryption: 'AES256'
        }
      }),

      internalUploadInstance = new StorageApi({
        region: config('uploads.s3.region'),
        accessKeyId: config('uploads.s3.accessKeyId'),
        secretAccessKey: config('uploads.s3.secretAccessKey'),
        params: {
          Bucket: config('uploads.s3.uploadBucket'),
          ServerSideEncryption: 'AES256'
        }
      }),

      internalLogInstance = new StorageApi({
        region: config('uploads.s3.region'),
        accessKeyId: config('uploads.s3.accessKeyId'),
        secretAccessKey: config('uploads.s3.secretAccessKey'),
        params: {
          Bucket: config('uploads.s3.logs')
        }
      }),

      internalPublicInstance = new StorageApi({
        region: config('uploads.s3.public.region'),
        accessKeyId: config('uploads.s3.accessKeyId'),
        secretAccessKey: config('uploads.s3.secretAccessKey'),
        params: {
          Bucket: config('uploads.s3.public.bucket')
        }
      })

/**
 * @todo abstract to Location/Driver to abstract all access to pointers.
 */
class S3Location {

  constructor(orgId, s3, options = {}) {

    this._orgId = utils.getIdOrNull(orgId, true)
    this._s3 = s3 instanceof StorageApi
      ? s3
      : new StorageApi(s3)
    this._bucketPrefix = utils.rString(options.prefix, '')
    this._orgPrefix = orgId + '/'
    this._managed = utils.rBool(options.managed, false)
    this._locationType = options.locationType
    this._passive = utils.rBool(options.passive, false)
    this._storageId = options.storageId || consts.storage.availableLocationTypes.medable
    this._readUrlExpiry = utils.clamp(utils.rInt(options.readUrlExpiry, config('uploads.s3.readUrlExpiry')), 5, 604800)
  }

  /**
   * retrieve underlying s3 client for direct operation
   */
  get s3() {
    return this._s3
  }

  get locationType() {
    return this._locationType
  }

  /**
   * retrieve org context identifier
   */
  get orgId() {
    return this._orgId
  }

  get readUrlExpiry() {
    return this._readUrlExpiry
  }

  /**
   * retrieve the bucket prefix for custom locations. this should be used to build keys with every call to the underlying instance.
   */
  get bucketPrefix() {
    return this._bucketPrefix
  }

  /**
   * retrieve the org prefix. this should be used to build keys with every call to the underlying instance.
   */
  get orgPrefix() {
    return this._orgPrefix
  }

  get managed() {
    return this._managed
  }

  /**
   * if true, ignore errors that occur from the endpoint whenever possible.
   * @returns {*}
   */
  get passive() {
    return this._passive
  }

  get storageId() {
    return this._storageId
  }

  get bucket() {
    return this.s3.config.params.Bucket
  }

  get endpoint() {
    // @todo check s3BucketEndpoint
    return this.s3.config.endpoint
  }

  get region() {
    return this.s3.config.region
  }

  get accessKeyId() {
    return this.s3.config.accessKeyId
  }

  get secretAccessKey() {
    return this.s3.config.secretAccessKey
  }

  isInternal() {
    return modules.storage.isInternalStorage(this.locationType, this.storageId)
  }

  /**
   * @param other
   * @param options
   *  matchLocations: true
   *  matchEndpoints: true
   *  matchBuckets: false
   *  matchCredentials: true
   */
  equals(other, options = {}) {

    let equals = other && other instanceof S3Location

    if (equals && utils.rBool(options.matchLocations, true)) {
      equals = this.storageId === other.storageId
    }
    if (equals && utils.rBool(options.matchEndpoints, true)) {
      // @todo this won't work for custom endpoints and we will have to support it proeprtly when we do custom storage for file properties.
      equals = this.endpoint && this.endpoint === other.endpoint
    }
    if (equals && utils.rBool(options.matchBuckets, false)) {
      equals = this.bucket && this.bucket === other.bucket
    }
    if (equals && utils.rBool(options.matchCredentials, true)) {
      equals = this.accessKeyId && this.accessKeyId === other.accessKeyId && this.secretAccessKey && this.secretAccessKey === other.secretAccessKey
    }
    return equals

  }

  /**
   *
   * @param key
   * @param options
   *  includePrefix: true
   * @returns {*}
   */
  buildKey(key, options = {}) {
    const prefix = utils.rBool(options.includePrefix, true) ? this.bucketPrefix + this.orgPrefix : ''
    if (prefix && key.indexOf(prefix) !== 0) {
      return `${prefix}${key}`
    }
    return key
  }

  buildParams(params = {}, options = {}) {

    params = Object.assign({}, params)

    const key = utils.rString(params.Key, '')
    if (key) {
      params.Key = this.buildKey(key, options)
    }

    return params

  }

  /**
   *
   * @param dirPrefix
   * @param options
   *  includePrefix: true
   * @param callback -> err, {deletedCount: Number}
   * @returns {*}
   */
  deleteDir(dirPrefix, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    let hasMore = true,
        nextMarker = null,
        s3Req = null

    const limit = 100,
          request = {
            cancel: () => {
              this.cancelled = true
              if (s3Req) {
                try {
                  s3Req.abort()
                } catch (err) {}
              }
            }
          },
          output = {
            deletedCount: 0
          }

    async.whilst(

      () => hasMore,

      callback => {

        async.retry(
          {
            times: 5,
            interval: retryCount => 50 * Math.pow(2, retryCount),
            errorFilter: () => !request.cancelled
          },
          callback => {
            const params = {
              Marker: nextMarker,
              MaxKeys: limit,
              Prefix: this.buildKey(dirPrefix, options)
            }
            s3Req = this.listObjects(params, (err, result) => {
              s3Req = null
              callback(err, result)
            })
          },
          (err, result) => {
            if (err) {
              return callback(err)
            }
            const keysToDelete = utils.array(result.Contents).map(v => ({ Key: v.Key }))
            hasMore = result.Contents.length > 0
            if (hasMore) {
              nextMarker = result.Contents[result.Contents.length - 1].Key
            }
            if (keysToDelete.length === 0) {
              return callback()
            }
            async.retry(
              {
                times: 5,
                interval: retryCount => 50 * Math.pow(2, retryCount),
                errorFilter: () => !request.cancelled
              },
              callback => {
                const params = {
                  Delete: {
                    Objects: keysToDelete,
                    Quiet: false
                  }
                }
                s3Req = this.deleteObjects(params, (err, data) => {
                  s3Req = null
                  if (!err && data && data.Deleted) {
                    output.deletedCount += utils.rInt(data.Deleted.length, 0)
                  }
                  callback(err)
                })
              },
              callback
            )
          })

      },

      err => {
        if (err && request.cancelled) {
          err = Fault.create('cortex.error.aborted')
        }
        callback(err, output)
      }

    )

    return request

  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @returns {*|ReadStream}
   */
  createReadStream(params, options = {}) {
    return this
      .getObject(params, {
        createReadStream: true,
        ...options
      })
      .createReadStream()
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback -> err, result
   * @returns {*|ReadStream}
   */
  deleteObject(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.deleteObject(this.buildParams(params, options), callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback -> err, result
   * @returns {*|ReadStream}
   */
  deleteObjects(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.deleteObjects(this.buildParams(params, options), callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback -> err, result
   * @returns {*|ReadStream}
   */
  headObject(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.headObject(this.buildParams(params, options), callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback
   * @returns {*|ReadStream}
   */
  getObject(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.getObject(this.buildParams(params, options), options, callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback
   * @returns {*|ReadStream}
   */
  listObjects(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.listObjects(this.buildParams(params, options), callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback -> err, result
   * @returns {*|ReadStream}
   */
  copyObject(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.copyObject(this.buildParams(params, options), callback)
  }

  /**
   *
   * @param params
   * @param options
   *  includePrefix: true
   * @param callback -> err, result
   * @returns {*|ReadStream}
   */
  putObject(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.putObject(this.buildParams(params, options), callback)
  }

  upload(params, options, callback) {
    [options, callback] = utils.resolveOptionsCallback(options, callback, false)
    return this.s3.upload(this.buildParams(params, options), callback)
  }

}

// --------------------------------------------------------

module.exports = {

  S3Location: S3Location,

  newSQSInstance: function(options) {
    return new AWS['SQS'](options)
  },

  getInternalLogInstance: function() {
    return internalLogInstance
  },

  getInternalStorageInstance: function() {
    return internalStorageInstance
  },

  getInternalPublicInstance: function() {
    return internalPublicInstance
  },

  getInternalUploadInstance: function() {
    return internalUploadInstance
  },

  getLocationSync: function(ac, locationType, storageId = consts.storage.availableLocationTypes.medable) {
    return _getLocation(ac.org, locationType, storageId)

  },

  getLocation: function(org, locationType, storageId = consts.storage.availableLocationTypes.medable, callback = () => {}) {
    const orgId = utils.getIdOrNull(org, true),
          readUrlExpiry = org?.configuration?.storage?.defaultS3ReadUrlExpiry || config('uploads.s3.readUrlExpiry'),
          isInternal = storageId === consts.storage.availableLocationTypes.medable,
          isPublic = storageId === consts.storage.availableLocationTypes.public

    if (!orgId) {
      setImmediate(callback, Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid aws-s3 location organization identifier.' }))
    } else if (isInternal && (locationType === consts.LocationTypes.AwsS3 || locationType === consts.LocationTypes.UploadObject)) {
      setImmediate(callback, null, new S3Location(orgId, this.getInternalStorageInstance(), { managed: true, locationType, readUrlExpiry }))
    } else if (isInternal && locationType === consts.LocationTypes.AwsS3Upload) {
      setImmediate(callback, null, new S3Location(orgId, this.getInternalUploadInstance(), { managed: true, locationType, readUrlExpiry }))
    } else if (isPublic) {
      setImmediate(callback, null, new S3Location(orgId, internalPublicInstance, { managed: true, locationType }))
    } else {
      Org.loadOrg(org, (err, org) => {
        let locationObject = null
        if (!err) {
          try {
            locationObject = _getLocation(org, locationType, storageId)
          } catch (e) {
            err = e
          }
        }
        callback(err, locationObject)
      })
    }
  }
}

function _getLocation(org, locationType, storageId) {

  const isInternal = storageId === consts.storage.availableLocationTypes.medable,
        isPublic = storageId === consts.storage.availableLocationTypes.public,
        readUrlExpiry = org.configuration.storage.defaultS3ReadUrlExpiry || config('uploads.s3.readUrlExpiry'),
        managed = true

  if (isInternal && (locationType === consts.LocationTypes.AwsS3 || locationType === consts.LocationTypes.UploadObject)) {

    return new S3Location(org._id, internalStorageInstance, { managed, readUrlExpiry, storageId, locationType })

  } else if (isInternal && locationType === consts.LocationTypes.AwsS3Upload) {

    return new S3Location(org._id, internalUploadInstance, { managed, readUrlExpiry, storageId, locationType })

  } else if (isInternal) {

    throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid internal storage location` }) // @todo support others

  } else if (isPublic) {
    return new S3Location(org._id, internalPublicInstance, { managed, readUrlExpiry, storageId, locationType })
  } else {

    const locationData = org.configuration.storage.locations.find(v => v.name === storageId)
    if (!locationData) {

      throw Fault.create('cortex.notFound.storage', { path: storageId })

    } else if (!['aws-s3', 's3-endpoint'].includes(locationData.type)) {

      throw Fault.create('cortex.invalidArgument.unspecified', { reason: `Invalid storage location for type (${locationData.type}).` }) // @todo support others

    } else {

      const s3Config = {
              accessKeyId: locationData.accessKeyId,
              secretAccessKey: locationData.secretAccessKey,
              params: {
                Bucket: locationData.bucket,
                ServerSideEncryption: 'AES256'
              }
            },
            locationOptions = {
              prefix: locationData.prefix,
              managed: locationData.managed,
              passive: locationData.passive,
              readUrlExpiry: locationData.readUrlExpiry || readUrlExpiry,
              storageId,
              locationType
            }

      if (locationData.type === 'aws-s3') {
        s3Config.region = locationData.region
      } else if (locationData.type === 's3-endpoint') {
        s3Config.endpoint = new AWS.Endpoint(locationData.endpoint)
        s3Config.s3BucketEndpoint = true
        if (locationData.ca) {
          s3Config.httpOptions = { agent: new https.Agent({
            rejectUnauthorized: true,
            ca: locationData.ca
          }) }
        }
        if (config('debug.insecureS3Endpoints')) {
          s3Config.httpOptions = { agent: new https.Agent({ rejectUnauthorized: false }) }
        }
      }

      return new S3Location(org._id, s3Config, locationOptions)
    }
  }

}
