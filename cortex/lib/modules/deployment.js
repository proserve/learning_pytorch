'use strict'

const Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      zlib = require('zlib'),
      config = require('cortex-service/lib/config'),
      consts = require('../../lib/consts'),
      modules = require('../modules'),
      models = modules.db.models,
      request = require('request'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../lib/acl'),
      ap = require('../../lib/access-principal'),
      utils = require('../../lib/utils'),
      _ = require('underscore'),
      url = require('url'),
      crypto = require('crypto'),
      TOKEN_EXPIRY = config('sessions.authDuration') * 1000,
      TOKEN_LENGTH = 32,
      TOKEN_SECRET = config('deploy.tokenSecret')

function encrypt(data, password) {
  const cipher = crypto.createCipher('aes256', password)
  return cipher.update(JSON.stringify(data), 'utf8', 'base64') + cipher.final('base64')
}

function decrypt(data, password) {
  const decipher = crypto.createDecipher('aes256', password)
  return JSON.parse(decipher.update(data, 'base64', 'utf8') + decipher.final('utf8'))
}

function hash(text) {
  const shasum = crypto.createHash('sha1')
  shasum.update(text)
  return shasum.digest('hex')
}

module.exports = {

  refreshMappings: function(ac, deploymentId, callback) {
    modules.db.models.deployment.aclUpdatePath(ac.principal, utils.getIdOrNull(deploymentId), 'refreshMappings', true, { method: 'put', req: ac.req, grant: acl.AccessLevels.System, include: ['mappings'] }, err => {
      if (err) return callback(err)
      modules.db.models.deployment.aclReadOne(ac.principal, utils.getIdOrNull(deploymentId), { include: ['mappings'] }, function(err, doc) {
        callback(err, doc)
      })
    })
  },

  updateMappings: function(ac, deploymentId, options, callback) {

    options = options || {}

    modules.db.models.deployment.aclReadOne(ac.principal, utils.getIdOrNull(deploymentId), { json: false, include: ['mappings'] }, function(err, doc) {

      if (err) {
        return callback(err)
      }
      const target = utils.findIdInArray(utils.path(ac.org, 'deployment.targets'), '_id', doc.target)
      if (!target) {
        return callback(Fault.create('cortex.notFound.deploymentTarget'))
      }
      if (!~['Active'].indexOf(target.state)) {
        return callback(Fault.create('cortex.invalidArgument.inactiveDeploymentTarget'))
      }
      if (doc.stage !== 'Source Mappings') {
        return callback(Fault.create('cortex.invalidArgument.state', { path: 'stage' }))
      }

      let requestOptions = {
        session: options.session,
        token: options.token,
        payload: {
          configuration: doc.configuration.toObject(),
          mappings: doc.mappings.toObject()
        }
      }

      module.exports.performRequest(target, '/deployments/target/mappings', 'post', requestOptions, (err, result) => {

        if (err) {
          return callback(err)
        }

        // update the local mapping targets. use the originally loaded document so we can detect sequence errors.
        doc.stage = 'Target Mappings'
        doc.mappings = result

        ac.lowLevelUpdate({ subject: doc }, err => {
          if (err) {
            return callback(err)
          }
          modules.db.models.deployment.aclReadOne(ac.principal, utils.getIdOrNull(doc._id), { include: ['mappings'] }, function(err, doc) {
            callback(err, doc)
          })
        })

      })

    })

  },

  /**
     *
     * @param ac
     * @param deploymentId
     * @param options
     *  userdata.session
     *  userdata.payload
     *  session
     *  token
     * @param callback
     */
  deploy: function(ac, deploymentId, options, callback) {

    options = options || {}

    modules.db.models.deployment.aclReadOne(ac.principal, utils.getIdOrNull(deploymentId), { json: false, include: ['mappings'], req: ac.req }, function(err, doc) {
      if (err) {
        return callback(err)
      }
      const target = utils.findIdInArray(utils.path(ac.org, 'deployment.targets'), '_id', doc.target)
      if (!target) {
        return callback(Fault.create('cortex.notFound.deploymentTarget'))
      }
      if (!~['Active'].indexOf(target.state)) {
        return callback(Fault.create('cortex.invalidArgument.inactiveDeploymentTarget'))
      }
      doc.getDeploymentPayload(new acl.AccessContext(ac.principal, { req: ac.req }), (err, payload) => {
        if (err) {
          return callback(err)
        }

        payload.userdata = utils.path(options, 'userdata.payload') // this will be passed to scripts as a "payload" argument
        try {
          if ((JSON.stringify(payload.userdata) || '').length > config('deploy.payloadDataMaxBytes')) {
            return callback(Fault.create('cortex.invalidArgument.tooLarge', { reason: `deployment user payload exceeds ${config('deploy.payloadDataMaxBytes')} bytes.` }))
          }
        } catch (e) {
          return callback(e)
        }

        const requestOptions = {
          session: options.session,
          token: options.token,
          payload: payload
        }
        module.exports.performRequest(target, '/deployments/target/deploy/' + doc._id, 'post', requestOptions, (err, lastRunId) => {
          if (err) {
            return callback(err)
          }
          modules.db.models.deployment.aclUpdate(ac.principal, doc._id, { lastDeployed: new Date(), lastRunId: lastRunId, lastDeployer: ac.principal._id, lastRunResult: null, session: utils.path(options, 'userdata.session') }, { method: 'put', req: ac.req, skipAcl: true, grant: acl.AccessLevels.System }, function(err) {
            callback(err, lastRunId)
          })
        })
      })

    })

  },

  /**
     * @param ac
     * @param deploymentId
     * @param options
     *  token
     *  session
     *  skip
     *  limit
     *  runId
     * @param callback
     */
  logs: function(ac, deploymentId, options, callback) {

    modules.db.models.deployment.aclReadOne(ac.principal, utils.getIdOrNull(deploymentId), { json: false, paths: ['_id', 'target'] }, function(err, doc) {

      if (err) {
        return callback(err)
      }

      const target = utils.findIdInArray(utils.path(ac.org, 'deployment.targets'), '_id', doc.target)

      if (!target) {
        return callback(Fault.create('cortex.notFound.deploymentTarget'))
      }
      if (!~['Active'].indexOf(target.state)) {
        return callback(Fault.create('cortex.invalidArgument.inactiveDeploymentTarget'))
      }

      let command = url.format({
            pathname: '/deployments/target/log/' + doc._id,
            query: {
              skip: options.skip,
              limit: utils.queryLimit(options.limit),
              runId: String(utils.getIdOrNull(options.runId) || '')
            }
          }),
          requestOptions = {
            token: options.token,
            session: options.session
          }

      modules.deployment.performRequest(target, command, 'get', requestOptions, (err, result) => callback(err, result))

    })

  },

  requestTarget: function(org, target, callback) {
    callback = utils.ensureCallback(callback)
    const options = {
      payload: {
        server: config('server.apiHost'),
        code: org.code,
        token: target.token
      }
    }
    module.exports.performRequest(target, '/deployments/target/add-source', 'post', options, function(err, result) {
      if (err) {
        const child = utils.path(err, 'faults.0.reason')
        models.org.aclUpdatePath(ap.synthesizeAnonymous(org), org._id, 'deployment.targets.' + target._id, { state: 'Error', reason: child || err.reason || err.message }, { method: 'put', grant: acl.AccessLevels.System }, function() {})
      }
      callback(err, result)
    })

  },

  respondSource: function(org, target, state, callback) {
    callback = utils.ensureCallback(callback)
    const options = {
      payload: {
        token: target.token,
        state: state
      }
    }
    module.exports.performRequest(target, '/deployments/source/add-source-response', 'post', options, function(err, result) {
      callback(err, result)
    })
  },

  respondResult: function(org, target, deploymentId, runId, result, callback) {
    callback = utils.ensureCallback(callback)
    const options = {
      payload: {
        token: target.token,
        deploymentId: deploymentId,
        runId: runId,
        result: result
      }
    }
    module.exports.performRequest(target, '/deployments/source/deployment-result', 'post', options, function(err, result) {
      callback(err, result)
    })
  },

  authWithTarget: function(principal, deploymentId, options, callback) {

    options = options || {}

    models.deployment.aclReadPath(principal, utils.getIdOrNull(deploymentId), 'target', function(err, targetId) {

      if (err) {
        return callback(err)
      }
      const target = utils.findIdInArray(utils.path(principal.org, 'deployment.targets'), '_id', targetId),
            requestOptions = {
              payload: {
                isSupportLogin: Boolean(options.isSupportLogin),
                loginAs: options.loginAs,
                email: options.email,
                password: options.password,
                token: options.token
              }
            }
      if (!target) {
        return callback(Fault.create('cortex.notFound.deploymentTarget'))
      }
      if (!~['Active'].indexOf(target.state)) {
        return callback(Fault.create('cortex.invalidArgument.inactiveDeploymentTarget'))
      }

      module.exports.performRequest(target, '/deployments/target/authenticate', 'post', requestOptions, function(err, deploymentSession) {
        callback(err, deploymentSession)
      })

    })

  },

  log: function(ac, sourceId, ...data) {

    const now = new Date(),
          log = new models.log({
            req: ac.reqId || utils.createId(),
            org: ac.orgId,
            beg: now,
            end: now,
            src: consts.logs.sources.deployment,
            pid: ac.principalId,
            oid: ac.principalId,
            exp: new Date(Date.now() + (86400 * 1000 * 30)),
            lvl: consts.logs.levels.info,
            dpl: ac.subjectId
          })

    log.trc = log.err = log.err.faults = undefined
    log.dat = data

    sourceId = utils.getIdOrNull(sourceId)
    if (sourceId) {
      log.src_id = sourceId
    }

    models.log.collection.insertOne(log.toObject(), function(err) {
      if (err) {
        logger.error('error adding deployment log record', err.toJSON())
      }
    })

  },

  logError: function(ac, sourceId, err) {

    const now = new Date(),
          log = new models.log({
            req: ac.reqId || utils.createId(),
            org: ac.orgId,
            beg: now,
            end: now,
            src: consts.logs.sources.deployment,
            pid: ac.principalId,
            oid: ac.principalId,
            exp: new Date(Date.now() + (86400 * 1000 * 30)),
            lvl: consts.logs.levels.error,
            dpl: ac.subjectId
          })

    sourceId = utils.getIdOrNull(sourceId)
    if (sourceId) {
      log.src_id = sourceId
    }

    log.dat = undefined

    err = utils.toJSON(err)
    log.sts = err.status
    if (_.isString(err.trace)) {
      log.trc = models.log._getTrace(err.trace)
    }
    log.err = err

    models.log.collection.insertOne(log.toObject(), function(err) {
      if (err) {
        logger.error('error adding deployment log record', err.toJSON())
      }
    })

  },

  /**
     *
     * @param deploymentTarget
     * @param command
     * @param method
     * @param options
     *  headers additional headers
     *  token client authed token {principal, token}
     *  session read/write token data from session object
     *
     * @param callback err, result
     */
  performRequest: function(deploymentTarget, command, method, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    const deploymentHost = deploymentTarget.server,
          deploymentOrg = deploymentTarget.code,
          requestUrl = 'https://' + deploymentHost.replace(/[:+?/]/g, '') + '/' + deploymentOrg.replace(/[:+?/]/g, '') + '/v2' + command,
          requestOptions = {
            headers: utils.extend(options.headers, module.exports.getSignedHeaders(url.parse(command).pathname, method), {
              'Accept': 'application/json',
              'User-Agent': 'Medable API ' + utils.version()
            }),
            json: true,
            strictSSL: utils.rBool(config('deploy.strictSSL'), true),
            method: method.toUpperCase(),
            timeout: 120000
          }
    requestOptions.headers['Medable-Deployment-Token'] = deploymentTarget.token
    if (options.token) {
      requestOptions.headers['Medable-Deployment-Principal'] = options.token.principal || ''
      requestOptions.headers['Medable-Deployment-Session'] = options.token.session || ''
    } else if (options.session) {
      requestOptions.headers['Medable-Deployment-Principal'] = utils.path(options.session, 'deploymentSession.principal') || ''
      requestOptions.headers['Medable-Deployment-Session'] = utils.path(options.session, 'deploymentSession.session') || ''
    }

    if (options.payload !== undefined && ~['POST', 'PATCH', 'PUT'].indexOf(requestOptions.method)) {
      module.exports.zipPayload(options.payload, function(err, payload) {
        if (err) {
          callback(err)
        } else {
          requestOptions.body = { payload: payload }
          go()
        }
      })
    } else {
      go()
    }

    function go() {

      module.exports._httpRequest(requestUrl, requestOptions, function(err, response, body) {

        const session = utils.path(response, 'headers.medable-deployment-session')
        if (session) {
          const existing = utils.path(options, 'session.deploymentSession')
          if (existing) {
            existing.session = session
            utils.path(options, 'session.deploymentSession', existing)
          }
        }

        err = Fault.from(err || body)
        if (err) {
          if (err.errCode === 'cortex.accessDenied.maintenance') {
            err.errCode = 'cortex.accessDenied.deploymentInProgress'
          }
        } else if (!_.isObject(body) || !body.object) {
          err = Fault.create('cortex.error.netMissingResponse')
        } else if (!body.data) {
          err = Fault.create('cortex.error.netMissingResult')
        } else if (response.statusCode !== 200) {
          err = Fault.create('cortex.error.netInvalidResponseStatus', response.statusCode)
        }

        if (err) {
          logger.error('a deployment server -> server request error', {
            url: requestUrl,
            error: err.toJSON()
          })
          return callback(err)
        }
        module.exports.unzipPayload(body.data, function(err, unzipped) {
          callback(err, unzipped)
        })
      })
    }

  },

  _httpRequest: function(requestUrl, requestOptions, callback) {
    request(requestUrl, requestOptions, callback)
  },

  zipPayload: function(payload, callback) {
    let body
    try {
      body = utils.serializeObject(payload, true)
    } catch (err) {
      return callback(err)
    }
    zlib.gzip(body, function(err, buffer) {
      if (err) {
        callback(err)
      } else {
        callback(null, buffer.toString('base64'))
      }
    })
  },

  unzipPayload: function(payload, callback) {
    let buffer
    try {
      buffer = Buffer.from(payload, 'base64')
    } catch (err) {
      return callback(err)
    }
    zlib.gunzip(buffer, function(err, string) {
      let payload
      if (!err) {
        try {
          string = string.toString('utf8')
          payload = utils.deserializeObject(string, true)
        } catch (e) {
          err = e
        }
      }
      string = null
      callback(err, payload)

    })
    buffer = null
  },

  /**
     * @param req
     *  body
     *      token
     *      isSupportLogin
     *      loginAs
     *      email
     *      password
     * @param res
     * @param callback
     * @returns {*}
     */
  doAuth: function(req, res, callback) {

    if (utils.path(req, 'body.token')) {
      const ac = new acl.AccessContext(ap.synthesizeAnonymous(req.org))
      modules.authentication.authenticateToken(ac, req.body.token, { include: ['password'], checkPolicy: false }, (err, { principal, account } = {}) => {
        callback(err, principal, account)
      })
      return
    }

    if (utils.path(req, 'body.isSupportLogin')) {

      if (utils.path(req.org, 'support.disableSupportLogin')) {
        return callback(Fault.create('cortex.accessDenied.supportDisabled'))
      }

      let pinnedAccount = utils.rString(utils.path(req.org, 'support.pinnedAccount'), '').toLowerCase(),
          loginAs = utils.rString(utils.path(req, 'body.loginAs'), pinnedAccount).toLowerCase(),
          pickAnAdmin = ~['admin', 'administrator'].indexOf(String(loginAs).toLowerCase()),
          hostOrg = req.org

      if (pinnedAccount && loginAs !== pinnedAccount) {
        return callback(Fault.create('cortex.accessDenied.supportPinned'))
      }

      if (!modules.validation.isEmail(loginAs) && !pickAnAdmin) {
        return callback(Fault.create('cortex.invalidArgument.emailFormat'))
      }

      async.waterfall([
        function(callback) {
          models.org.loadOrg('medable', function(err, org) {
            if (!err) {
              hostOrg = req.org
              req.org = org
            }
            callback(err)
          })
        },
        function(callback) {
          modules.authentication.attemptAuth(req.org, utils.path(req.body, 'email') || utils.path(req.body, 'username'), utils.path(req.body, 'password'), { req, checkLock: true, checkExpired: true, newPassword: utils.path(req.body, 'newPassword') }, err => {
            callback(err)
          })
        },
        function(callback) {
          if (!pickAnAdmin) {
            return callback()
          }
          models.account
            .findOne({ org: req.orgId, object: 'account', reap: false, roles: acl.OrgAdminRole, locked: false })
            .limit(1)
            .lean()
            .sort({ _id: 1 })
            .select('email')
            .exec((err, account) => {
              if (!err && account) {
                loginAs = account.email
              }
              callback(err)
            })
        },
        function(callback) {
          req.org = hostOrg
          models.account.aclLoad(ap.synthesizeAnonymous(req.org), { internalWhere: { email: loginAs }, skipAcl: true, paths: 'password', forceSingle: true }, function(err, account) {
            if (err) {
              if (err.errCode === 'cortex.notFound.instance') {
                err = Fault.create('cortex.accessDenied.invalidCredentials')
              } else {
                err = Fault.create('cortex.error.unspecified', { reason: 'Unhandled account access error' })
              }
            }
            if (err) {
              return callback(err)
            }
            ap.create(req.org, account._id, function(err, principal) {
              callback(err, principal, account)
            })
          })
        }
      ], callback)

      return
    }

    async.waterfall([
      function(callback) {
        modules.authentication.attemptAuth(req.org, utils.path(req.body, 'email') || utils.path(req.body, 'username'), utils.path(req.body, 'password'), { req, checkLock: true, checkExpired: true, newPassword: utils.path(req.body, 'newPassword') }, (err, account) => {
          callback(err, account)
        })
      },
      function(account, callback) {
        ap.create(req.org, account._id, function(err, principal) {
          callback(err, principal, account)
        })
      }
    ], callback)
  },

  createSession: function(principal, asArray, deploymentSessionId, secret) {

    deploymentSessionId = utils.getIdOrNull(deploymentSessionId)

    const token = {
      _id: deploymentSessionId ? deploymentSessionId.toString() : utils.createId(),
      principal: asArray ? JSON.stringify([
        principal._id,
        principal.isSupportLogin,
        principal.scope ? modules.authentication.scopeToStringArray(principal.scope) : null
      ]) : principal._id,
      expires: Date.now() + TOKEN_EXPIRY,
      session: modules.authentication.genAlphaNumString(TOKEN_LENGTH)
    }
    token.signature = modules.authentication.signRequest(token.principal, token.session, token.session, token.expires)
    return encrypt(token, hash(TOKEN_SECRET + secret))

  },

  getSignedHeaders: function(command, method) {

    const timestamp = Date.now(),
          signature = modules.authentication.signRequest(command, method.toUpperCase(), config('deploy.apiKey') + config('deploy.apiSecret'), timestamp)

    return {
      'Medable-Client-Key': config('deploy.apiKey'),
      'Medable-Client-Signature': signature,
      'Medable-Client-Timestamp': String(timestamp),
      'Medable-Client-Nonce': modules.authentication.generateNonce()
    }

  },

  outputZippedResponse: function(res, err, result) {
    if (err) {
      utils.outputResults(res, err)
    } else {
      module.exports.zipPayload(result, function(err, zipped) {
        utils.outputResults(res, err, zipped)
      })
    }
  },

  // middleware ------------------------------------------------------------------------------------------------------

  keyPairCheck: function(req, res, next) {

    modules.authentication.validateSignedRequest(req, config('deploy.apiKey'), config('deploy.apiSecret'), false, function(err, signature) {
      if (!err && signature) {
        req.orgClient = {
          key: config('deploy.apiKey'),
          CORS: {
            origins: ['*']
          }
        }
        req.signature = signature
      }
      next(err)
    })

  },

  sourceCheckMiddleware: function(req, res, next) {
    let err
    try {
      modules.deployment.sourceCheck(req.org)
    } catch (e) {
      err = e
    }
    next(err)
  },

  sourceCheck: function(org) {

    // @todo: ensure a deployment is not currently in progress.
    const availability = utils.rInt(utils.path(org.deployment, 'availability'), config('deploy.defaultAvailability'))
    if (!~[consts.deployment.availability.source, consts.deployment.availability.both].indexOf(availability)) {
      throw Fault.create('cortex.accessDenied.deploymentEnv', { path: 'source' })
    }
  },

  targetCheckMiddleware: function(req, res, next) {
    let err
    try {
      modules.deployment.targetCheck(req.org)
    } catch (e) {
      err = e
    }
    next(err)
  },

  targetCheck: function(org) {

    // @todo: ensure a deployment is not currently in progress.
    const availability = utils.rInt(utils.path(org.deployment, 'availability'), config('deploy.defaultAvailability'))
    if (!~[consts.deployment.availability.target, consts.deployment.availability.both].indexOf(availability)) {
      throw Fault.create('cortex.accessDenied.deploymentEnv', { path: 'target' })
    }
  },

  targetSourceCheckMiddleware: function(req, res, next) {
    let err
    try {
      modules.deployment.targetSourceCheck(req.org, req.header('Medable-Deployment-Token'))
    } catch (e) {
      err = e
    }
    next(err)
  },

  targetSourceCheck: function(org, token) {

    if (!_.find(utils.array(org.deployment.sources), src => src.token === token && src.state === 'Active')) {
      throw Fault.create('cortex.accessDenied.deploymentEnv')
    }
  },

  tokenAuthenticator: function(req, res, next) {

    const tokenStr = req.header('Medable-Deployment-Session'),
          principalId = utils.getIdOrNull(req.header('Medable-Deployment-Principal'))

    if (!tokenStr || !principalId) {
      return next(Fault.create('cortex.accessDenied.invalidDeploymentCredentials', { path: 'deployment.credentials' }))
    }

    models.account.aclLoad(ap.synthesizeAnonymous(req.org), {
      internalWhere: { _id: principalId },
      skipAcl: true,
      paths: ['password'],
      forceSingle: true
    }, function(err, account) {

      if (err) {
        return next(err)
      }

      let session, principalData, isArray
      try {
        session = decrypt(tokenStr, hash(TOKEN_SECRET + utils.path(account, 'password')))
        isArray = !utils.couldBeId(session.principal)
        principalData = isArray ? JSON.parse(session.principal) : utils.getIdOrNull(session.principal)
      } catch (e) {
        return next(Fault.create('cortex.accessDenied.invalidDeploymentCredentials', { path: 'deployment.credentials' }))
      }
      if (!session || !utils.equalIds(principalId, isArray ? principalData[0] : principalData)) {
        return next(Fault.create('cortex.accessDenied.invalidDeploymentCredentials', { path: 'deployment.credentials' }))
      }
      if (Date.now() > session.expires) {
        return next(Fault.create('cortex.expired.deployment', { path: 'deployment.credentials' }))
      }
      if (session.signature !== modules.authentication.signRequest(session.principal, session.session, session.session, session.expires)) {
        return next(Fault.create('cortex.accessDenied.invalidDeploymentCredentials', { path: 'deployment.credentials' }))
      }
      ap.create(req.org, principalId, function(err, principal) {

        if (!err) {

          if (isArray) {
            principal.isSupportLogin = principalData[1]
            principal.scope = principalData[2]
          }
          req.principal = principal
          req.deploymentSession = session
          let encrypted
          try {
            encrypted = module.exports.createSession(principal, isArray, req.deploymentSession._id, account.password)
          } catch (e) {
            err = e
          }
          if (!err) {
            res.setHeader('Medable-Deployment-Session', encrypted)
          }
        }
        next(err)
      })

    })
  },

  readZippedPayload: function(req, res, next) {
    if (_.isObject(req.body) && _.isString(req.body.payload)) {
      module.exports.unzipPayload(req.body.payload, function(err, payload) {
        req.body = payload || {}
        next(err)
      })
      return
    }
    next()
  }

}
