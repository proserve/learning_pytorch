'use strict'

const utils = require('../../lib/utils'),
      { path: pathTo, contains_ip: containsIp, array: toArray, isSet, getIdOrNull, getClientIp } = utils,
      Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      logger = require('cortex-service/lib/logger'),
      { AccessContext } = require('../../lib/acl'),
      url = require('url'),
      querystring = require('querystring'),
      modules = require('../modules'),
      config = require('cortex-service/lib/config'),
      http = require('http'),
      headersToAdjust = toArray(config('server.adjustableHeaders')),
      ap = require('../access-principal')

Object.defineProperties(http.IncomingMessage.prototype, {
  appId: {
    get: function() {
      return this.orgApp ? this.orgApp._id : null
    }
  },
  clientId: {
    get: function() {
      return this.orgClient ? this.orgClient._id : null
    }
  }
})

/**
 * @defines req.appId, req.clientId, req.orgApp, req.orgClient, req.signature
 * @headers Medable-Server-Time
 * @return {Function}
 */
function clientDetection(options = {}) {

  const defaultToWebApp = options.defaultToWebApp

  return function(req, res, next) {

    if (req.orgClient !== undefined) {
      return next()
    }

    try {
      res.header('Medable-Server-Time', Date.now())
    } catch (err) {

    }

    // --------------

    let clientData = null,
        appData,
        clientKey,
        match,
        ok,
        whitelist,
        blacklist,
        patterns

    const originHeader = req.header('Origin'),
          originHostname = url.parse(originHeader || '').hostname,
          clientIp = getClientIp(req),
          clientHeader = req.header('medable-client-key')

    if (_.isString(req.header('authorization'))) {
      const bearerMatch = req.header('authorization').match(/^Bearer (.*)/)
      if (bearerMatch) {
        try {
          req.bearerToken = bearerMatch[1]
          req.authToken = modules.authentication.decodeToken(bearerMatch[1])
        } catch (err) {
          return next(err)
        }
      }
    }

    clientKey = req.authToken ? req.authToken.iss : (clientHeader || ((originHostname === config('webApp.host') || defaultToWebApp) ? config('webApp.apiKey') : null))

    appData = _.find(toArray(req.org.apps), app => {

      const client = _.find(
        toArray(app.clients),
        client => {
          if (client) {
            if (client.key === clientKey) {
              return true
            }
            if (client.allowNameMapping && clientKey && app.name === clientKey) {
              req.headers['medable-client-key'] = clientKey = client.key
              return true
            }
          }
          return client && client.key === clientKey
        })

      if (client) {
        clientData = client
      }
      return !!client

    })

    // examine the original client header to ensure that callers are doing what they think they are doing.
    // since we are using the iss of the token if it exists, check clientData against the header if it was sent.
    if (req.authToken && clientHeader && clientData) {
      if (!((clientData.allowNameMapping && appData.name === clientHeader) ||
            (clientData.key === clientHeader))
      ) {
        return next(Fault.create('cortex.notFound.app', { reason: 'Invalid application client api key (token/key mismatch).' }))
      }
    }

    // let in some internally known apps
    if (!clientData) {

      if (clientKey === config('webApp.apiKey')) {

        // only allow the web application to use the web client key.
        if (originHostname !== config('webApp.host') && !defaultToWebApp) {
          return next(Fault.create('cortex.notFound.app'))
        }

        appData = {
          label: 'Web App',
          _id: getIdOrNull(config('webApp.clientId')),
          clients: [
            clientData = {
              _id: getIdOrNull(config('webApp.clientId')),
              expires: null,
              label: 'Web App Client',
              key: clientKey,
              CORS: { origins: [
                originHeader
              ] },
              csrf: true,
              authDuration: 900,
              sessions: true,
              readOnly: false,
              enabled: true
            }
          ],
          suspended: false,
          APNs: { key: '', cert: '', debug: false },
          GCM: { apiKey: '' },
          FCM: { apiKey: '' },
          TPNS: { accessId: '', secretKey: '' },
          enabled: true,
          patterns: []
        }
      } else {
        appData = modules.hub.detectAppClient(req, clientKey)
        if (appData) {
          clientData = appData.clients[0]
        }
      }
    }

    if (!clientData) {
      return next(Fault.create('cortex.notFound.app'))
    } else if (appData['suspended']) {
      return next(Fault.create('cortex.accessDenied.appSuspended'))
    } else if (!appData.enabled) {
      return next(Fault.create('cortex.accessDenied.appDisabled'))
    } else if (!clientData.enabled) {
      return next(Fault.create('cortex.accessDenied.appDisabled'))
    } else if (_.isDate(clientData.expires) && clientData.expires.getTime() < new Date().getTime()) {
      return next(Fault.create('cortex.expired.app'))
    }

    req.log.aid = appData._id
    req.log.cid = clientData._id
    if (clientData.readOnly && req.method !== 'GET' && req.method !== 'OPTIONS' && req.method !== 'HEAD') {
      if (clientData.readOnly) {
        return next(Fault.create('cortex.accessDenied.appReadOnly'))
      }
    }

    // match whitelist
    whitelist = toArray(clientData.whitelist)
    if (whitelist.length > 0 && !containsIp(whitelist, clientIp)) {
      return next(Fault.create('cortex.accessDenied.app', { reason: clientIp + ' is not whitelisted.' }))
    }

    // match blacklist
    blacklist = toArray(clientData.blacklist)
    if (blacklist.length > 0 && containsIp(blacklist, clientIp)) {
      return next(Fault.create('cortex.accessDenied.app', { reason: clientIp + ' is blacklisted.' }))
    }

    // match patterns
    patterns = toArray(clientData['patterns'])
    if (patterns.length > 0) {
      ok = false
      const request = req.method + ' ' + req.path
      for (let i = 0; i < patterns.length; i++) {
        try {
          let regex
          if (_.isRegExp(patterns[i])) {
            regex = patterns[i]
          } else {
            match = patterns[i].match(/^\/(.*)\/(.*)/)
            if (match) {
              regex = new RegExp(match[1], match[2])
            }
          }
          if (regex && (ok = !!request.match(regex))) {
            break
          }
        } catch (e) {
          logger.warn('caught exception matching api key allowed patterns' + e.message)
        }
      }
      if (!ok) {
        return next(Fault.create('cortex.accessDenied.app', { reason: 'Client route api access denied.' }))
      }
    }

    if (originHeader) {
      const origins = toArray(pathTo(clientData, 'CORS.origins'))
      if (!~origins.indexOf(originHeader) && !~origins.indexOf('*')) {
        return next(Fault.create('cortex.accessDenied.app', { reason: 'The application does not accept CORS requests from ' + originHeader }))
      }
    }

    req.orgApp = appData
    req.orgClient = clientData

    if (!clientData.sessions && !req.authToken) {
      modules.authentication.validateSignedRequest(req, clientData.key, clientData.secret, clientData.allowUnsigned, function(err, signature) {
        if (!err && signature) {
          req.signature = signature
        }
        next(err)
      })
    } else if (!clientData.filter) {

      next()

    } else {

      Promise.resolve(null)
        .then(async() => {

          const { createContext, parseExpression } = modules.expressions,
                expression = isSet(clientData.filter) && parseExpression(clientData.$filter || clientData.filter)

          clientData.$filter = expression

          if (expression) {

            const { org } = req,
                  ac = new AccessContext(ap.synthesizeAnonymous(org), null, { req }),
                  ec = createContext(ac, expression)

            await ec.evaluate()

          }

        })
        .catch(err => err)
        .then(err => next(err))

    }

  }

}

clientDetection.adjust_headers = function(req) {

  const keys = Object.keys(req.query)

  let adjusted = false,
      numKeys = keys.length

  if (numKeys) {
    headersToAdjust.forEach(header => {
      let value = req.header(header)
      if (value === null || value === undefined) {
        keys.forEach(function(key) {
          if (!value && key.toLowerCase() === header) {
            value = req.query[key]
            delete req.query[key]
            numKeys--
            adjusted = true
          }
        })
        if (value !== null && value !== undefined) {
          req.headers[header] = value
        }
      }
    })
    if (adjusted) {
      req.url = req.path + (numKeys === 0 ? '' : ('?' + querystring.stringify(req.query)))
    }
  }

}

module.exports = clientDetection
clientDetection.default = clientDetection()
