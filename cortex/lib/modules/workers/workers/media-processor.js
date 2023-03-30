'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      acl = require('../../../acl'),
      ap = require('../../../access-principal'),
      modules = require('../../../modules'),
      consts = require('../../../consts'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      Post = modules.db.models.Post,
      Comment = modules.db.models.Comment,
      Org = modules.db.models.Org,

      // Alibaba Cloud OSS Bucket Event Notifications must have unique names within a project
      // so the deployment context is appended to the end of the Notification ID (eg ObjectCreated-platform)
      AcceptedNames = /^(9ccb3fad-f77e-47e8-a022-0a0b09a4c50a|ObjectCreated(-[a-z0-9]+)?|ObectCreated)$/i

function MediaProcessorWorker() {
  Worker.call(this)
}

util.inherits(MediaProcessorWorker, Worker)

MediaProcessorWorker.sqsMapper = function(event) {

  const mediaProcessorCondition = config('isChina')

    ? utils.path(event, 'data.events.0.oss.bucket.name') === config('uploads.s3.uploadBucket') &&
          ['ObjectCreated:PostObject', 'ObjectCreated:PutObject', 'ObjectCreated:CompleteMultipartUpload'].includes(utils.path(event, 'data.events.0.eventName')) &&
          AcceptedNames.test(utils.path(event, 'data.events.0.oss.ruleId'))

    : utils.path(event, 'data.Records.0.s3.bucket.name') === config('uploads.s3.uploadBucket') &&
          ['ObjectCreated:Post', 'ObjectCreated:Put', 'ObjectCreated:CompleteMultipartUpload'].includes(utils.path(event, 'data.Records.0.eventName')) &&
          AcceptedNames.test(utils.path(event, 'data.Records.0.s3.configurationId'))

  return mediaProcessorCondition
    ? 'media-processor'
    : null

}

MediaProcessorWorker.prototype._process = function(message, payload, options, callback) {

  if (payload && (['file', 'facet'].includes(payload.level) && payload.key)) {
    this._processKey(message, payload, options, callback)
  } else {
    this._processSqs(message, payload, options, callback)
  }

}

MediaProcessorWorker.prototype._processSqs = function(message, payload, options, callback) {

  // the payload should contain Records (or events if Alibaba). extract interesting information from these and run them as straight locations.

  const payloads = config('isChina')
    ? utils.array(utils.path(payload, 'events')).map(record => ({
      key: utils.path(record, 'oss.object.key'),
      size: utils.path(record, 'oss.object.size'),
      level: 'facet'
    }))

    : utils.array(utils.path(payload, 'Records')).map(record => ({
      key: utils.path(record, 's3.object.key'),
      size: utils.path(record, 's3.object.size'),
      level: 'facet'
    }))

  async.eachSeries(payloads, (payload, callback) => {
    if (payload.size > 0) {
      this._processKey(message, payload, options, callback)
    } else {
      callback()
    }
  }, callback)
}

MediaProcessorWorker.prototype._processKey = function(message, payload, options, callback) {

  // extract the location.
  let fullpath = utils.normalizeObjectPath(String(utils.path(payload, 'key')).replace(/\//g, '.')),
      parts = fullpath.split(/[.]{1,}/), // accept / or ., skipping doubles.
      level = utils.option(payload, 'level', 'file'),
      orgCodeOrId = parts[0],
      objectId = utils.getIdOrNull(parts[1]),
      contextId = utils.getIdOrNull(parts[2]),
      uploadFilenameParts = level === 'facet' ? parts.slice(-2) : null,
      uploadFilename = uploadFilenameParts ? uploadFilenameParts.join('.') : null,
      uploadId = uploadFilenameParts ? utils.getIdOrNull(uploadFilenameParts[0]) : null,
      propertyPathParts = parts.slice(3, parts.length - (level === 'facet' ? 2 : 0)),
      propertyPath = propertyPathParts.join('.'),
      theOrg

  async.waterfall([

    // load the org
    function(callback) {
      Org.loadOrg(orgCodeOrId, callback)
    },

    // create the object and find it's file property.
    function(org, callback) {

      theOrg = org

      // all this is done with override access, so any old principal will do.
      const principal = ap.synthesizeAnonymous(org)

      // find the native model (post and comment only, so far).
      if (utils.equalIds(objectId, consts.NativeObjects.post)) {
        return Post.postReadOne(principal, contextId, { skipTargeting: true, skipAcl: true, override: true, json: false, paths: ['_id', propertyPath] }, function(err, doc, ac) {
          if (err && err.code === 'kNotFound') err = doc = ac = null
          callback(err, doc, ac)
        })
      } else if (utils.equalIds(objectId, consts.NativeObjects.comment)) {
        return Post.postReadOne(principal, contextId, { skipTargeting: true, skipAcl: true, override: true, isComment: true, hooks: false, json: false, paths: ['_id'] }, function(err, doc, pac) {
          if (err && err.code === 'kNotFound') err = doc = pac = null
          if (err || !doc) {
            callback(err, doc, pac)
          } else {
            Comment.commentReadOne(pac, contextId, { override: true, hooks: false, json: false, paths: ['_id', propertyPath] }, function(err, doc, cac) {
              if (err && err.code === 'kNotFound') err = doc = pac = cac = null
              callback(err, doc, cac)
            })
          }
        })
      }

      org.createObject(objectId, function(err, model) {
        if (err) {
          callback(err)
        } else {
          model.aclReadOne(principal, contextId, { skipAcl: true, override: true, throwNotFound: false, hooks: false, json: false, paths: ['_id', propertyPath] }, function(err, doc, ac) {
            if (err && err.code === 'kNotFound') err = doc = ac = null
            callback(err, doc, ac)
          })
        }
      })
    },

    // look for what needs to be processed.
    function(document, ac, callback) {

      let key = payload.key

      const file = utils.digIntoResolved(document, propertyPath, true, true),
            location = modules.aws.getLocationSync(ac, consts.LocationTypes.AwsS3Upload, consts.storage.availableLocationTypes.medable),
            node = document.discernNode(propertyPath)

      // if the property no longer exists, delete all file uploads.
      if (!file) {
        if (uploadFilename) {
          key = key.substr(0, key.length - ('/' + uploadFilename).length) // remove the uploadFilename from the key to delete the whole folder
        }

        const params = {
          Prefix: key
        }

        location.listObjects(params, function(err, results) {
          if (!err) {
            const objects = utils.array(utils.path(results, 'Contents')).map(function(object) { return { Key: object.Key } })
            if (objects.length === 0) {
              return callback()
            }
            location.deleteObjects({ Delete: { Quiet: true, Objects: objects } }, function(err) {
              if (err) logger.error('failed to delete upload (' + key + ')', err.toJSON())
              callback()
            })
          }
        })
        return
      }

      // ensure we have a file, node, and processor.
      if (!file || !node) {
        callback(Fault.create('cortex.notFound.propertyNode', { path: fullpath }))
        return
      }

      // if the upload no longer exists in the file, delete it.
      if (uploadId && !_.some(utils.array(file.sources), function(source) { return utils.equalIds(source.pid, uploadId) })) {
        location.deleteObject({ Key: key }, function(err) {
          if (err) logger.error('failed to delete upload (' + key + ')', err.toJSON())
          callback()
        })
        return
      }

      // assume that buffers only have one facet
      // any other way to know that its a buffer?
      if (file.sources && (file.sources.length === 1)) {
        let singleFacet = file.sources[0]

        // checking if it has etag to make sure its been uploaded
        if (singleFacet.ETag) {
          uploadId = singleFacet.pid
        }
      }

      node.processFile(ac, document, propertyPath, file, uploadId, uploadFilename, callback)
    }

  ], function(err) {

    if (err && theOrg) {
      err.trace = err.trace || 'Error\n\tnative media:0'
      const principal = ap.synthesizeAnonymous(theOrg)
      modules.db.models.Log.logApiErr(
        'api',
        err,
        new acl.AccessContext(principal, null, { req: message.req })
      )
    }
    err = theOrg = null

    // log errors but don't retry!
    callback(err)

  })

}

module.exports = MediaProcessorWorker
