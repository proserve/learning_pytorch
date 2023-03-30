'use strict'

const Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      utils = require('../utils'),
      { promised, resolveOptionsCallback } = utils,
      consts = require('../consts'),
      acl = require('../acl'),
      async = require('async'),
      modules = require('./')
/*
 * @todo implement maximum number of locations per user? this could help in instances where browser cookies don't work.
 */

let Undefined

class LocationsModule {

  constructor() {

    return LocationsModule
  }

  static sendLocationVerification(locale, principal, location, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    modules.db.models.account.findOne({ _id: principal._id }).select('mobile').lean().exec((err, doc) => {

      if ((!err && !doc) || !doc.mobile) {
        err = Fault.create('cortex.notFound.property', { path: 'mobile', reason: 'Two-factor authentication is not available for this account.' })
      }
      if (err) {
        return callback(err)
      }
      // because we have a short token length, it's very possible to have duplicates. check for dupes.
      let tries = 0, maxTries = 100
      function createVerificationCallback(userId, email, location, callback) {

        let token = ''
        for (let i = 0; i < config('callbacks.smsLength'); ++i) {
          token += modules.authentication.randomInt(1, 9)
        }
        modules.db.models.callback.createCallback(principal.org, consts.callbacks.ver_location, userId, email, { clientKey: options.clientKey, targetId: userId, allowDuplicates: false, includeUserDataInDuplicateCheck: true, token: token, expiresMs: config('callbacks.smsExpiry'), data: { locationId: location._id } }, function(err, callbackObject) {
          if (err && err.errCode === 'cortex.conflict.duplicateKey') {
            if (tries++ >= maxTries) {
              logger.error('too many duplicate tokens, giving up...')
              callback(Fault.create('cortex.conflict.duplicateKey', { reason: 'Failed to produce a unique verification token.' }))
            } else {
              logger.debug('duplicate location verification token generated, trying again...')
              createVerificationCallback(userId, email, location, callback)
            }
          } else {
            callback(err, callbackObject)
          }
        })
      }

      modules.db.models.callback.deleteMany({ handler: consts.callbacks.ver_location, targetId: principal._id, 'data.locationId': location._id }, function(err) {
        if (err) logger.error('sendLocationVerification() removing other tokens' + err)
        createVerificationCallback(principal._id, principal.email, location, function(err, callbackObject) {
          if (!err) {
            try {
              principal.org.sendNotification('LocationVerification', {
                account: principal,
                locale: locale,
                variables: {
                  code: callbackObject.token
                },
                priority: 100 // 2fa is pretty high priority and gated for volume.
              })
            } catch (e) {}
          }
          callback(err, callbackObject)
        })
      })

    })

  }

  /**
     *
     * @param req
     * @param fingerprint
     * @param locationInfo
     * {
         *      iosNotificationToken: String,
         *      gcmRegistrationId: String,
         *      fcmRegistrationToken: String,
         *      tpnsRegistrationToken: String,
         *      locationName: optional location name for new locations.
         *      verificationToken: optional. a verification token,
         *      singleUse: optional. verify this location for a single session (only used with verificationToken option)
         * }
     * @param principal
     * @param callback
     * @return {*}
     */
  static handleLocationLogin(req, fingerprint, locationInfo, principal, callback) {

    // bypass location activation for testing.
    const bypassThese = utils.array(utils.path(req.org, 'configuration.email.locationBypass')).map(v => String(v).toLowerCase()),
          bypassActivation = bypassThese.includes(principal.email) || bypassThese.includes('*')

    locationInfo = utils.extend({
      verificationToken: null
    }, locationInfo, {
      bypassActivation: bypassActivation,
      updateLastLogin: true,
      req: req })

    modules.db.models.location.findOrCreateLocation(principal, req.orgClient.key, fingerprint, locationInfo, function(err, result) {

      if (err) {
        return callback(err)
      }

      const { location, isNew } = result || {},
            clientMismatch = location.client !== req.orgClient.key

      if (location) {
        req.log.lid = location._id
      }

      // if new exit with error.
      if (isNew) {

        const ac = new acl.AccessContext(principal, null, { req: req }),
              metadata = bypassActivation ? { bypassed: true } : Undefined

        modules.audit.recordEvent(ac, 'authentication', 'device', { context: { _id: location._id, object: 'location' }, metadata })

        if (!bypassActivation) {
          LocationsModule.sendLocationVerification(req.locale, principal, location, { clientKey: req.orgClient.key }, function(err) {
            callback(err || Fault.create('cortex.success.newLocation'))
          })
          return
        }
      }

      async.waterfall([

        function(callback) {

          // When a client has switched up apiKeys, trigger device verification.
          if (location.state === 'verified' && clientMismatch) {
            location.state = 'unverified'
          }
          callback()

        },

        function(callback) {
          switch (location.state) {
            case 'verified':
              callback(null, true)
              break
            case 'revoked':
              callback(Fault.create('cortex.accessDenied.locationAccessRevoked'))
              break
            case 'unverified':
              callback(null, false)
              break
            default:
              callback(Fault.create('cortex.error.unspecified', { reason: `unhandled location state ${location.state}` }))
              break
          }
        },

        // unverified location
        function(verified, callback) {

          // skip this step if already verified.
          if (verified || bypassActivation) {
            callback()
            return
          }

          if (locationInfo.verificationToken) {

            logger.silly('location login. processing verification.')
            LocationsModule.verifyLocation(location, locationInfo, principal, function(err) {
              callback(err)
            })

          } else {

            modules.db.models.callback.find({ handler: consts.callbacks.ver_location, targetId: principal._id, 'data.locationId': location._id }, function(err, callbacks) {
              let resend = true
              if (err) {
                logger.error('looking up existing callbacks unverified location: ' + (err.stack || err))
              } else {
                callbacks.forEach(function(doc) {
                  if (!doc.expired) {
                    resend = false
                  }
                })
              }
              if (resend) {
                LocationsModule.sendLocationVerification(req.locale, principal, location, { clientKey: req.orgClient.key }, function(err) {
                  callback(err || Fault.create(clientMismatch ? 'cortex.accessDenied.locationClientMismatch' : 'cortex.success.newLocation'))
                })
              } else {
                callback(Fault.create('cortex.accessDenied.unverifiedLocation'))
              }
            })

          }

        },

        // location is ready for use
        function(callback) {

          // for ios, update location notification token. because of the single user nature of these locations, we must only allow
          // a single ios notification token per location; if multiple users use the location, only the "current" user can receive notifications.
          async.parallel([
            async() => {
              if (locationInfo.iosNotificationToken) {
                try {
                  await promised(modules.db.models.location, 'assignIosNotificationToken', locationInfo.iosNotificationToken, principal, location)
                } catch (err) {
                  logger.error('could not save updated ios location token')
                }
              }
            },
            async() => {
              if (locationInfo.gcmRegistrationId) {
                try {
                  await promised(modules.db.models.location, 'assignGcmRegistrationId', locationInfo.gcmRegistrationId, principal, location)
                } catch (err) {
                  logger.error('could not save updated gcm location token')
                }
              }
            },
            async() => {
              if (locationInfo.fcmRegistrationToken) {
                try {
                  await promised(modules.db.models.location, 'assignFcmRegistrationToken', locationInfo.fcmRegistrationToken, principal, location)
                } catch (err) {
                  logger.error('could not save updated fcm location token')
                }
              }
            },
            async() => {
              if (locationInfo.tpnsRegistrationToken) {
                try {
                  await promised(modules.db.models.location, 'assignTpnsRegistrationToken', locationInfo.tpnsRegistrationToken, principal, location)
                } catch (err) {
                  logger.error('could not save updated tpns location token')
                }
              }
            },
            async() => {
              if (locationInfo.voipToken) {
                try {
                  await promised(modules.db.models.location, 'assignVoipToken', locationInfo.voipToken, principal, location)
                } catch (err) {
                  logger.error('could not save updated voip location token')
                }
              }
            }
          ], callback)

        }

      ], function(err) {
        if (!err) {
          modules.db.models.location.updateLastLogin(principal._id, req, location)
        }
        callback(err, location)
      })

    })

  }

  /**
     * @param location
     * @param locationInfo
     * {
         *     verificationToken: a token,
         *     singleUse: boolean (default false). don't save the location verification status;
         * }
     * @param principal
     * @param callback
     */
  static verifyLocation(location, locationInfo, principal, callback) {

    locationInfo = utils.extend({
      verificationToken: null,
      singleUse: false
    }, locationInfo)

    if (!modules.authentication.isCallbackToken(locationInfo.verificationToken, config('callbacks.smsLength'))) {
      callback(Fault.create('cortex.invalidArgument.locationToken'))
      return
    }

    modules.db.models.callback
      .findOne({ token: locationInfo.verificationToken, handler: consts.callbacks.ver_location, org: principal.orgId })
      .populate('sender', '_id')
      .exec(function(err, callbackObject) {

        if (err) { // db lookup error
          err = Fault.create('cortex.error.db', { path: 'location.token' })
        } else if (!callbackObject) { // callback token not found
          err = Fault.create('cortex.invalidArgument.locationToken')
        } else if (!callbackObject.sender) { // sender account not found
          err = Fault.create('cortex.notFound.account')
        } else { // noinspection JSUnresolvedVariable
          if (callbackObject.expired) { // token expired
            err = Fault.create('cortex.expired.locationToken')
          } else if (!utils.equalIds(principal._id, callbackObject.sender._id)) { // token not created by the caller.
            err = Fault.create('cortex.invalidArgument.locationToken')
          } else if (!utils.equalIds(callbackObject.data.locationId, location._id)) { // token locationId does not match current location
            err = Fault.create('cortex.invalidArgument.locationToken')
          }
        }

        if (!err) {
          switch (location.state) {
            case 'verified': err = Fault.create('cortex.invalidArgument.locationAlreadyVerified'); break
            case 'revoked': err = Fault.create('cortex.accessDenied.locationAccessRevoked'); break
          }
        }

        // we can remove the callback if we run into a snag here.
        if (err && callbackObject) {
          callbackObject.remove(function(err) {
            if (err) logger.error('removing verification callback', err.toJSON({ stack: true }))
          })
        }

        if (err) callback(err)
        else {

          // cleanup all callbacks for this location.
          // noinspection JSValidateTypes,JSCheckFunctionSignatures
          modules.db.models.callback.deleteMany({ handler: consts.callbacks.ver_location, targetId: principal._id, 'data.locationId': location._id }, function(err) {
            if (err) logger.error('error cleaning up location verification tokens', err.toJSON({ stack: true }))
          })

          const update = {}
          if (_.isString(locationInfo.locationName)) {
            location.name = update.name = locationInfo.locationName.substr(0, 512) // just to be safe.
          }
          if (!locationInfo.singleUse) {
            location.state = update.state = 'verified'
          }

          if (Object.keys(update).length === 0) {
            callback(null, location)
          } else {
            modules.db.models.location.collection.updateOne({ _id: location._id }, { $set: update }, { writeConcern: { w: 'majority' } }, function(err) {
              callback(err, location)
            })
          }
        }

      })

  }

}

module.exports = LocationsModule
