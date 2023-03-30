'use strict'

const Fault = require('cortex-service/lib/fault'),
      middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      _ = require('lodash'),
      validUrl = require('valid-url'),
      ap = require('../../../access-principal'),
      { asyncHandler, promised, path } = require('../../../utils')

function ssoEnabledCheck(req, res, next) {
  if (req?.org?.configuration?.loginMethods?.includes('sso')) {
    return next()
  }
  return next(Fault.create('cortex.accessDenied.invalidLoginMethod', { reason: 'SSO login method not enabled on the org' }))
}

async function recordLoginEvent(req, account, metadata, err) {
  const principal = await promised(ap, 'create', req.org, account).catch(_ => ap.synthesizeAnonymous(req.org)),
        ac = new acl.AccessContext(principal, account, { req })

  return promised(modules.audit, 'recordEvent', ac, 'authentication', 'login', { err, context: { object: 'account', _id: account?._id }, metadata }).catch(err => logger.warn('Failed to record login event', err))
}

async function loadAccount(org, claims) {
  let email = claims?.email,
      username = claims?.username,
      account

  try {
    account = await promised(modules.authentication, 'loadAccount', { org, email, username, checkLock: true, loginMethod: 'sso' })
  } catch (err) {
    if (err.code === 'kInvalidCredentials' && modules.validation.isEmail(username)) {
      email = username
      username = null
      account = await promised(modules.authentication, 'loadAccount', { org, email, checkLock: true, loginMethod: 'sso' })
    } else {
      throw Fault.from(err)
    }
  }

  return account
}

async function doCallback(req, res, options) {
  const { returnTo, relogin } = options,
        isLoggedIn = req.principal.isAuthenticated()

  let account, loginHandler, claims

  try {
    claims = await modules.oidc.callback(req, options)

    account = await loadAccount(req.org, claims)

    if (!isLoggedIn || relogin) {
      loginHandler = util.promisify(middleware.login({
        account,
        sso: claims,
        verifyLocation: false
      }))

      await loginHandler(req, res)

    }

    recordLoginEvent(req, account, { ...claims, sso: true })

    if (validUrl.isWebUri(returnTo)) {
      return res.redirect(302, returnTo)
    }

    return promised(modules.db.models.account, 'aclReadOne', req.principal, req.principal._id, { req: req })

  } catch (err) {
    logger.warn(`Failed sso callback`, err)

    recordLoginEvent(req, account, { ...claims, sso: true }, err)

    if (!isLoggedIn) {
      // destroy session on error
      await promised(modules.sessions, 'destroy', req)
    }

    if (validUrl.isWebUri(returnTo)) {
      let url = new URL(returnTo)

      url.searchParams.append('error', err.errCode)
      url.searchParams.append('error_description', err.message)

      return res.redirect(302, url)
    }

    throw err
  }
}

module.exports = function(express, router) {

  /**
   * redirects user to authorization endpoint.
   */
  router.get('/sso/oidc/login',
    middleware.client_detection({ defaultToWebApp: true }),
    middleware.policy,
    ssoEnabledCheck,
    middleware.session_initializer({ regenerateExpired: true }),
    asyncHandler(async(req, res) => {
      const authConfig = await modules.oidc.findIdp(req.org, req.query.idp)
      if (!authConfig) {
        throw Fault.create('cortex.notFound.instance')
      }

      let url = await modules.oidc.getAuthorizationUrl(req, authConfig)

      res.redirect(302, url)
    })
  )

  /**
   * Redirect to org-specific authorization callback
   */
  router.get('/sso/oidc/cb',
    middleware.policy,
    middleware.client_detection({ defaultToWebApp: true }),
    asyncHandler(async(req, res) => {
      const { orgCode } = modules.oidc.decodeState(path(req, 'query.state')),
            url = new URL(`https://${config('server.apiHost')}/${orgCode}/v2/sso/oidc/callback`)

      for (const param in req.query) {
        url.searchParams.append(param, req.query[param])
      }

      return res.redirect(302, url)
    })
  )

  /**
   * Authorization callback
   */
  router.get('/sso/oidc/callback',
    middleware.policy,
    middleware.client_detection({ defaultToWebApp: true }),
    ssoEnabledCheck,
    middleware.authorize.anonymous,
    asyncHandler(async(req, res) => {

      const { idp, relogin } = modules.oidc.decodeState(path(req, 'query.state')),
            { codeVerifier, maxAge, state, returnTo } = req.session?.oidc || {}

      if (!idp) {
        throw Fault.create('cortex.notFound.instance')
      }

      let authConfig = await modules.oidc.findIdp(req.org, idp)

      if (!authConfig) {
        throw Fault.create('cortex.notFound.instance')
      }

      return doCallback(req, res, { ...authConfig, codeVerifier, maxAge, state, relogin, returnTo })

    })
  )

  /**
   * Get org native client authorization parameters.
   */
  router.get('/sso/oidc/native/params',
    middleware.client_detection({ defaultToWebApp: true }),
    middleware.policy,
    ssoEnabledCheck,
    asyncHandler(async(req, res) => {
      const authConfig = await modules.oidc.findIdp(req.org, req.query.idp || 'native')

      if (!authConfig) {
        throw Fault.create('cortex.notFound.instance')
      }

      return _.pick(authConfig, ['name', 'label', 'uuid', 'type', 'clientId', 'issuer', 'authorizationParams', 'redirectUri'])
    })
  )

  router.get('/sso/oidc/native/callback',
    middleware.policy,
    middleware.authorize.anonymous,
    middleware.client_detection({ defaultToWebApp: true }),
    ssoEnabledCheck,
    asyncHandler(async(req, res) => {

      const authConfig = await modules.oidc.findIdp(req.org, req.query.idp)
      if (!authConfig) {
        throw Fault.create('cortex.notFound.instance')
      }

      let authorizationParams = Object.fromEntries((authConfig.authorizationParams || []).map(p => [p.key, p.value])),
          codeVerifier = path(req, 'query.code_verifier'),
          maxAge = authorizationParams.max_age || path(req, 'query.max_age')

      return doCallback(req, res, { ...authConfig, codeVerifier, maxAge })
    })
  )
}
