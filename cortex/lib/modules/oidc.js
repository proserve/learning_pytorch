const { Issuer, generators, errors: { RPError }, custom } = require('openid-client'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      memoize = require('memoizee'),
      base64url = require('base64url'),
      config = require('cortex-service/lib/config'),
      { path, stringToBoolean, isUuidString, rInt } = require('../utils'),
      ap = require('../access-principal'),
      modules = require('../modules'),
      defaultRedirectUri = `https://${config('server.apiHost')}/medable/v2/sso/oidc/cb`,

      /**
       * Fetches authorization server metadata. memoized to avoid fetching metadata everytime.
       */
      getIssuer = memoize(async function(issuer) {
        return Issuer.discover(issuer)
      }, { primitive: true })

async function getClient(options) {
  const issuer = await getIssuer(options.issuer),
        client = new issuer.Client({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          redirect_uris: options.redirectUris,
          response_types: ['code']
        })
  client[custom.clock_tolerance] = 5
  return client
}

function encodeState(stateObject = {}) {
  return base64url.encode(JSON.stringify(stateObject))
}

function decodeState(value) {
  try {
    return JSON.parse(base64url.decode(value))
  } catch (e) {
    return false
  }
}

/**
 * Finds the idp configuration with provided uuid, will return first result if null.
 * @param {object} org req org
 * @param {string} identifier unique identifier of idp, could be uuid or name
 * @returns
*/
async function findIdp(org, identifier = null) {
  const where = { type: 'oidc', org: org._id }
  if (identifier) {
    if (isUuidString(identifier)) {
      where.uuid = identifier
    } else {
      where.name = identifier
    }
  }

  return new Promise((resolve, reject) => {
    modules.db.models.idp.aclReadOne(ap.synthesizeAnonymous(org), null, { where, override: true, allowNullSubject: true }, (err, result) => {
      if (err) {
        return reject(err)
      }

      resolve(result)
    })
  })
}

module.exports = {
  findIdp,
  encodeState,
  decodeState,
  getAuthorizationUrl: async(req, options) => {
    const client = await getClient(options),
          codeVerifier = generators.codeVerifier(),
          codeChallenge = generators.codeChallenge(codeVerifier),
          authorizationParams = Object.fromEntries((options.authorizationParams || []).map(p => [p.key, p.value])),
          maxAge = rInt(authorizationParams.max_age),
          forceAuthn = stringToBoolean(path(req, 'query.force_authn') || options.forceAuthn, false),
          relogin = stringToBoolean(path(req, 'query.relogin'), false),
          returnTo = path(req, 'query.return_to'),
          state = encodeState({
            nonce: generators.nonce(),
            idp: options?.uuid,
            orgCode: req.orgCode,
            relogin
          }),
          fixedAuthParams = {
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state,
            prompt: forceAuthn || maxAge === 0 ? 'login' : undefined
          }

    if (!req.session) {
      throw Fault.create(`cortex.error.sessionRequired`)
    }

    // session should include: codeVerifier, returnTo, state(nonce)
    req.session.oidc = {
      codeVerifier,
      maxAge,
      state,
      returnTo
    }

    // params should include: redirect_uri, scope, state, max_age, code_challenge, code_challenge_method, ...
    return client.authorizationUrl({
      redirect_uri: defaultRedirectUri,
      scope: 'openid email profile',
      ...authorizationParams,
      ...fixedAuthParams
    })
  },

  callback: async(req, options) => {

    const client = await getClient(options),
          params = client.callbackParams(req),
          { codeVerifier, maxAge, state, redirectUri } = options

    let checks = {
          code_verifier: codeVerifier,
          max_age: maxAge,
          response_type: 'code',
          state
        },
        email, username, tokenSet, claims

    tokenSet = await client.callback(redirectUri || defaultRedirectUri, params, checks).catch(err => {
      logger.error('Problem with callback to auth server', err)
      throw Fault.create(`cortex.oidc.${err.error}`, err.message, err instanceof RPError ? 400 : 500)
    })

    claims = tokenSet.claims()
    email = claims.email
    username = claims.preferred_username || claims.username

    if (!email && !username) {
      logger.error(`Missing email or username claims. Claims:`, claims)
      throw Fault.create(`cortex.oidc.missing_claims`, `id_token must contain email or username claim`, 500)
    }

    return { email, username }
  }
}
