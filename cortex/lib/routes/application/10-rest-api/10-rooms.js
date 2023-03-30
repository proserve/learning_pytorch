'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      async = require('async'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      { outputResults, promised, version, createId, rBool, asyncHandler } = require('../../../utils'),
      twilio = require('twilio'),
      request = require('request')

function validateTwilioRequest(req, res, next) {

  if (config('__is_mocha_test__')) {
    return next()
  }
  twilio.validateRequest(
    config('televisit.twilio.authToken'),
    req.header('X-Twilio-Signature'),
    req.protocol + '://' + req.get('host') + req.originalUrl,
    req.body
  )

  // @todo address whitelisting https://www.twilio.com/docs/video/ip-address-whitelisting

  next()

}

module.exports = function(express, router) {

  if (config('televisit.debugRelay.client.enabled')) {

    const getSignedHeaders = (command) => {

      const timestamp = Date.now(),
            signature = modules.authentication.signRequest(command, 'GET', config('televisit.debugRelay.client.apiKey') + config('televisit.debugRelay.client.apiSecret'), timestamp)

      return {
        'Medable-Client-Key': config('deploy.apiKey'),
        'Medable-Client-Signature': signature,
        'Medable-Client-Timestamp': String(timestamp),
        'Medable-Client-Nonce': modules.authentication.generateNonce(),
        'Accept': 'application/json',
        'User-Agent': 'Medable API ' + version()
      }

    }

    setInterval(
      () => {

        const endpoint = config('televisit.debugRelay.client.endpoint'),
              name = config('televisit.debugRelay.client.name'),
              requestUrl = `https://${endpoint}/medable/v2/integrations/twilio/video/relay/${name}`,
              requestOptions = {
                headers: getSignedHeaders(`/integrations/twilio/video/relay/${name}`),
                json: true,
                strictSSL: rBool(config('televisit.debugRelay.client.strictSSL'), true),
                method: 'GET',
                timeout: 120000
              }

        request(
          requestUrl,
          requestOptions,
          async(err, response, body) => {

            err = Fault.from(err || body)
            if (!err) {
              if (!_.isObject(body) || !body.object) {
                err = Fault.create('cortex.error.netMissingResponse')
              } else if (!body.data) {
                err = Fault.create('cortex.error.netMissingResult')
              } else if (response.statusCode !== 200) {
                err = Fault.create('cortex.error.netInvalidResponseStatus', response.statusCode)
              }
            }

            if (err) {

              logger.error('error retrieving televisit relay messages', {
                url: requestUrl,
                error: err.toJSON()
              })

            } else {

              for (let item of body.data) {

                try {
                  const org = await promised(modules.db.models.Org, 'loadOrg', item.environment),
                        model = await promised(org, 'createObject', 'room')

                  await model.processTwilioEvent(
                    org,
                    item.event
                  )
                } catch (err) {
                  logger.error('error inserting televisit event', err.toJSON())
                }

              }

            }

          }
        )

      },
      config('televisit.debugRelay.client.pollInterval')
    )
      .unref()

  }

  if (config('televisit.debugRelay.server.enabled')) {

    router.get('/integrations/twilio/video/relay/:name',

      function(req, res, next) {

        modules.authentication.validateSignedRequest(req, config('televisit.debugRelay.server.apiKey'), config('televisit.debugRelay.server.apiSecret'), false, function(err, signature) {
          if (!err && signature) {
            req.orgClient = {
              key: config('televisit.debugRelay.server.apiKey'),
              CORS: {
                origins: ['*']
              }
            }
            req.signature = signature
          }
          next(err)
        })

      },

      function(req, res) {

        modules.cache.find(
          req.org,
          `televisit.debug.relay.${req.params.name}.`,
          (err, results) => {

            if (err) {
              return outputResults(res, err)
            }

            async.each(
              results,
              ({ key }, callback) => {
                modules.cache.del(req.org, key, callback)
              },
              err => outputResults(res, err, results.map(v => v.val))
            )

          })

      }

    )

    router.post('/integrations/twilio/video/relay/:name/:environment',
      middleware.body_parser.urlencoded,
      function(req, res, next) {

        if (req.org.code !== 'medable') {
          return next(Fault.create('cortex.accessDenied.org', { reason: 'org api access denied.' }))
        }

        const cacheKey = `televisit.debug.relay.${req.params.name}.${createId()}`,
              item = {
                environment: req.params.environment,
                event: req.body || {}
              }

        modules.cache.set(req.org, cacheKey, item, 86400)

        outputResults(res, null, true)

      }
    )

  }

  /**
   * this callback happens in the base environment context.
   */
  router.post('/integrations/twilio/video/callback/:environment',
    middleware.body_parser.urlencoded,
    validateTwilioRequest,
    asyncHandler(async(req) => {

      if (req.org.code !== 'medable') {
        throw Fault.create('cortex.accessDenied.org', { reason: 'org api access denied.' })
      }

      const org = await promised(modules.db.models.Org, 'loadOrg', req.params.environment),
            model = await promised(org, 'createObject', 'room')

      return model.processTwilioEvent(org, req.body || {})

    })
  )

}
