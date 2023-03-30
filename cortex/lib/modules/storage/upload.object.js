'use strict'

const AwsS3Pointer = require('./aws.s3'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../access-principal'),
      consts = require('../../consts'),
      modules = require('../../modules')

/**
 * For use exclusively as input for other file operations.
 */
class UploadObjectPointer extends AwsS3Pointer {

  constructor(node, entry, ac) {

    super(node, entry, ac)
    this.storageId = consts.storage.availableLocationTypes.medable

  }

  isUploadPointer() {
    return true
  }

  getLocationType() {
    return consts.LocationTypes.UploadObject
  }

  delete(callback = () => {}) {

    const orgId = this.getMeta('orgId'), uploadId = this.getMeta('uploadId')

    if (!(orgId && uploadId)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'upload id not present.' }))
    }

    modules.db.models.org.loadOrg(orgId, function(err, org) {
      if (err) {
        return callback(err)
      }
      modules.db.models.upload.aclDelete(ap.synthesizeAnonymous(org), uploadId, { override: true }, err => {
        callback(err)
      })
    })
  }

}

module.exports = UploadObjectPointer
