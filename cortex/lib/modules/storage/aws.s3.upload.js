'use strict'

/*

@todo create a PointerCopier class or something so pointers can do special handling.

for example, we have a case where a file that runs through a passthru processor can just be copied from the upload bucket
right to the storage bucket.

*/

const _ = require('underscore'),
      AwsS3Pointer = require('./aws.s3'),
      config = require('cortex-service/lib/config'),
      moment = require('moment'),
      mime = require('mime'),
      crypto = require('crypto'),
      Fault = require('cortex-service/lib/fault'),
      utils = require('../../utils'),
      modules = require('../../modules'),
      consts = require('../../consts')

/**
 * For use exclusively as input for other file operations.
 */
class AwsS3UploadPointer extends AwsS3Pointer {

  constructor(node, entry, ac) {

    super(node, entry, ac)
    this.storageId = consts.storage.availableLocationTypes.medable

    this.upload = {
      date: utils.path(entry, 'upload.date'),
      policy: utils.path(entry, 'upload.policy'),
      signature: utils.path(entry, 'upload.signature'),
      maxFileSize: utils.path(entry, 'upload.maxFileSize')
    }

  }

  _doWrite(pointer, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)
    setImmediate(callback, Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'writing to uploads is unsupported' }))

  }

  url(options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)
    setImmediate(callback, Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'reading from uploads is unsupported' }))

  }

  isUploadPointer() {
    return true
  }

  getLocationType() {
    return consts.LocationTypes.AwsS3Upload
  }

  aclRead(principal, { skipAcl = false } = {}) {

    void principal
    void skipAcl

    const location = modules.aws.getLocationSync(this.ac, consts.LocationTypes.AwsS3Upload, consts.storage.availableLocationTypes.medable),
          contentType = this.mime || 'application/octet-stream', // note the use of prop instead of async getter.
          out = {
            state: this.state,
            location: this.getLocationType(),
            storageId: this.storageId,
            filename: this.filename,
            name: this.name,
            uploadMethod: 'post',
            uploadKey: 'file',
            maxFileSize: this.upload.maxFileSize,
            uploadUrl: this.getUploadUrl(location),
            fields: [
              { key: 'success_action_status', value: '201' },
              { key: 'key', value: this.getMeta('awsId') },
              { key: 'policy', value: this.upload.policy },
              ...(config('isChina') ? [
                { key: 'OSSAccessKeyId', value: location.accessKeyId },
                { key: 'Signature', value: this.upload.signature },
                { key: 'x-oss-server-side-encryption', value: 'AES256' },
                { key: 'x-oss-content-type', value: contentType }
              ] : [
                { key: 'content-type', value: contentType },
                {
                  key: 'x-amz-credential',
                  value: `${location.accessKeyId}/${this.upload.date.substr(0, 8)}/${location.region}/s3/aws4_request`
                },
                { key: 'x-amz-date', value: this.upload.date },
                { key: 'x-amz-server-side-encryption', value: 'AES256' },
                { key: 'x-amz-signature', value: this.upload.signature },
                { key: 'x-amz-algorithm', value: 'AWS4-HMAC-SHA256' }
              ])
            ]
          }

    if (config('__is_mocha_test__')) {
      let server = require('../../../test/lib/server')
      if (config('isChina')) {
        out.fields.push({ 'x-oss-meta-__mocha_test_uuid__': server.__mocha_test_uuid__ })
        out.fields.push({ 'x-oss-meta-mochaCurrentTestUuid': server.mochaCurrentTestUuid })
      } else {
        out.fields.push({ 'x-amz-meta-__mocha_test_uuid__': server.__mocha_test_uuid__ })
        out.fields.push({ 'x-amz-meta-mochaCurrentTestUuid': server.mochaCurrentTestUuid })
      }
    }

    if (this.fault) {
      out.fault = this.fault
    }
    return out

  }

  getUploadUrl(location) {
    if (config('isChina')) {
      return `https://${location.bucket}.${location.region}.aliyuncs.com`
    }
    return config('aws.endpoint') ? `${config('aws.endpoint')}/${location.bucket}`
      : `https://${location.bucket}.s3.${location.region}.amazonaws.com`
  }

  info(callback) {

    let info = null
    if (_.isFunction(callback)) {
      AwsS3Pointer.prototype.info.call(this, (err, info) => {
        if (!err) {
          info.upload = {
            date: this.upload.date,
            policy: this.upload.policy,
            signature: this.upload.signature,
            maxFileSize: this.upload.maxFileSize
          }
        }
        callback(err, info)
      })
    } else {
      info = AwsS3Pointer.prototype.info.call(this)
      info.upload = {
        date: this.upload.date,
        policy: this.upload.policy,
        signature: this.upload.signature,
        maxFileSize: this.upload.maxFileSize
      }
    }
    return info
  }

  refreshUpload(ac, node, document, maxFileSize) {

    this.upload = AwsS3UploadPointer.createUpload(ac, this.getMeta('awsId'), maxFileSize, this.mime)
    return this.upload

  }

  static createUpload(ac, awsFileName, maxFileSize, contentType) {

    const location = modules.aws.getLocationSync(ac, consts.LocationTypes.AwsS3Upload, consts.storage.availableLocationTypes.medable),
          expiry = utils.rInt(
            utils.path(ac, 'req.orgClient.authDuration'),
            utils.path(ac, 'req.session') ? config('sessions.authDuration') : config('uploads.s3.uploadExpiry')
          ) * 1000,
          timestamp = new Date().getTime(),
          dateYmd = moment(timestamp).utc().format('YYYYMMDD'),
          dateIso = moment(timestamp).utc().format('YYYYMMDDTHHmmss') + 'Z',
          dateExpires = moment(timestamp + expiry).utc().toISOString(),
          policy = {
            expiration: dateExpires,
            conditions: [
              { bucket: location.bucket },
              { key: location.buildKey(awsFileName, { includePrefix: false }) },
              ['content-length-range', 0, maxFileSize],
              { 'content-type': contentType },
              { 'success_action_status': '201' },
              ...(config('isChina') ? [
                { 'OSSAccessKeyId': location.accessKeyId },
                { 'x-oss-server-side-encryption': 'AES256' }
              ] : [
                { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
                { 'x-amz-credential': `${location.accessKeyId}/${dateYmd}/${location.region}/s3/aws4_request` },
                { 'x-amz-date': dateIso },
                { 'x-amz-server-side-encryption': 'AES256' }
              ])
            ]
          }

    if (config('__is_mocha_test__')) {
      let server = require('../../../test/lib/server')
      if (config('isChina')) {
        policy.conditions.push({ 'x-oss-meta-__mocha_test_uuid__': server.__mocha_test_uuid__ })
        policy.conditions.push({ 'x-oss-meta-mochaCurrentTestUuid': server.mochaCurrentTestUuid })
      } else {
        policy.conditions.push({ 'x-amz-meta-__mocha_test_uuid__': server.__mocha_test_uuid__ })
        policy.conditions.push({ 'x-amz-meta-mochaCurrentTestUuid': server.mochaCurrentTestUuid })
      }
    }

    let signature,
        base64Policy = Buffer.from(JSON.stringify(policy), 'utf8').toString('base64')

    if (config('isChina')) {

      const hmac = crypto.createHmac('sha1', location.secretAccessKey)
      hmac.update(base64Policy)
      signature = Buffer.from(hmac.digest()).toString('base64')

    } else {
      let a, b, c, d, e

      a = crypto.createHmac('sha256', 'AWS4' + location.secretAccessKey)
      a.write(dateYmd)
      a.end()
      b = crypto.createHmac('sha256', a.read())
      b.write(location.region)
      b.end()
      c = crypto.createHmac('sha256', b.read())
      c.write('s3')
      c.end()
      d = crypto.createHmac('sha256', c.read())
      d.write('aws4_request')
      d.end()
      e = crypto.createHmac('sha256', d.read())
      e.write(Buffer.from(base64Policy, 'utf-8'))
      e.end()

      signature = e.read().toString('hex')
    }

    return {
      date: dateIso,
      policy: base64Policy,
      signature: ac.dryRun ? 'dryRun' : signature,
      maxFileSize: maxFileSize
    }

  }

  static generate(ac, node, rootDocument, propertyPath, name, filename, maxFileSize, contentType) {

    const facetId = utils.createId(),
          location = modules.aws.getLocationSync(ac, consts.LocationTypes.AwsS3Upload, consts.storage.availableLocationTypes.medable),
          awsFileName = location.buildKey(
            rootDocument.constructor.objectId + '/' + rootDocument._id + '.' + propertyPath + '/' + facetId + '.' + (mime.extension(contentType) || 'dat')
          ),
          pointer = new AwsS3UploadPointer(node, {
            pid: facetId,
            creator: ac.principalId,
            name: name,
            private: true,
            filename: filename,
            location: consts.LocationTypes.AwsS3Upload,
            storageId: consts.storage.availableLocationTypes.medable,
            state: consts.media.states.pending,
            mime: contentType,
            upload: AwsS3UploadPointer.createUpload(ac, awsFileName, maxFileSize, contentType)
          }, ac)

    return pointer.setMeta('awsId', awsFileName)

  }

}

module.exports = AwsS3UploadPointer
