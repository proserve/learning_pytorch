'use strict'

const modules = require('../../../lib/modules'),
      consts = require('../../../lib/consts'),
      should = require('should')

describe('Issues - CTXAPI-1870 - signed url expiry ', function() {

  it('should not fail if the org has storage configuration defined', async() => {
    const org = await modules.db.models.org.loadOrg('medable')
    org.configuration.storage.defaultS3ReadUrlExpiry = 1200 // Default is 900
    should.exist(org.configuration.storage)

    return new Promise((resolve, reject) => {
      modules.aws.getLocation(org, consts.LocationTypes.AwsS3, consts.storage.availableLocationTypes.medable, (err, locationObject) => {
        should.not.exist(err)
        should.exist(locationObject)
        should.equal(locationObject._readUrlExpiry, 1200)
        should.equal(locationObject instanceof modules.aws.S3Location, true)
        resolve()
      })
    })
  })

  it('should fail with cortex.invalidArgument.unspecified if org is not provided', async() => {

    return new Promise((resolve, reject) => {
      modules.aws.getLocation(null, consts.LocationTypes.AwsS3, consts.storage.availableLocationTypes.medable, (err, locationObject) => {
        should.exist(err)
        should.equal(err.errCode, 'cortex.invalidArgument.unspecified')
        resolve()
      })
    })
  })

  it('should fallback to config if org.configuration is not defined (pass only org._id)', async() => {

    const org = await modules.db.models.org.loadOrg('medable')

    return new Promise((resolve, reject) => {
      modules.aws.getLocation({ _id: org._id }, consts.LocationTypes.AwsS3, consts.storage.availableLocationTypes.medable, (err, locationObject) => {
        should.not.exist(err)
        should.exist(locationObject)
        should.equal(locationObject._readUrlExpiry, 900)
        should.equal(locationObject instanceof modules.aws.S3Location, true)
        resolve()
      })
    })
  })

})
