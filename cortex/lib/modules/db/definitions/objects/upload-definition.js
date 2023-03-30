'use strict'

const acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      modules = require('../../../../modules'),
      util = require('util'),
      mississippi = require('mississippi'),
      { createId, resolveOptionsCallback, rInt, path: pathTo, isId, promised } = require('../../../../utils'),
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      local = {
        _definitions: null
      }

Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('../index'))) } })

function UploadDefinition(options) {

  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(UploadDefinition, BuiltinContextModelDefinition)

UploadDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = UploadDefinition.statics
  options.methods = UploadDefinition.methods
  options.indexes = UploadDefinition.indexes
  options.options = { collection: UploadDefinition.collection }
  options.apiHooks = UploadDefinition.apiHooks

  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

UploadDefinition.collection = 'contexts'

UploadDefinition.prototype.getNativeOptions = function() {
  return {
    _id: consts.NativeModels.upload,
    objectLabel: 'Upload',
    objectName: 'upload',
    pluralName: 'uploads',
    collection: 'contexts',
    isExtensible: false,
    isFavoritable: false,
    defaultAclOverride: false,
    defaultAclExtend: false,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: false,
    allowConnectionsOverride: false,
    allowConnectionOptionsOverride: false,
    defaultAcl: [
      { type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }
    ],
    createAcl: [],
    createAclOverwrite: false,
    createAclExtend: false,
    shareChain: [acl.AccessLevels.Connected],
    properties: [
      {
        _id: consts.Properties.Files.Ids.Upload.Data,
        label: 'Data',
        name: 'dataFile',
        type: 'File',
        urlExpirySeconds: config('uploads.s3.readUrlExpiry')
      },
      {
        label: 'Expires At',
        name: 'expiresAt',
        type: 'Date'
      }
    ]
  }
}

// shared statics --------------------------------------------------------

UploadDefinition.statics = {

  /**
   *
   * @param principal
   * @param stream required readable stream.
   * @param contentFilename
   * @param contentType required.
   * @param contentEncoding optional. default null
   * @param processor
   * @param options
   *  maxFileSize: defaults to 10 megs. overrides processor options.
   *  uploadId: assign an object id in advance.
   *
   * @param callback
   */
  createUpload: function createUpload(principal, stream, contentFilename, contentType, contentEncoding, processor, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    let awsUploadObject = null

    const maxFileSize = Math.min(
            config('uploads.upperMaxSize'),
            rInt(
              rInt(
                options.maxFileSize,
                pathTo(processor, 'maxFileSize')
              ),
              config('uploads.defaultMaxSize')
            )
          ),
          request = {
            cancel: function(err) {
              this.cancelled = true
              this.err = err
              if (awsUploadObject) {
                awsUploadObject.abort()
              }
            }
          }

    Promise.resolve(null)
      .then(async() => {

        let ac, key = null, pointer = null, sz = 0, uploadErr, transformer, uploadOptions

        // create a file to accept the upload stream
        ac = (await promised(
          this,
          'aclCreate',
          principal,
          {},
          {
            bypassCreateAcl: true,
            forceAllowCreate: true,
            beforeWrite: function(ac, payload, callback) {

              const upload = ac.subject,
                    dataNode = ac.object.schema.node.findNode('dataFile'),
                    facetId = createId(),
                    facet = {
                      pid: facetId,
                      creator: ac.principal._id,
                      private: false,
                      name: 'content',
                      mime: contentType,
                      _pi: dataNode._id,
                      _kl: false,
                      _up: new Date(),
                      filename: contentFilename,
                      location: consts.LocationTypes.UploadObject,
                      storageId: processor?.storageId || consts.storage.availableLocationTypes.medable,
                      state: consts.media.states.pending
                    }

              if (isId(options.uploadId)) {
                upload._id = options.uploadId
              }

              pointer = modules.storage.create(dataNode, facet, ac)

              pointer.generatePropertyFileKey(upload, 'dataFile', facetId, contentType, (err, key_) => {

                if (!err) {

                  key = key_

                  facet.meta = [{
                    name: 'awsId',
                    value: key,
                    pub: false
                  }, {
                    name: 'orgId',
                    value: ac.orgId,
                    pub: false
                  }, {
                    name: 'uploadId',
                    value: upload._id,
                    pub: false
                  }]

                  upload.facets = [facet]
                  upload.dataFile = {
                    creator: principal._id,
                    facets: [facetId],
                    sources: []
                  }
                  upload.expiresAt = new Date(Date.now() + (1000 * 86400))
                }
                callback(err)
              })
            }
          }
        )).ac

        if (request.err) {
          try {
            await promised(this, 'aclDelete', principal, ac.subjectId, { override: true })
          } catch (err) {
            void err
          }
          throw request.err
        }

        // create a transform stream that will detect a request that's too large and abort the upload.
        transformer = mississippi.through((data, enc, callback) => {
          sz += data.length
          if (sz > maxFileSize) {
            uploadErr = Fault.create('cortex.tooLarge.unspecified', { resource: ac.getResource() })
            awsUploadObject.abort()
          }
          callback(uploadErr, data)
        })

        // pipe the incoming stream to the transform and upload the transform so we can catch upstream size violations.
        stream.pipe(transformer)

        await new Promise((resolve, reject) => {

          uploadOptions = {
            Key: key,
            Body: transformer,
            ContentType: contentType,
            CacheControl: 'no-cache, no-store, private'
          }
          if (contentEncoding) {
            uploadOptions.ContentEncoding = contentEncoding
          }

          awsUploadObject = modules.aws.getInternalStorageInstance().upload(uploadOptions, { queueSize: 1, partSize: 5 * 1024 * 1024 }, (err, data) => {

            err = request.err || uploadErr || err
            if (err) {
              this.aclDelete(principal, ac.subjectId, () => {
                reject(err)
              })
            } else {
              const facet = ac.subject.facets[0]
              facet.ETag = data.ETag.replace(/"/g, '')
              facet.size = sz
              facet.state = consts.media.states.ready
              ac.subject.markModified('facets')
              ac.lowLevelUpdate(err => {
                if (err) {
                  reject(err)
                } else {
                  if (modules.storage.isInternallyStoredFacet(facet)) {
                    const { size, _pi } = facet,
                          { object, type } = ac.subject,
                          { Stat } = modules.db.models
                    Stat.addRemoveFacet(ac.orgId, Stat.getDocumentSource(ac.subject), object, type, _pi, 1, size)
                  }
                  resolve(ac)
                }
              })
            }

          })

          awsUploadObject.on('httpUploadProgress', info => {
            logger.silly(`[upload] ${ac.subjectId} upload progress`, info)
          })

        })

        return ac

      })
      .then(ac => callback(null, ac))
      .catch(err => callback(err))

    return request

  }

}

// indexes ---------------------------------------------------------------

UploadDefinition.indexes = [

]

// uploads --------------------------------------------------------

module.exports = UploadDefinition
