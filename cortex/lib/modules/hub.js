'use strict'

const utils = require('../../lib/utils'),
      acl = require('../../lib/acl'),
      ap = require('../../lib/access-principal'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      async = require('async'),
      { rBool } = require('cortex-service/lib/utils/values'),
      modules = require('../../lib/modules'),
      { promised } = require('../../lib/utils'),
      _ = require('underscore'),
      config = require('cortex-service/lib/config'),
      Url = require('url'),
      request = require('request'),
      systemRoutePatterns = [/^(GET|POST) \/hub\/system\//],
      environmentRoutePatterns = [/^(GET|POST) \/hub\/environment\//],
      updatablePaths = {

        [acl.OrgAdminRole]: [
          'state',
          'registration.bypassAccountVerification',
          'configuration.canCreateApps',
          'configuration.allowBufferSources',
          'configuration.defaultParserEngine',
          'configuration.allowStreamingUploads',
          'configuration.legacyObjects',
          'configuration.allowWsJwtScopes',
          'configuration.televisit.roomsEnabled',
          'configuration.televisit.maxConcurrentRooms',
          'configuration.televisit.enableRecording',
          'configuration.localExportStreams',
          'configuration.reporting.enabled',
          'configuration.auditLogExpiry',
          'configuration.maxStorage',
          'configuration.maxAccounts',
          'configuration.allowAccountDeletion',
          'configuration.allowOrgRefresh',
          'configuration.defaultCollection',
          'configuration.objectMode',
          'configuration.maxApps',
          'configuration.maxKeysPerApp',
          'configuration.maxRequestSize',
          'configuration.notification.maxPayloadSize',
          'configuration.notification.email.allowAttachments',
          'configuration.notification.email.maxAttachmentSize',
          'configuration.notification.APNsConfig.useToken',
          'configuration.maxUnmanagedInserts',
          'configuration.maxManagedInserts',
          'configuration.queries.allowedRestrictedMatchOps',
          'configuration.queries.allowParserStrictOption',
          'configuration.queries.allowUnidexedMatchesOption',
          'configuration.queries.enableNativePipelines',
          'configuration.accounts.requireMobile',
          'configuration.accounts.allowEmailUpdate',
          'configuration.accounts.requireEmail',
          'configuration.accounts.requireUsername',
          'configuration.accounts.enableEmail',
          'configuration.accounts.enableUsername',
          'deployment.enabled',
          'deployment.availability',
          'deployment.inProgress',
          'deployment.supportOnly',
          'deployment.allowEdits',
          'configuration.events.softLimit',
          'configuration.events.hardLimit',
          'configuration.events.triggerSoftLimit',
          'configuration.events.triggerHardLimit',
          'configuration.scripting.maxCallouts',
          'configuration.scripting.configurationTriggers',
          'configuration.scripting.enableRestrictedCallouts',
          'configuration.scripting.enableHttpInInlineTriggers',
          'configuration.scripting.enableSftpModule',
          'configuration.scripting.enableFtpModule',
          'configuration.scripting.maxCalloutRequestTimeout',
          'configuration.scripting.allowedRestrictedHttpHeaders',
          'configuration.scripting.maxCalloutRequestSize',
          'configuration.scripting.maxCalloutResponseSize',
          'configuration.scripting.maxResponseBufferSize',
          'configuration.scripting.maxJobRunsPerDay',
          'configuration.scripting.maxNotifications',
          'configuration.scripting.enableNonAccountNotifications',
          'configuration.scripting.allowBytecodeExecution',
          'configuration.scripting.enableValidators',
          'configuration.scripting.enableApiPolicies',
          'configuration.scripting.enableViewTransforms',
          'configuration.scripting.enableCustomSms',
          'configuration.scripting.maxExecutionDepth',
          'configuration.scripting.enableTimers',
          'configuration.scripting.maxScriptSize',
          'configuration.scripting.scriptsEnabled',
          'configuration.scripting.types.job.maxOps',
          'configuration.scripting.types.job.timeoutMs',
          'configuration.scripting.types.route.maxOps',
          'configuration.scripting.types.route.timeoutMs',
          'configuration.scripting.types.trigger.maxOps',
          'configuration.scripting.types.trigger.timeoutMs',
          'configuration.scripting.types.deployment.maxOps',
          'configuration.scripting.types.deployment.timeoutMs',
          'configuration.scripting.types.export.maxOps',
          'configuration.scripting.types.export.timeoutMs',
          'configuration.scripting.types.event.maxOps',
          'configuration.scripting.types.event.timeoutMs',
          'configuration.scripting.types.policy.maxOps',
          'configuration.scripting.types.policy.timeoutMs',
          'configuration.scripting.types.transform.maxOps',
          'configuration.scripting.types.transform.timeoutMs',
          'configuration.scripting.types.validator.maxOps',
          'configuration.scripting.types.validator.timeoutMs',
          'configuration.sms.internalOverCustom',
          'configuration.sms.customOverInternal',
          'configuration.researchEnabled',
          'configuration.axon.enabled',
          'configuration.axon.exports',
          'configuration.axon.trials',
          'configuration.axon.apps',
          'configuration.cortexDisabled',
          'configuration.billing.billingId',
          'configuration.minSelectablePasswordScore',
          'configuration.scriptablePasswordValidation',
          'configuration.systemPolicies',
          'configuration.storage.enableLocations',
          'creator',
          'policies.active' // to un-brick
        ],

        [acl.OrgDeveloperRole]: [],

        [acl.OrgSupportRole]: []
      },
      readablePaths = {

        [acl.OrgAdminRole]: [
          ...updatablePaths[acl.OrgAdminRole],
          '_id',
          'name',
          'code',
          'creator',
          'users',
          'configuration.fileStorageUsed',
          'configuration.docStorageUsed',
          'configuration.cacheStorageUsed',
          'configuration.package',
          'policies._id',
          'policies.label',
          'policies.active',
          'apps._id',
          'apps.label',
          'apps.name',
          'apps.clients._id',
          'apps.clients.label',
          'apps.clients.key',
          'support.disableSupportLogin',
          'support.pinnedAccount'
        ],

        [acl.OrgDeveloperRole]: [],

        [acl.OrgSupportRole]: []

      }

function isRouteMatch(route, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    if (route.match(patterns[i])) {
      return true
    }
  }
  return false
}

class HubModule {

  constructor() {
    return HubModule
  }

  static findTokenAuthenticationClient(org, iss) {

    const hub = org ? org.hub : null
    if (hub && hub.enabled && iss === hub.clientKey) {
      return this.synthesizeApplicationClient(hub).clients[0]
    }
    return null

  }

  static detectAppClient(req, clientKey) {

    const route = req.method + ' ' + req.path

    if (clientKey === config('hub.apiKey') && isRouteMatch(route, systemRoutePatterns)) {
      return this.synthesizeSystemClient()
    } else {
      const hub = req.org.hub
      if (hub && hub.enabled) {
        if (clientKey === hub.envKey && isRouteMatch(route, environmentRoutePatterns)) {
          return this.synthesizeEnvironmentClient(hub)
        } else if (req.authToken && clientKey === hub.clientKey && req.authToken.iss === clientKey) {
          return this.synthesizeApplicationClient(hub)
        }
      }
    }
    return null

  }

  static synthesizeEnvironmentClient(hub) {

    return {
      label: 'Cortex',
      _id: utils.createId('436f72746578487562456e76'),
      clients: [{
        _id: utils.createId('436f72746578487562456e76'),
        expires: null,
        label: 'Cortex',
        key: hub.envKey,
        secret: hub.envSecret,
        sessions: false,
        readOnly: false,
        enabled: true,
        patterns: environmentRoutePatterns,
        maxTokensPerPrincipal: 0
      }],
      suspended: false,
      APNs: { key: '', cert: '', debug: false },
      GCM: { apiKey: '' },
      FCM: { apiKey: '' },
      TPNS: { accessId: '', secretKey: '' },
      enabled: true
    }

  }

  static synthesizeSystemClient() {

    return {
      label: 'Cortex',
      _id: utils.createId('436f72746578487562537973'),
      clients: [{
        _id: utils.createId('436f72746578487562537973'),
        expires: null,
        label: 'Cortex',
        key: config('hub.apiKey'),
        secret: config('hub.apiSecret'),
        sessions: false,
        readOnly: false,
        enabled: true,
        patterns: systemRoutePatterns,
        maxTokensPerPrincipal: 0
      }],
      suspended: false,
      APNs: { key: '', cert: '', debug: false },
      GCM: { apiKey: '' },
      FCM: { apiKey: '' },
      TPNS: { accessId: '', secretKey: '' },
      enabled: true
    }

  }

  static synthesizeApplicationClient(hub) {

    const rsa = (hub && hub.clientRsa) || {}

    return {
      label: 'Cortex',
      _id: utils.createId('436f72746578487562417070'),
      clients: [{
        _id: utils.createId('436f72746578487562417070'),
        expires: null,
        label: 'Cortex',
        key: hub.clientKey,
        sessions: false,
        readOnly: false,
        enabled: true,
        patterns: [],
        authDuration: config('hub.authDuration'),
        maxTokensPerPrincipal: 0,
        rsa: {
          public: rsa.public,
          private: rsa.private,
          timestamp: rsa.timestamp
        },
        CORS: {
          origins: config('hub.origins')
        }
      }],
      suspended: false,
      APNs: { key: '', cert: '', debug: false },
      GCM: { apiKey: '' },
      FCM: { apiKey: '' },
      TPNS: { accessId: '', secretKey: '' },
      enabled: true
    }

  }

  static updatableEnvironmentPaths(org, roles) {
    roles = acl.expandRoles(org.roles, roles)
    return roles.reduce((paths, role) => {
      if (updatablePaths[role]) {
        return paths.concat(updatablePaths[role])
      }
      return paths
    }, [])
  }

  static readableEnvironmentPaths(org, roles) {
    roles = acl.expandRoles(org.roles, roles)
    return roles.reduce((paths, role) => {
      if (readablePaths[role]) {
        return paths.concat(readablePaths[role])
      }
      return paths
    }, [])
  }

  static async provisionEnv(payload, opts) {
    const isMarketDomain = config('app.domain') === 'market',
          body = payload || {},
          options = {
            accountPassword: utils.path(body, 'account.password'),
            validateOrgCode: utils.path(body, 'org.validateOrgCode'),
            maxApps: utils.path(body, 'org.maxApps'),
            minPasswordScore: utils.path(body, 'account.minPasswordScore'),
            requireMobile: utils.path(body, 'account.requireMobile') || false,
            requireEmail: utils.path(body, 'account.requireEmail') || true,
            requireUsername: utils.path(body, 'account.requireUsername') || false,
            ttl: utils.path(body, 'org.ttl'), /// This will be used by instance reaper worker to teardown org
            req: utils.path(opts, 'req')
          }

    if (!utils.path(body, 'account.email')) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Email is required to provision an env' })
    }

    if (!utils.path(body, 'account.name')) {
      utils.path(body, 'account.name', {
        first: 'Environment',
        last: 'Administrator'
      })
    }
    if (!utils.path(body, 'org.code')) {
      // auto generate org code
      utils.path(body, 'org.code', utils.generateOrgCode())
    }
    if (!utils.path(body, 'org.name')) {
      utils.path(body, 'org.name', body.org.code)
    }
    // Setting as ephemeral
    if (!isMarketDomain && utils.isSet(options.ttl)) {
      if (!utils.isNumeric(options.ttl)) {
        throw Fault.create('cortex.invalidArgument.invalidNumber', { reason: 'TTL argument must be a number' })
      }
      utils.path(body, 'org.ephemeral', true)
      utils.path(body, 'org.ephemeralExpireAt', new Date(new Date().getTime() + utils.rInt(options.ttl)))
    } else {
      utils.path(body, 'org.ephemeral', false)
    }

    try {
      const orgPayload = _.pick(body.org, 'code', 'name', 'ephemeral', 'ephemeralExpireAt'),
            accountPayload = _.pick(body.account, 'name', 'email', 'password'),
            result = await promised(modules.org, 'provision', orgPayload || {}, accountPayload || {}, options),
            provisionedOrg = await promised(modules.db.models.Org, 'loadOrg', result.org._id),
            admin = ap.synthesizeOrgAdmin(provisionedOrg, result.account._id),
            ac = new acl.AccessContext(admin, null, { req: options.req }),
            appPayload = {
              label: 'Default App',
              name: 'c_default_app',
              enabled: true,
              clients: [{
                CORS: {
                  origins: '*'
                },
                label: 'Default Client ',
                enabled: true,
                readOnly: false,
                allowNameMapping: true,
                sessions: rBool(utils.path(body, 'org.sessionApp'), true),
                csrf: false,
                rsa: {
                  regenerate: true
                }
              }]
            }

      await promised(modules.db.models.Org, 'aclUpdatePath', admin, result.org._id, 'apps', appPayload, { req: options.req, method: 'POST', skipAcl: true })

      // eslint-disable-next-line one-var
      const org = await promised(modules.db.models.org, 'aclReadOne', admin, result.org._id, { include: ['apps'] }),
            token = (await promised(modules.authentication, 'createToken', ac, admin, org.apps[0].clients[0].key, {
              scope: '*',
              includeEmail: true,
              permanent: true
            })).token

      return { org, account: result.account, token }
    } catch (e) {
      throw Fault.from(e)
    }
  }

  static async teardownEnv(code, options = {}) {

    // do teardown
    const sourceId = utils.createId(),
          reqId = options.req ? options.req._id : utils.createId(),
          opts = Object.assign({reap: false}, _.pick(options, 'reap'))

    let orgToTeardown, adminAccount
    return new Promise((resolve, reject) => {
      async.series([
        async() => {
          // load org
          orgToTeardown = await modules.db.models.org.loadOrg(code, opts)
          if (orgToTeardown?.configuration?.ephemeral !== true) {
            throw Fault.create('cortex.accessDenied.feature', {
              reason: 'This feature can be used to teardown ephemeral environments.'
            })
          }
        },
        callback => {
          const find = { org: orgToTeardown._id, object: 'account', reap: false, roles: acl.OrgAdminRole }
          modules.db.models.account.find(find).lean().exec((err, accounts) => {
            if (!err) {
              adminAccount = accounts[0]
            }
            callback(err)
          })
        },
        // run the refresher without preserving data.
        callback => {
          modules.workers.send('work', 'org-refresher', {
            org: orgToTeardown._id,
            options: opts,
            principal: adminAccount?._id,
            preserve: {},
            sourceId: sourceId
          }, {
            force: true,
            reqId: reqId,
            orgId: orgToTeardown._id
          }, callback)
        }

      ], function(err) {
        if (err) {
          return reject(err)
        }
        return resolve(sourceId)
      })
    })
  }

  /**
     * @param command
     * @param method
     * @param options
     *  body
     *  headers
     *  timeout (default 120000, min 1000)
     * @param callback
     */
  static request(command, method, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const url = config('hub.host') + command,
          reqOpts = {
            headers: utils.extend(options.headers, this.headers(Url.parse(command).pathname, method), {
              'Accept': 'application/json',
              'User-Agent': 'Medable API ' + utils.version()
            }),
            json: true,
            strictSSL: utils.rBool(config('hub.strictSSL'), true),
            method: method.toUpperCase(),
            timeout: Math.max(1000, utils.rInt(options.timeout, 120000))
          }

    if (options.body !== undefined && ['POST', 'PATCH', 'PUT'].includes(reqOpts.method)) {
      reqOpts.body = utils.serializeObject(options.body)
    }

    request(url, reqOpts, (err, response, body) => {

      let result

      err = Fault.from(err || body)
      if (!err) {
        if (!_.isObject(body) || !body.object) {
          err = Fault.create('cortex.error.netMissingResponse')
        } else if (!body.data) {
          err = Fault.create('cortex.error.netMissingResult')
        } else if (response.statusCode !== 200) {
          err = Fault.create('cortex.error.netInvalidResponseStatus', response.statusCode)
        } else {
          try {
            result = utils.deserializeObject(body.data)
          } catch (e) {
            err = e
          }
        }
      }

      if (err) {
        logger.error('a deployment server -> server request error', {
          url: url,
          error: err.toJSON()
        })
      }
      callback(err, result)
    })
  }

  static headers(command, method) {

    const timestamp = Date.now(),
          signature = modules.authentication.signRequest(command, method.toUpperCase(), config('hub.apiKey') + config('hub.apiSecret'), timestamp)

    return {
      'Medable-Client-Key': config('hub.apiKey'),
      'Medable-Client-Signature': signature,
      'Medable-Client-Timestamp': String(timestamp),
      'Medable-Client-Nonce': modules.authentication.generateNonce()
    }

  }

}

module.exports = HubModule
