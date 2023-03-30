'use strict'

const {
        path: pathTo, array: toArray, resolveOptionsCallback, toJSON,
        isValidDate, intersectIdArrays, getIdArray,
        ensureCallback, isInt, rInt, isPlainObject, rString, isUuidString,
        getValidDate, getIdOrNull, equalIds, createId, promised, isSet, couldBeId,
        is_ipv4: isIPV4, is_cidr: isCIDR, isCustomName, contains_ip: containsIp, getClientIp, inIdArray
      } = require('../utils'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../modules'),
      ap = require('../access-principal'),
      bcrypt = require('bcrypt'),
      _ = require('underscore'),
      { IncomingMessage } = require('http'),
      logger = require('cortex-service/lib/logger'),
      async = require('async'),
      crypto = require('crypto'),
      config = require('cortex-service/lib/config'),
      pathToRegExp = require('path-to-regexp'),
      cp = require('child_process'),
      consts = require('../../lib/consts'),
      acl = require('../../lib/acl'),
      jwt = require('jsonwebtoken'),
      passport = require('passport'),
      humanizeDuration = require('humanize-duration'),
      cookieParser = require('cookie-parser')(config('sessions.secret')),
      FQPP_PART_REGEXP = /^[a-z0-9-_]{1,40}(\[\])?(#)?(#[a-z0-9-_]{1,40})?$/i,
      SCOPE_CONDITION_TESTS = {
        $fqpp: function(scopeParts, idx) {
          for (; idx < scopeParts.length; idx++) {
            if (!FQPP_PART_REGEXP.test(scopeParts[idx])) {
              return false
            }
          }
          return true
        },
        $uniqueKey: function(scopeParts, idx) {
          const str = scopeParts.slice(3).join('.')
          return couldBeId(str) || isCustomName(str) || isUuidString(str)
        }
      }

let Undefined

// configure passport account loading/storage.
passport.serializeUser(function(principal, callback) {
  callback(null, { accountId: principal._id, orgId: principal.orgId })
})

// unused. see notes in authenticate @todo remove
passport.deserializeUser(function(user, callback) {
  ap.create(user.orgId, user.accountId, function(err, principal) {
    callback(err, principal)
  })
})

Object.defineProperty(IncomingMessage.prototype, 'principalId', {
  get: function() {
    return this.principal ? this.principal._id : null
  }
})

class AuthenticationModule {

  constructor() {

    this._password_salt_rounds = 10
    this._chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    this._pools = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      '0123456789',
      '!@#$%^&*()_=+/.,~\'"[]{}|>?<'
    ]
    this._fingerprint_length = 40
    this._alphanum_pattern = new RegExp('^([0-9a-z-A-Z])*$', 'i')
    this._nonce_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    this._nonce_maxc = this._nonce_chars.length - 1

  }

  /**
     * @param req
     * @param apiKey
     * @param apiSecret
     * @param allowUnsigned (default false). if true, allows requests without a signature to pass.
     * @param callback -> err, signature
     */
  validateSignedRequest(req, apiKey, apiSecret, allowUnsigned, callback) {

    const signature = req.header('medable-client-signature'),
          command = '/' + req.path.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, ''),
          method = req.method,
          secret = apiKey + apiSecret,
          timeout = 900000, // clocks can be out by 15 minutes. 1000*60*15
          timestamp = new Date(parseInt(req.header('medable-client-timestamp'))),
          nonce = req.header('medable-client-nonce')

    if (!signature && allowUnsigned) {
      // allow this to pass through unsigned.
      callback()
    } else if (!signature || signature.length !== 64 || !nonce || nonce.length !== 16 || isNaN(timestamp.getTime())) {
      // the request must have a signature with a timestamp, a 16-byte nonce, a 64-byte signature.
      callback(Fault.create('cortex.accessDenied.invalidRequestSignature'))
    } else if (signature !== this.signRequest(command, method, secret, timestamp)) {
      callback(Fault.create('cortex.accessDenied.invalidRequestSignature'))
    } else if (Math.abs(timestamp.getTime() - Date.now()) > timeout) {
      callback(Fault.create('cortex.invalidArgument.staleRequestSignature'))
    } else {
      modules.db.models.RequestNonce.checkAndRegister(timeout, signature, nonce, err => {
        callback(err, signature)
      })
    }
  }

  /**
   *
   * @param command
   * @param method
   * @param secret
   * @param timestamp
   * @returns {string}
   */
  signRequest(command, method, secret, timestamp) {

    timestamp = _.isDate(timestamp) ? timestamp.getTime() : (_.isNumber(timestamp) ? timestamp : new Date().getTime())
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(command + ';' + method + ';' + timestamp)
    return hmac.digest('hex')

  }

  /**
   *
   * @param min
   * @param max
   * @returns {number}
   */
  randomInt(min, max) {
    const bytesSlowBuf = crypto.randomBytes(8)
    let rand = bytesSlowBuf.readUInt32LE(0)
    if (min !== Undefined) {
      if (min > max) { let tmp = max; max = min; min = tmp }
      let diff = max - min + 1
      rand = Math.floor(diff * rand / 0xffffffff) + min
    }
    return rand
  }

  /**
   *
   * @param len
   * @returns {*|string}
   */
  genAlphaNum(len) {
    const buf = Buffer.allocUnsafe(len)
    for (let i = 0; i < len; ++i) {
      buf.write(this._chars[this.randomInt(0, 61)], i, 1)
    }
    return buf.toString()
  }

  /**
   *
   * @param len
   * @returns {*|string}
   */
  genAlphaNumSym(len) {

    // make sure we have a more or less equal number of types of characters.
    const chars = [],
          buf = Buffer.allocUnsafe(len)

    for (let i = 0; i < len; ++i) {
      const pool = this._pools[i % this._pools.length]
      chars.push(pool[this.randomInt(0, pool.length - 1)])
    }

    // scramble the results and write to the buffer.
    for (let i = 0; i < len; ++i) {
      const idx = this.randomInt(0, chars.length - 1)
      buf.write(chars[idx], i, 1)
      chars.splice(idx, 1)
    }
    return buf.toString()
  }

  /**
   *
   * @param len
   * @returns {*|string}
   */
  genAlphaNumString(len) {
    return this.genAlphaNum(len)
  }

  /**
   *
   * @param len
   * @returns {*|string}
   */
  generatePassword(len) {
    return this.genAlphaNumSym(len)
  }

  /**
   *
   * @param callback -> err, salt
   * @returns {*}
   */
  generateSalt(callback) {
    return bcrypt.genSalt(this._password_salt_rounds, callback)
  }

  /**
   *
   * @returns {*|string}
   */
  generateFingerprint() {
    return this.genAlphaNum(this._fingerprint_length)
  }

  /**
   *
   * @param password
   * @param callback -> err, hash
   */
  hashPassword(password, callback) {
    this.generateSalt((err, salt) => {
      if (err) callback(err, null)
      else bcrypt.hash(password, salt, callback)
    })
  }

  /**
   *
   * @param password
   * @param hash
   * @param callback
   * @returns {*}
   */
  verifyPassword(password, hash, callback) {
    return bcrypt.compare(password || '', hash, callback)
  }

  /**
   *
   * @param str
   * @returns {boolean}
   */
  isFingerprint(str) {
    return typeof str === 'string' && str.length === this._fingerprint_length && str.match(this._alphanum_pattern) !== null
  }

  /**
   *
   * @param str
   * @param len
   * @returns {boolean}
   */
  isCallbackToken(str, len) {
    return typeof str === 'string' && (!len || str.length === len) && str.match(this._alphanum_pattern) !== null
  }

  /**
   *
   * @returns {string}
   */
  generateNonce() {
    let nonce = '', length = 16
    while (length--) {
      nonce += this._nonce_chars[Math.round(Math.random() * this._nonce_maxc)]
    }
    return nonce
  }

  /**
   *
   * @param org
   * @param email
   * @param username
   * @param identifierProperty
   * @param identifierValue
   * @param checkLock
   * @param callback -> err, account
   * @returns {*}
   */
  loadAccount({ org, email, username, identifierProperty, identifierValue, checkLock, loginMethod }, callback = () => {}) {

    Promise.resolve(null)
      .then(async() => {

        if (!org) {
          throw Fault.create('cortex.error.unspecified', { reason: 'General authentication failure.' })
        }

        let account, loginMethods

        const readOptions = {
                skipAcl: true,
                forceSingle: true
              },
              internalWhere = this.resolveAuthenticationSelectors(org, { email, username }),
              model = await (async() => {
                let m
                try {
                  m = await org.createObject('account')
                } catch (err) {
                  m = modules.db.models.account
                }
                return m
              })(),
              identifierNode = isCustomName(identifierProperty) && model.schema.node.findNode(identifierProperty),
              isValidIdentifier = identifierNode && identifierNode.indexed && identifierNode.unique && identifierNode.readable && identifierNode.getTypeName() === 'String'

        if (!internalWhere.email && !internalWhere.username && (!identifierProperty || (identifierProperty && !isValidIdentifier))) {
          throw Fault.create('cortex.accessDenied.invalidCredentials')
        } else if (isValidIdentifier) {
          readOptions.where = { [identifierProperty]: identifierValue }
        } else {
          readOptions.internalWhere = internalWhere
        }

        try {
          account = await promised(
            model,
            'aclLoad',
            ap.synthesizeAnonymous(org),
            readOptions
          )
        } catch (err) {
          if (err.errCode === 'cortex.notFound.instance') {
            throw Fault.create('cortex.accessDenied.invalidCredentials')
          }

          logger.error('password authentication lookup failed', toJSON(err, { stack: true }))
          throw Fault.create('cortex.error.unspecified', { reason: 'Unhandled account access error' })
        }

        loginMethods = Array.isArray(account.loginMethods) && account.loginMethods.length ? account.loginMethods : org.configuration.loginMethods

        if (loginMethod === 'sso' && !loginMethods.includes('sso')) {
          throw Fault.create('cortex.accessDenied.invalidLoginMethod', { reason: 'SSO login method not enabled on the account' })
        }

        // is the account locked? will the lock expire? if, so, when?
        if (checkLock) {

          if (account.locked) {
            if (account.security.lockExpires) {
              const unlockAfterMs = org.security.unauthorizedAccess.lockDuration * 60000
              if (unlockAfterMs) {
                if (((Date.now() - account.security.lockedAt.getTime()) - unlockAfterMs) >= 0) {
                  account.security.lockedAt = Undefined
                  account.security.lockExpires = Undefined
                  account.security.attempts = 0
                  account.locked = false
                }
              }
            }
          }

          if (account.locked) {
            throw Fault.create('cortex.accessDenied.accountLocked')
          }
        }

        if (account.isModified()) {
          try {
            await promised(
              new acl.AccessContext(ap.synthesizeAnonymous(org), account),
              'lowLevelUpdate'
            )
          } catch (err) {
            logger.error('Error updating account security lock properties', toJSON(err, { stack: true }))
          }
        }

        return account

      })
      .then(result => callback(null, result))
      .catch(err => callback(err))

  }

  resolveAuthenticationSelectors(org, data, { allowIdentifier = false } = {}) {

    let out = {}

    const { enableEmail, enableUsername } = org.configuration.accounts

    // normalize to object
    if (couldBeId(data)) {
      data = { _id: data }
    } else if (modules.validation.isEmail(data)) {
      data = { email: data }
    } else if (_.isString(data)) {
      data = { username: data }
    } else if (!isSet(data)) {
      data = {}
    }

    // select based on org configuration
    if (allowIdentifier && couldBeId(data._id)) {
      out._id = getIdOrNull(data._id)
    }
    if (enableEmail && modules.validation.isEmail(data.email)) {
      out.email = data.email.toLowerCase()
    }
    if (enableUsername && _.isString(data.username)) {
      out.username = data.username
    }

    return out
  }

  /**
   *
   * @param org
   * @param emailOrUsername
   * @param password
   * @param options
   * @param callback -> err, account
   */
  attemptAuth(org, emailOrUsername, password, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    options = {
      checkLock: true,
      checkExpired: true,
      script: null,
      req: null,
      ...options,
      ...this.resolveAuthenticationSelectors(org, emailOrUsername), // { email, username }
      org
    }

    const { email, username } = options,

          login = callback => {

            this.loadAccount(options, (err, account) => {
              if (err) {
                return callback(err, account)
              }

              const loginMethods = Array.isArray(account.loginMethods) && account.loginMethods.length ? account.loginMethods : org.configuration.loginMethods

              if (!loginMethods.includes('credentials') && !inIdArray(account.roles, consts.roles.admin)) {
                return callback(Fault.create('cortex.accessDenied.invalidLoginMethod', { reason: 'Credentials login method not enabled' }), account)
              }

              this.verifyPassword(password, account.password, (err, result) => {
                if (err) {
                  logger.error('password verification subsystem reported an error.', toJSON(err, { stack: true }))
                  return callback(Fault.create('cortex.error.unspecified', { reason: 'Unhandled account access error' }), account)
                } else if (!result) {
                  return this.failAuthAttempt(org, account, callback)
                }

                // if password has expired, set password change flag
                let mustResetPassword = pathTo(account, 'stats.mustResetPassword')
                if (!mustResetPassword) {
                  let passwordExpires = pathTo(account, 'stats.passwordExpires')
                  if (org.configuration.passwordExpiryDays > 0) {
                    const lastPasswordReset = pathTo(account, 'stats.lastPasswordReset') || account.created,
                          expiresUsingOrgSetting = new Date(lastPasswordReset.getTime() + (86400000 * org.configuration.passwordExpiryDays))
                    if (!isValidDate(passwordExpires) || expiresUsingOrgSetting < passwordExpires) {
                      passwordExpires = expiresUsingOrgSetting
                    }
                  }
                  if (isValidDate(passwordExpires) && passwordExpires <= new Date()) {
                    mustResetPassword = true
                  }
                }
                if (options.checkExpired && mustResetPassword) {
                  if (options.newPassword) {
                    if (options.newPassword === password) {
                      callback(Fault.create('cortex.accessDenied.duplicatePassword'), account)
                    } else {
                      ap.create(org, account, (err, principal) => {
                        if (err) {
                          return callback(err, account)
                        }
                        const ac = new acl.AccessContext(principal, account, { override: true, method: 'put' })
                        account.aclWrite(ac, { password: options.newPassword }, err => {
                          if (err) {
                            return callback(err, account)
                          }
                          ac.save({ versioned: false, changedPaths: ['password'] }, err => {
                            if (err) {
                              return callback(err, account)
                            }
                            this.succeedAuthAttempt(org, account, callback)
                          })
                        })
                      })
                    }
                  } else {
                    callback(Fault.create('cortex.accessDenied.passwordExpired'), account)
                  }
                } else {
                  this.succeedAuthAttempt(org, account, callback)
                }
              })
            })

          }

    login((err, account) => {

      async.waterfall(
        [
          callback => {
            if (account) {
              ap.create(org, account, (err, principal) => {
                if (err) {
                  principal = ap.synthesizeAnonymous(org)
                }
                callback(null, principal)
              })
            } else {
              callback(null, ap.synthesizeAnonymous(org))
            }
          },
          (principal, callback) => {
            const ac = new acl.AccessContext(principal, account, { req: options.req, script: options.script }),
                  context = {
                    object: 'account',
                    _id: (account && account._id)
                  }
            modules.audit.recordEvent(ac, 'authentication', 'login', { err, context, metadata: { email, username } }, () => {
              callback()
            })
          }
        ],
        () => callback(err, account)
      )

    })

  }

  /**
   *
   * @param org
   * @param account
   * @param callback -> err, account
   * @returns {*}
   */
  failAuthAttempt(org, account, callback) {

    if (!isInt(account.security.attempts)) {
      account.security.attempts = 1
    } else {
      account.security.attempts++
    }

    // check if need to lock the account or notify.
    const lockAttempts = org.security.unauthorizedAccess.lockAttempts,
          err = Fault.create('cortex.accessDenied.invalidCredentials'),
          accountAc = new acl.AccessContext(ap.synthesizeAnonymous(org), account)

    if (lockAttempts > 0 && account.security.attempts >= lockAttempts) {

      // notify account holder.
      org.sendNotification('AccountAuthLocked', {
        account: account,
        variables: {
          attempts: account.security.attempts,
          duration: org.security.unauthorizedAccess.lockDuration === 0 ? '' : humanizeDuration(org.security.unauthorizedAccess.lockDuration * 60000),
          durationMinutes: org.security.unauthorizedAccess.lockDuration
        }
      })
      account.security.lockedAt = new Date()
      account.security.lockExpires = org.security.unauthorizedAccess.lockDuration > 0
      account.locked = true

    }

    if (account.locked) {
      err.add(Fault.create('cortex.accessDenied.accountLocked'))
    }

    if (!account.isModified()) {
      return callback(err, account)
    }

    accountAc.lowLevelUpdate(e => {
      if (e) {
        logger.error('Error updating account security lock properties', e.toJSON())
      }
      if (account.locked) {
        // Log audit for account locked
        modules.audit.recordEvent(accountAc, 'account', 'locked', { metadata: { message: 'Account access has been disabled.' } })
      }
      callback(err, account)
    })

  }

  /**
   *
   * @param org
   * @param account
   * @param callback -> err, account
   * @returns {*}
   */
  succeedAuthAttempt(org, account, callback) {

    account.security.attempts = 0
    if (!account.isModified()) {
      return callback(null, account)
    }
    new acl.AccessContext(ap.synthesizeAnonymous(org), account).lowLevelUpdate(e => {
      if (e) {
        logger.error('Error updating account security lock properties', e.toJSON())
      }
      callback(null, account)
    })

  }

  /**
   *
   * @param bits
   * @param callback -> err, { public, private }
   */
  genRsaKeypair(bits = 2048, callback) {

    if (_.isFunction(bits)) {
      callback = bits; bits = 2048
    } else {
      callback = ensureCallback(callback)
    }

    cp.exec(
      `openssl genrsa ${rInt(bits, 2048)}`,
      {
        timeout: 5000
      },
      (err, priv) => {
        if (err) {
          return callback(err)
        }
        const child = cp.exec(
          'openssl rsa -pubout',
          {
            timeout: 1000
          },
          (err, pub) => {
            callback(err, { pub, priv })
          })
        child.stdin.write(priv)
      }
    )

  }

  /**
   *
   * @param req
   * @param res
   * @param options
   *      create: boolean (default false) - generates a new fingerprint if not present and sets the cookie.
   *      allowNull: boolean(default false) - if no fingerprint is found, allow don't throw (callback with a null fingerprint).
   *      fingerprint: a pre-defined fingerprint
   *
   * @param callback -> err, fingerprint
   */
  readFingerprint(req, res, options, callback) {

    options = options || {}
    cookieParser(req, res, err => {
      let fingerprint = null
      if (!err) {
        fingerprint = options.fingerprint || req.signedCookies[config('fingerprint.cookieName')]
        let isFingerprint = this.isFingerprint(fingerprint)
        if (!fingerprint && options.allowNull) {
          fingerprint = null
        } else {
          if (!isFingerprint && options.create) {
            fingerprint = this.generateFingerprint()
            isFingerprint = true
            res.cookie(config('fingerprint.cookieName'), fingerprint, config('fingerprint.cookieOptions'))
          }
          if (!isFingerprint) {
            err = Fault.create('cortex.invalidArgument.locationFingerprint')
          }
        }
      }
      callback(err, fingerprint)
    })
  }

  /**
   *
   * @param org
   * @param scope
   * @returns {*}
   */
  validateAuthScope(org, scope) {
    if (!this.isValidScope(org, scope)) {
      throw Fault.create('cortex.invalidArgument.authScope', { path: scope })
    }
    return scope
  }

  /**
   *
   * @param org
   * @param scope
   * @returns {boolean}
   */
  isValidScope(org, scope) {

    if (!org || !_.isString(scope)) {
      return false
    }

    const scopeParts = scope.split('.'),
          chain = consts.auth.scopes.find(chain => chain[0] === scopeParts[0])

    if (!chain) {
      return false
    }

    // logical rejections

    // ws requires org configuration
    if (scopeParts[0] === 'ws' && !pathTo(org.configuration, 'allowWsJwtScopes')) {
      return false
    }

    // object.create.* anything after if unnecessary.
    if (scopeParts[0] === 'object' && scopeParts[1] === 'create' && scopeParts.length > 3) {
      return false
    }
    // object.delete.*.* anything after if unnecessary.
    if (scopeParts[0] === 'object' && scopeParts[1] === 'delete' && scopeParts.length > 4) {
      return false
    }

    // notifications are not scopable on delete
    if (scopeParts[0] === 'object' && scopeParts[1] === 'delete' && scopeParts[2] === 'notification' && scopeParts.length > 3) {
      return false
    }

    // templates are not scopable to identifier
    if (scopeParts[0] === 'object' && scopeParts[2] === 'template' && scopeParts.length > 3) {
      return false
    }

    for (let scopeIdx = 1; scopeIdx < scopeParts.length; scopeIdx++) {

      const chainPart = toArray(chain[scopeIdx], chain[scopeIdx] !== Undefined),
            scopePart = scopeParts[scopeIdx]

      let chainPartMatch = false

      for (let chainIdx = 0; chainIdx < chainPart.length; chainIdx++) {

        const chainElement = chainPart[chainIdx]

        if (_.isString(chainElement)) {
          const conditionTest = SCOPE_CONDITION_TESTS[chainElement]
          if (conditionTest) { // a condition test matches against the rest of the chain.
            if (conditionTest(scopeParts, scopeIdx)) {
              return true
            }
          } else if (chainElement === scopePart) {
            chainPartMatch = true; break
          }
        } else if (_.isRegExp(chainElement)) {
          if (chainElement.test(scopePart)) {
            chainPartMatch = true; break
          }
        } else {
          return false
        }
      }

      if (!chainPartMatch) {
        return false
      }

    }

    return true
  }

  /**
     * @param outer if null true is returned. this means there is no scoping.
     * @param requiredScope required scope string. (e.g. 'view.execute.c_my_view'])
     * @param accept_prefix_match returns true on prefix matches (e.g. ['object', 'read', 'account', '590a328a3bde982681988272', 'name']
     *        where compiled scope contains 'object.read.*.*.name.first). useful for checking mid-scope chain
     * @param exact_match false. if true, # are not split and matches must be exact.
     * @returns {boolean}
     */
  authInScope(outer, requiredScope, accept_prefix_match = true, exact_match = false) {
    return !outer || isInScope(outer, String(requiredScope), accept_prefix_match, exact_match, 0)
  }

  /**
   *
   * @param scope
   * @returns {*}
   */
  compileAuthScope(scope) {

    // detect objects
    if (isPlainObject(scope)) {
      scope = this.scopeToStringArray(scope)
    }

    // format
    scope = toArray(scope, scope)
      .reduce((scope, v) => {
        return [...scope, ...(isPlainObject(v) ? this.scopeToStringArray(v) : toArray(v, v)).map(v => rString(v, '').trim())]
      }, [])
      .filter(v => v)
      .map(v => v.split('.').map(v => rString(v, '').trim()).filter(v => v))
      .filter(v => v.length)

    // remove trailing *
    scope.forEach(entry => {
      let idx = entry.length - 1
      while (idx > 1) {
        if (entry[idx] !== '*') {
          break
        }
        idx--
      }
      entry.length = idx + 1
    })

    // sort the scope so * are always first. this helps in the next step to build without having to merge or cull.
    scope.sort(scopeSort)

    // compile an optimized scope object from the sorted scope, while avoiding writing any duplicates.
    return scope.reduce((scope, parts) => {

      for (let idx = 0, current = scope; idx < parts.length; idx++) {

        const part = parts[idx]

        if (anyBranchesMatch(current, parts, idx)) {
          break
        } else if (idx === (parts.length - 1)) {
          current[part] = true
          break
        } else if (current[part] === true) {
          break
        } else if (current[part] === Undefined) {
          current = current[part] = {}
        } else {
          current = current[part]
        }
      }
      return scope
    }, {})

  }

  /**
   * @param scopeString
   */
  optimizeAuthScope(scopeString) {
    return this.scopeToStringArray(this.compileAuthScope(scopeString))
  }

  /**
   *
   * @param compiledScope
   * @returns {*[]}
   */
  scopeToStringArray(compiledScope) {
    return compiledScopeToArray(compiledScope)
      .sort(scopeSort)
      .map(v => v.join('.'))
      .filter(v => v)
  }

  /**
   * @notes tokens are pessimistic. no scopes means nothing allowed. scopes are additive.
   *
   * @param ac
   * @param principalDoc the subject principal. can be a principal, account doc, email, or account _id.
   * @param apiKey the issuer, which must be an existing api key with an rsa key pair
   * @param options
   *  skipAcl: boolean (false)
   *  bypassCreateAcl boolean(false)
   *  grant: number (0) grants the token user the grant level.
   *  permanent: boolean (false) if true, creates an auth token that can be used forever, and can be revoked by token id or by regenerating the app's rsa key pair. incompatible with expiresIn.
   *  activatesIn: optional number of seconds until the token activates. incompatible with validAt. expiresIn must exist to use this option.
   *  validAt: optional  date when the token activates. incompatible with activatesIn. expiresIn must exist to use this option.
   *  expiresIn: number the number of seconds the token will be active, >= 1. incompatible with permanent. defaults to the app authDuration (typically 900 seconds).
   *  scope: string[] scopes to which the token is limited. if no scopes are passed, [] is assumed.
   *  roles: objectid[] additional roles granted to the token principal at runtime. scopes attached to roles are processed at runtime.
   *  policy: object[] restrict to a set of policies
   *    ipv4: []  restricts use to a list of ip addresses or CIDR ranges
   *    method: [] restricts use to a set of http methods (get, patch, post, put, delete)
   *    route: [] restricts use to a set of matching route patterns
   *    path: [] restricts access to a set of explicit paths
   *    tag: [] user-defined tags that can be checked against. these must follow the custom name convention (c_ or env__)
   *  isSupportLogin: true if support login is passed along to the token.
   *  maxUses: limits the number of uses. each time the token is verified.
   *  includeEmail: includes a cortex/eml claim which adds the principal's email address,
   *  client: INTERNAL_USE_ONLY!
   *  isPrivileged: INTERNAL_USE_ONLY allows skipAcl, grant, roles, bypassCreateAcl options from a non-privileged call
   *    and apply them to cursors.
   *
   * @param callback -> err, { token, principal }
   */
  createToken(ac, principalDoc, apiKey, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    Promise.resolve(null)
      .then(async() => {

        let client = options.client,
            notBefore = null,
            expiresAt = null,
            tokenZeroStart,
            principal,
            token,
            signingErr

        if (!client) {
          if (apiKey === config('webApp.apiKey')) {
            throw Fault.create('cortex.notFound.app')
          }
          client = issuerToClient(ac, apiKey)
          if (!client) {
            throw Fault.create('cortex.notFound.app')
          }
        }
        if (!client.rsa || !client.rsa.private) {
          throw Fault.create('cortex.notFound.appRsa')
        }

        const privateKey = client.rsa.private,
              unixTimestamp = Math.floor(Date.now() / 1000),
              payload = {
                aud: `https://${config('server.apiHost')}/${ac.org.code}/v2`,
                iss: client.key,
                iat: unixTimestamp
              },
              header = {
                alg: 'RS512',
                type: 'JWT',
                kid: client.rsa.timestamp.getTime()
              },
              scope = this.optimizeAuthScope(options.scope),
              roles = getIdArray(toArray(options.roles, options.roles)),
              policy = toArray(options.policy, options.policy),
              isPermanent = Boolean(options.permanent),
              isLimited = (options.maxUses !== Undefined && options.maxUses !== null)

        scope.forEach(scope => {
          this.validateAuthScope(ac.org, scope)
        })

        if (scope.length) {
          payload['cortex/scp'] = scope
        }

        if (roles.length) {
          const registered = ac.org.roles.map(function(v) { return v._id })
          if (intersectIdArrays(consts.defaultRoleIds.slice(), roles).length > 0) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Built-in roles cannot be claimed.' })
          } else if (intersectIdArrays(registered, roles).length !== roles.length) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'A claimed role does not exist.' })
          }
          payload['cortex/rls'] = roles.map(v => v.toString())
        }

        if (policy.length) {
          const pols = []
          for (let i = 0; i < policy.length; i++) {
            const pol = this.createPolicy(ac, policy[i])
            if (pol) {
              pols.push(pol)
            }
          }
          if (pols.length) {
            payload['cortex/pol'] = pols.length === 1 ? pols[0] : pols
          }
        }

        if (options.skipAcl) {
          payload['cortex/skp'] = true
        }

        if (options.bypassCreateAcl) {
          payload['cortex/skc'] = true
        }

        if (options.grant !== null && options.grant !== Undefined) {
          payload['cortex/gnt'] = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
        }

        if (options.isSupportLogin) {
          payload['cortex/spt'] = true
        }

        if (options.isPrivileged) {
          payload['cortex/prv'] = true
        }

        if (options.validAt !== Undefined && options.validAt !== null) {
          if (isPermanent) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'permanent is incompatible with validAt.' })
          }
          const validAt = getValidDate(options.validAt)
          if (!isValidDate(validAt)) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'validAt must be a valid date value.' })
          }
          notBefore = Math.floor(validAt.getTime() / 1000)
          if (notBefore < unixTimestamp) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'validAt must be greater that or equal to the current time.' })
          }

        }
        if (options.activatesIn !== Undefined && options.activatesIn !== null) {
          if (notBefore !== null) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'validAt is incompatible with activatesIn.' })
          }
          if (isPermanent) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'permanent is incompatible with activatesIn.' })
          }
          const activatesIn = rInt(options.activatesIn, null)
          if (activatesIn === null || activatesIn <= 0) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'activatesIn must be a positive integer.' })
          }
          notBefore = unixTimestamp + activatesIn
        }
        if (notBefore) {
          payload.nbf = notBefore
        }

        tokenZeroStart = notBefore || unixTimestamp

        if ((options.expiresIn !== Undefined && options.expiresIn !== null)) {
          if (isPermanent) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'permanent is incompatible with expiresIn.' })
          }
          const expiresIn = rInt(options.expiresIn, client.authDuration)
          if (expiresIn <= 0) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'expiresIn must be a positive integer.' })
          }
          expiresAt = tokenZeroStart + expiresIn
        } else if (!isPermanent) {
          expiresAt = tokenZeroStart + client.authDuration
        }
        if (expiresAt) {
          payload.exp = expiresAt
        }

        if (isLimited) {
          const maxUses = rInt(options.maxUses, 0)
          if (maxUses <= 0) {
            throw Fault.create('cortex.invalidArgument.jwt', { reason: 'maxUses must be a positive integer.' })
          }
          payload['cortex/cnt'] = maxUses
        }

        if (isPermanent || isLimited) {
          payload.jti = createId()
        }

        // subject ----------------

        principal = await ap.create(ac.org, principalDoc)

        if (!principal.isAuthenticated()) {
          throw Fault.create('cortex.invalidArgument.jwt', { reason: 'token subject must be an authenticated principal.' })
        }

        payload.sub = principal._id

        if (options.includeEmail) {
          payload['cortex/eml'] = principal.email
        }

        // signing ----------------

        try {

          token = await promised(jwt, 'sign', payload, privateKey, { header })

          // store jti in db ----------------

          if (payload.jti) {

            const dbToken = new modules.db.models.token({
              _id: payload.jti,
              iss: client._id,
              sub: payload.sub
            })
            if (payload.exp) {
              dbToken.expires = new Date(payload.exp * 1000)
            }
            if (payload['cortex/cnt']) {
              dbToken.uses = payload['cortex/cnt']
            }
            dbToken.accessed = new Date()

            let count = await promised(modules.db.models.token.collection, 'countDocuments', { iss: client._id, sub: payload.sub, expires: { $exists: false } })
            if (count >= client.maxTokensPerPrincipal) {
              signingErr = Fault.create('cortex.accessDenied.maxJwtPerSubject', { message: 'No more access tokens can be issued at this time.', reason: `maximum number of tokens reached for this subject (${client.maxTokensPerPrincipal})` })
            } else {
              await dbToken.save()
            }

          }

        } catch (err) {
          signingErr = err
        }

        // record success/failure but only if we got to the signing stage (ignore audit recording error)
        try {
          await promised(modules.audit, 'recordEvent', ac, 'authentication', 'token', { err: signingErr, context: { object: 'account', _id: principal._id }, metadata: payload })
        } catch (err) {
          void err
        }

        if (signingErr) {
          throw signingErr
        }

        return { token, principal }

      })
      .then(result => callback(null, result))
      .catch(err => callback(err, {}))

  }

  /**
   *
   * @param ac
   * @param ipv4 []  restricts use to a list of ip addresses or CIDR ranges
   * @param method [] restricts use to a set of http methods (get, patch, post, put, delete)
   * @param route [] restricts use to a set of matching route patterns
   * @param path [] restricts access to a set of explicit paths (including query arguments)
   * @param tag [] user-defined tags that can be checked against. these must follow the custom name convention (c_ or env__)
   *
   * @returns {*} null if nothing was set. throws on invalid input
   */
  createPolicy(ac, { ipv4, method, route, path, tag } = {}) {

    function assignIf(receiver, object, resolver) {
      const field = Object.keys(object)[0],
            input = object[field],
            output = toArray(input, isSet(input)).map(resolver)
      if (output.length) {
        if (!receiver) {
          receiver = {}
        }
        receiver[field] = output.length === 1 ? output[0] : output
      }
      return receiver
    }

    let policy = null

    policy = assignIf(policy, { ipv4 }, ipv4 => {
      if (isIPV4(ipv4) || isCIDR(ipv4)) {
        return ipv4
      }
      throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Invalid IPv4 or CIDR range.' })
    })

    policy = assignIf(policy, { method }, method => {
      method = String(method).toUpperCase()
      if (isSet(consts.http.methods[method])) {
        return method
      }
      throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Invalid HTTP method.' })
    })

    policy = assignIf(policy, { route }, route => {
      try {
        pathToRegExp(route)
        return route
      } catch (err) {
        throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Invalid route.' })
      }
    })

    policy = assignIf(policy, { path }, path => {
      if (_.isString(path) && path) {
        return path
      }
      throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Invalid path.' })
    })

    policy = assignIf(policy, { tag }, tag => {
      if (isCustomName(tag)) {
        return tag
      }
      throw Fault.create('cortex.invalidArgument.jwt', { reason: 'Invalid tag.' })
    })

    return policy

  }

  /**
   * match any policy. match all items in each policy.
   *
   * @param ac
   * @param decoded
   * @param options
   *  tags - String[]
   */
  checkPolicy(ac, decoded, options) {

    function check(object, resolver) {
      const field = Object.keys(object)[0],
            input = object[field],
            output = toArray(input, isSet(input))
      if (output.length) {
        return _.some(output, resolver)
      }
      return true
    }

    options = options || {}

    const { req } = ac || {},
          { 'cortex/pol': pols } = decoded || {},
          policies = toArray(pols, isSet(pols)),
          isRequest = (req instanceof IncomingMessage),
          tags = toArray(options.tags, options.tags)

    if (isRequest && policies.length) {

      for (const policy of policies) {

        const { ipv4, method, route, path, tag } = policy || {}

        if (check({ ipv4 }, ipv4 => containsIp(ipv4, getClientIp(req))) &&
            check({ method }, method => req.method === method) &&
            check({ path }, path => req.path === path) &&
            check({ route }, route => pathToRegExp(route).test(req.path)) &&
            check({ tag }, tag => tags.length && tags.includes(tag))
        ) {
          return true
        }

      }

      throw Fault.create('cortex.accessDenied.invalidJwt', { reason: 'Invalid policy' })

    }

  }

  /**
   *
   * @param token
   * @param options
   * @param callback (optional) -> err, decoded. if not present returns result/throws
   * @returns {*}
   */
  decodeToken(token, options = null, callback = null) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }

    let err = null, decoded = null

    try {
      if (!(decoded = jwt.decode(token, options))) {
        err = Fault.create('cortex.accessDenied.invalidJwt')
      }
    } catch (e) {
      err = Fault.create('cortex.accessDenied.invalidJwt', { faults: [e] })
    }
    if (_.isFunction(callback)) {
      return setImmediate(callback, err, decoded)
    } else if (err) {
      throw err
    }
    return decoded
  }

  /**
     * @param ac
     * @param token
     * @param options
     *  include - additional account paths to load.
     *  checkPolicy - boolean (false). if true,  verify policy against ac.req
     *  tags - string[] works with policy tags. if true, also checks policies against these tags.
     *  clockTolerance
     * @param callback -> err, { principal, account, client }
     */
  authenticateToken(ac, token, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback)

    Promise.resolve(null)
      .then(async() => {

        const { header, payload } = this.decodeToken(token, { complete: true })

        let client = issuerToClient(ac, payload.iss),
            rsa = null,
            principal,
            decoded

        if (!client) {
          client = modules.hub.findTokenAuthenticationClient(ac.org, payload.iss)
        }
        if (!client) {
          throw Fault.create('cortex.accessDenied.invalidJwtApp')
        }

        if (!client.rsa || !client.rsa.public) {
          throw Fault.create('cortex.accessDenied.invalidJwtApp')
        }
        if (!header.kid || client.rsa.timestamp.getTime() === header.kid) {
          rsa = client.rsa
        } else {
          rsa = toArray(client.rsa.rotated).find(v => v.timestamp.getTime() === header.kid)
        }
        if (!rsa) {
          throw Fault.create('cortex.accessDenied.invalidJwtApp')
        }

        decoded = await new Promise((resolve, reject) => {
          jwt.verify(
            token,
            rsa.public,
            {
              algorithms: ['RS512'],
              audience: `https://${config('server.apiHost')}/${ac.org.code}/v2`,
              clockTolerance: rInt(options.clockTolerance, 0),
              clockTimestamp: Math.floor(Date.now() / 1000)
            },
            (err, decoded) => {
              if (err) {
                try {
                  modules.db.models.Log.logApiErr('api', Fault.from(err), ac)
                } catch (err) {
                  void err
                }
                if (err.name === 'TokenExpiredError') {
                  return reject(Fault.create('cortex.expired.jwt'))
                }
                return reject(Fault.create('cortex.accessDenied.invalidJwtApp'))
              }
              resolve(decoded)
            }
          )
        })

        if (options.checkPolicy) {
          this.checkPolicy(ac, decoded, { tags: options.tags })
        }

        if (decoded.jti) {
          await accessToken(decoded)
        }

        principal = await ap.create(ac.org, decoded.sub, { include: options.include })

        if (decoded['cortex/spt'] !== Undefined) {
          principal.isSupportLogin = decoded['cortex/spt']
        }
        if (decoded['cortex/rls'] !== Undefined) {
          principal.roles = [...principal.roles, ...getIdArray(decoded['cortex/rls'])]
        }
        if (decoded['cortex/prv'] !== Undefined) {
          principal.isPrivileged = decoded['cortex/prv']
        }

        principal.scope = decoded['cortex/scp'] || [] // ensure things are always scoped (roles may augment)

        if (decoded['cortex/gnt'] !== Undefined) {
          principal.grant = decoded['cortex/gnt']
        }
        if (decoded['cortex/skp'] !== Undefined) {
          principal.skipAcl = decoded['cortex/skp']
        }
        if (decoded['cortex/skc'] !== Undefined) {
          principal.bypassCreateAcl = decoded['cortex/skc']
        }
        if (principal.locked) {
          throw Fault.create('cortex.accessDenied.accountLocked')
        } else if (ac.org.maintenance && !principal.isDeveloper() && !principal.isSupportLogin) {
          throw Fault.create('cortex.accessDenied.maintenance', { reason: ac.org.maintenanceMessage })
        }

        return { principal, account: principal.account, client }

      })
      .then(result => callback(null, result))
      .catch(err => callback(err, {}))

  }

  /**
   *
   * @param ac
   * @param issuer
   * @param subject
   * @param callback -> err, array
   * @returns {*}
   */
  getSubjectTokens(ac, issuer, subject, callback) {

    let client = issuerToClient(ac, issuer)

    if (!client) {
      return callback(Fault.create('cortex.notFound.app'))
    }

    ap.create(ac.org, subject, (err, principal) => {
      if (err) {
        return callback(err)
      }
      modules.db.models.token.collection.find({ iss: client._id, sub: principal._id }).toArray((err, docs) => {
        callback(err, toArray(docs).map(v => ({
          jti: v._id,
          times_authorized: v.uses === Undefined ? v.sequence : Undefined,
          last_authorized: v.sequence ? v.accessed : Undefined,
          uses_remaining: v.uses,
          expires_at: v.expires
        })))
      })
    })

  }

  /**
     * @param ac
     * @param issuer
     * @param subject
     * @param callback -> err, count
     */
  revokeSubjectTokens(ac, issuer, subject, callback) {

    let client = issuerToClient(ac, issuer)

    if (!client) {
      return callback(Fault.create('cortex.notFound.app'))
    }

    ap.create(ac.org, subject, (err, principal) => {
      if (err || !principal.isAuthenticated()) {
        return callback(err, 0)
      }
      modules.db.models.token.collection.deleteMany({ iss: client._id, sub: principal._id }, (err, result) => {
        callback(err, pathTo(result, 'deletedCount'))
      })
    })

  }

  /**
     *
     * @param ac
     * @param token
     * @param callback -> err, boolean
     */
  revokeToken(ac, token, callback) {

    const tokenId = getIdOrNull(token)
    if (tokenId) {
      modules.db.models.token.findOne({ _id: tokenId }).lean().exec((err, doc) => {
        if (err) {
          return callback(err)
        } else if (!doc) {
          return callback(null, false)
        }
        let client = issuerToClient(ac, doc.iss)
        if (!client) {
          return callback(Fault.create('cortex.accessDenied.invalidJwt'))
        }
        modules.db.models.token.collection.deleteOne(
          { _id: tokenId },
          (err, result) => {
            callback(err, !err && result.deletedCount === 1)
          }
        )
      })
      return
    }

    this.decodeToken(token, { complete: true }, (err, decoded) => {

      if (err) {
        return callback(err)
      }

      const { header, payload } = decoded,
            client = issuerToClient(ac, payload.iss)

      let rsa = null

      if (!client) {
        return callback(Fault.create('cortex.accessDenied.invalidJwt'))
      }
      if (!client.rsa || !client.rsa.public) {
        return callback(Fault.create('cortex.accessDenied.invalidJwt'))
      }

      if (!header.kid || client.rsa.timestamp.getTime() === header.kid) {
        rsa = client.rsa
      } else {
        rsa = toArray(client.rsa.rotated).find(v => v.timestamp.getTime() === header.kid)
      }
      if (!rsa) {
        return callback(Fault.create('cortex.accessDenied.invalidJwt'))
      }

      jwt.verify(
        token,
        rsa.public,
        {
          algorithms: ['RS512'],
          audience: `https://${config('server.apiHost')}/${ac.org.code}/v2`,
          clockTolerance: 0,
          clockTimestamp: Math.floor(Date.now() / 1000)
        },
        (err, decoded) => {
          if (err) {
            return callback(Fault.create('cortex.accessDenied.invalidJwt', { faults: [err] }))
          }
          if (!decoded.jti) {
            return callback(Fault.create('cortex.accessDenied.invalidJwt', { faults: [err] }))
          }
          modules.db.models.token.collection.deleteOne(
            { _id: getIdOrNull(decoded.jti) },
            (err, result) => {
              callback(err, !err && result.deletedCount === 1)
            }
          )
        }
      )

    })

  }

}

module.exports = new AuthenticationModule()

// ------------------------------------------------------------------

async function accessToken(decoded) {

  return promised(
    modules.db,
    'sequencedFunction',
    callback => {

      const tokenId = getIdOrNull(decoded.jti),
            filter = { _id: tokenId }

      if (decoded['cortex/cnt']) {
        filter.uses = { $gt: 0 }
      }
      if (decoded['cortex/exp']) {
        filter.expires = { $gte: new Date(decoded['cortex/exp'] * 1000) }
      }

      modules.db.models.token.findOne(filter).select('sequence uses').lean().exec((err, dbToken) => {

        if (err || !dbToken) {
          return callback(Fault.create('cortex.accessDenied.invalidJwt', { faults: err && [err] }))
        }
        const update = {
          $inc: {
            sequence: 1
          },
          $set: {
            accessed: new Date()
          }
        }
        if (decoded['cortex/cnt']) {
          update.$inc = { uses: -1 }
          if (dbToken.uses === 1) {
            update.$set.expires = new Date() // expire it now to ttl out of db.
          }
        }
        modules.db.models.token.collection.updateOne(
          { _id: tokenId, sequence: dbToken.sequence },
          update,
          (err, result) => {
            if (!err && result.matchedCount === 0) {
              err = Fault.create('cortex.conflict.sequencing', { path: 'jwt' })
            }
            callback(err)
          }
        )
      })
    },
    Number.MAX_SAFE_INTEGER,
    {
      delayScalar: 1,
      delayMultiplies: false,
      delayAdds: false
    }
  )

}

function compiledScopeToArray(scope, chain = [], top = []) {

  Object.keys(scope || {}).forEach(key => {
    chain.push(key)
    if (_.isObject(scope[key])) {
      compiledScopeToArray(scope[key], chain, top)
    } else {
      top.push(chain.slice())
    }
    chain.pop(key)
  })

  return top
}

function scopeSort(a, b) {
  for (let idx = 0, maxLen = Math.max(a.length, b.length); idx < maxLen; idx++) {
    const va = a[idx], vb = b[idx]
    if (va && !vb) {
      return 1
    } else if (vb && !va) {
      return -1
    } else if (va === '*' && vb !== '*') {
      return -1
    } else if (vb === '*' && va !== '*') {
      return 1
    } else if (va === vb) {
      continue
    }
    return va.localeCompare(vb)
  }
  return 0
}

// looks in sub branches for matches bases on value matching and wildcards.
function anyBranchesMatch(object, parts, idx) {
  if (object === true) {
    return true
  } else if (!object) {
    return false
  }
  const part = parts[idx], keys = Object.keys(object)
  return keys.some(key => {

    if (part === key || key === '*') {
      return anyBranchesMatch(object[key], parts, idx + 1)
    }
    return false
  })
}

/**
 * @param outer
 * @param scopeString
 * @param acceptPrefixMatch returns true on prefix matches (e.g. ['object', 'read', 'account', '590a328a3bde982681988272', 'name']
 *        where compiled scope contains 'object.read.*.*.name.first). useful for checking mid-scope chain
 * @param exactMatch false. if true, # are not split and matches must be exact.
 * @param idx default 0. where to start in the criteria string
 * @returns {boolean}
 */
function isInScope(outer, scopeString, acceptPrefixMatch, exactMatch, idx) {

  if (outer === true) {
    return true
  } else if (idx >= scopeString.length) {
    return acceptPrefixMatch
  }
  for (let supplied in outer) {
    if (outer.hasOwnProperty(supplied)) {

      let nextStop = scopeString.indexOf('.', idx)
      if (!~nextStop) nextStop = scopeString.length
      const requiredChunk = rString(scopeString.substring(idx, nextStop), ''),
            sPos = exactMatch ? -1 : supplied.indexOf('#'),
            rPos = exactMatch ? -1 : requiredChunk.indexOf('#')

      if ((supplied === '*') ||
                (supplied === requiredChunk) ||
                (~sPos && !~rPos && supplied.substr(0, sPos) === requiredChunk) || // c_obj#foo allowed, requires c_obj
                (!~sPos && ~rPos && requiredChunk.substr(0, rPos) === supplied) // c_obj allowed, requires c_obj#c_type
      ) {

        if (isInScope(outer[supplied], scopeString, acceptPrefixMatch, exactMatch, nextStop + 1)) {
          return true
        }
      }
    }
  }
  return false
}

function issuerToClient(ac, issuer) {

  let client = null
  for (let a of toArray(ac.org.apps)) {
    for (let c of toArray(a.clients)) {
      if (c.key === issuer || equalIds(c._id, issuer) || (issuer && a.name === issuer)) {
        client = c
        break
      }
    }
    if (client) {
      break
    }
  }
  return client

}
