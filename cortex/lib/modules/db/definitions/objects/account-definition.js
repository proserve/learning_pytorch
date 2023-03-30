'use strict'

const Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      AccessPrincipal = require('../../../../access-principal'),
      consts = require('../../../../consts'),
      util = require('util'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      { isSet } = utils,
      BuiltinContextModelDefinition = require('../builtin-context-model-definition'),
      AccountNotificationPreferencesDefinition = require('../account-notification-preferences-definition.js'),
      modules = require('../../../../modules'),
      uuid = require('uuid'),
      crypto = require('crypto'),
      UnhandledResult = require('../classes/unhandled-result'),
      clientKeyRounds = 10000, // if this changes all client keys will be no good!
      clientKeyLength = 32

let Undefined

function writeProviderValueWithVerificationUpdate(ac, node, value) {
  // update it before in order to see it it's changed ad so we don't have to cast and compare.
  utils.path(this, node.docpath, value)
  if (utils.path(ac, 'org.registration.manualProviderVerification')) {
    if (this.isModified(node.docpath)) {
      utils.path(this, 'profile.provider.state', 'processing')
    }
  }
  return Undefined // already done!
}

function usernameRequired(ac) {
  const {
    subject: { email, username },
    org: { configuration: { accounts: { requireEmail, requireUsername } } }
  } = ac

  return requireUsername ||
      (!requireEmail && !isSet(email) && !isSet(username)) // force one or the other to exist.
}

function emailRequired(ac) {
  const {
    subject: { email, username },
    org: { configuration: { accounts: { requireEmail, requireUsername } } }
  } = ac

  return requireEmail ||
    (!requireUsername && !isSet(email) && !isSet(username)) // force one or the other to exist.
}

function AccountDefinition(options) {
  BuiltinContextModelDefinition.call(this, options)

}
util.inherits(AccountDefinition, BuiltinContextModelDefinition)

AccountDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.statics = AccountDefinition.statics
  options.methods = AccountDefinition.methods
  options.indexes = AccountDefinition.indexes
  options.options = { collection: AccountDefinition.collection }
  options.apiHooks = AccountDefinition.apiHooks
  return BuiltinContextModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

AccountDefinition.collection = 'contexts'

AccountDefinition.prototype.getNativeOptions = function() {

  return {
    hasCreator: false,
    hasOwner: false,
    _id: consts.NativeIds.account,
    objectLabel: 'Account',
    objectName: 'account',
    pluralName: 'accounts',
    collection: 'contexts',
    isExtensible: true,
    auditing: {
      enabled: true,
      all: true,
      category: 'account'
    },
    obeyObjectMode: false,
    defaultAclOverride: false,
    defaultAclExtend: true,
    shareChainOverride: false,
    shareAclOverride: false,
    allowConnections: true,
    allowConnectionsOverride: true,
    defaultAcl: [{ type: acl.AccessPrincipals.Self, allow: acl.AccessLevels.Update }], // accounts can update themselves
    createAclOverwrite: false,
    createAclExtend: false,
    createAcl: [], // only the system can create accounts
    shareChain: [acl.AccessLevels.Connected],
    requiredAclPaths: ['email', 'username', 'roles', 'state', 'locked', 'name', 'tz'],
    sequence: 1,
    nativeSchemaVersion: 1, // update this whenever we add new properties to the definition
    properties: [
      {
        label: 'Email',
        name: 'email',
        type: 'String',
        // description: 'The email address for the account and must be unique within the Org.',
        dependencies: ['org', 'roles'],
        readable: true,
        writable: true,
        nativeIndex: true,
        lowercase: true,
        removable: true,
        trim: true,
        alwaysValidate: true,
        onRemovingValue: function() {
          this.markModified('username')
        },
        validators: [{
          name: 'required',
          definition: {
            when: emailRequired
          }
        }, {
          // require script access when allowEmailUpdate is false
          name: 'adhoc',
          definition: {
            errCode: 'cortex.accessDenied.propertyUpdate',
            validator: function(ac, node, v) {
              return node.hasWriteAccess(ac, acl.AccessLevels.Script)
            },
            skip: function(ac) {
              return this.isNew || ac.org.configuration.accounts.allowEmailUpdate // skip for new accounts
            }
          }
        }, {
          // do not allow base admin and developer roles to have their email addresses changed by others, which
          // could lead to privilege escalation by a support role account in production.
          name: 'adhoc',
          definition: {
            errCode: 'cortex.accessDenied.propertyUpdate',
            validator: function(ac) {
              const isSelf = utils.equalIds(ac.principalId, ac.subjectId),
                    isProduction = config('app.env') === 'production',
                    isDevDev = !isProduction && ac.principal.isDeveloper(),
                    isOrgAdmin = ac.principal.isOrgAdmin(),
                    isSupportLogin = ac.principal.isSupportLogin

              if (isSelf || isDevDev || isOrgAdmin || isSupportLogin) {
                return true
              }
              return !(utils.inIdArray(this.roles, consts.roles.admin) || utils.inIdArray(this.roles, consts.roles.developer))
            },
            skip: function() {
              return this.isNew
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            errCode: 'cortex.invalidArgument.emailAddress',
            validator: function(ac, node, v) {
              return _.isString(v) && v.length >= 3 && !!v.match(modules.validation.Matchers.email) // a@a is minimum length
            },
            when: (ac, node, value) => emailRequired(ac) || isSet(value)
          }
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.duplicateEmail',
            message: 'Email address taken',
            validator: function(ac, node, v, callback) {
              function endsWith(str, suffix) {
                return _.isString(str) && str.indexOf(suffix, str.length - suffix.length) !== -1
              }
              if (!this.isSelected('org')) {
                // we can't validate uniqueness because we need the org. we'll have to catch it later.
                callback(null, false)
              } else if (!this.isModified(node.path)) {
                callback(null, false)
              } else if (endsWith(v, '-iam.serviceaccount.medable.com')) {
                callback(null, false)
              } else {
                this.constructor.findOne({ org: ac.orgId, object: 'account', email: v, _id: { $ne: this._id } }).lean().select('_id').exec(function(err, doc) {
                  callback(null, !(err || doc))
                })
              }
            },
            when: (ac, node, value) => !ac.option('provisioningOrg') && (emailRequired(ac) || isSet(value))
          }
        }]
      },
      {
        label: 'Username',
        name: 'username',
        type: 'String',
        // description: 'The username for the account and must be unique within the Org.',
        dependencies: ['org', 'roles'],
        readable: true,
        writable: true,
        removable: true,
        nativeIndex: true,
        trim: true,
        alwaysValidate: true,
        onRemovingValue: function() {
          this.markModified('email')
        },
        validators: [{
          name: 'required',
          definition: {
            when: usernameRequired
          }
        }, {
          name: 'adhoc',
          definition: {
            errCode: 'cortex.invalidArgument.username',
            message: 'A username cannot be an email',
            validator: function(ac, node, v) {
              return _.isString(v) && !(v.match(modules.validation.Matchers.email))
            },
            when: (ac, node, value) => usernameRequired(ac) || isSet(value)
          }
        }, {
          name: 'adhoc',
          definition: {
            errCode: 'cortex.invalidArgument.username',
            validator: function(ac, node, v) {
              const regParts = ac.org.configuration.accounts.usernamePattern.match(/^\/(.*?)\/([gim]*)$/)
              let regex, match
              if (regParts) {
                // the parsed pattern had delimiters and modifiers. handle them.
                regex = new RegExp(regParts[1], regParts[2])
              } else {
                // we got pattern string without delimiters
                regex = new RegExp(ac.org.configuration.accounts.usernamePattern)
              }

              return (_.isString(v) && v.length > 0 && (match = regex.exec(v)) && match[0].length > 0)
            },
            when: (ac, node, value) => usernameRequired(ac) || isSet(value)
          }
        }, {
          name: 'adhoc',
          definition: {
            code: 'cortex.conflict.duplicateUsername',
            validator: function(ac, node, v, callback) {
              if (!this.isSelected('org')) {
                // we can't validate uniqueness because we need the org. we'll have to catch it later.
                callback(null, false)
              } else if (!this.isModified(node.path)) {
                callback(null, false)
              } else {
                this.constructor.findOne({ org: ac.orgId, object: 'account', username: v, _id: { $ne: this._id } }).lean().select('_id').exec(function(err, doc) {
                  callback(null, !(err || doc))
                })
              }
            },
            when: (ac, node, value) => !ac.option('provisioningOrg') && (usernameRequired(ac) || isSet(value))
          }
        }]
      },
      {
        label: 'Name',
        name: 'name',
        type: 'Document',
        writable: true,
        readAccess: acl.AccessLevels.Connected,
        properties: [{
          label: 'Prefix',
          name: 'prefix',
          type: 'String',
          readAccess: acl.Inherit,
          readable: true,
          writable: true,
          removable: true,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: true }
          }]
        }, {
          label: 'First',
          name: 'first',
          type: 'String',
          nativeIndex: true,
          // description: 'First name',
          dependencies: ['locale'],
          readAccess: acl.Inherit,
          readable: true,
          writable: true,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: false }
          }]
        }, {
          label: 'Middle',
          name: 'middle',
          type: 'String',
          readAccess: acl.Inherit,
          readable: true,
          writable: true,
          removable: true,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: true }
          }]
        }, {
          label: 'Last',
          name: 'last',
          type: 'String',
          // description: 'Last name',
          dependencies: ['locale'],
          readAccess: acl.Inherit,
          nativeIndex: true,
          readable: true,
          writable: true,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: false }
          }]
        }, {
          label: 'Suffix',
          name: 'suffix',
          type: 'String',
          readAccess: acl.Inherit,
          readable: true,
          writable: true,
          removable: true,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: true }
          }]
        }, {
          label: 'Additional',
          name: 'additional',
          type: 'String',
          array: true,
          readAccess: acl.Inherit,
          readable: true,
          writable: true,
          canPush: true,
          canPull: true,
          removable: true,
          minItems: 0,
          maxItems: 20,
          validators: [{
            name: 'printableString',
            definition: { min: 0, max: 100, anyFirstLetter: true }
          }]
        }]
      }, {
        label: 'Dob',
        name: 'dob',
        type: 'Date',
        dateOnly: true,
        // description: 'Account holder date of birth',
        dependencies: ['locale'],
        nativeIndex: true,
        readable: true,
        writable: true,
        validators: [{
          name: 'dateOfBirth'
        }]
      }, {
        // if the model source is a service account, this property will exist.
        label: 'Service Account',
        name: 'service',
        type: 'Boolean',
        readable: true,
        reader: function(ac, node) {
          return this.service === true || Undefined
        }
      }, {
        // if the model source is a role, this property will exist.
        label: 'Role',
        name: 'role',
        type: 'Boolean',
        readable: true,
        reader: function(ac, node) {
          return this.role === true || Undefined
        }
      }, {
        label: 'Gender',
        name: 'gender',
        type: 'String',
        // description: 'Account holder gender.',
        dependencies: ['locale'],
        readable: true,
        writable: true,
        validators: [{
          name: 'stringEnum',
          definition: { values: _.values(consts.Genders) }
        }]
      }, {
        label: 'Age',
        name: 'age',
        type: 'Number',
        // description: 'Patient age.',
        dependencies: ['dob'],
        readable: true,
        writable: false,
        reader: function() {

          const v = (this.getValue && this.getValue('dob')) || this.dob // <-- get raw ralue.
          if (_.isDate(v)) {
            return utils.dateToAge(v)
          }
        },
        virtual: true
      }, {
        _id: consts.Properties.Files.Ids.Account.Image,
        label: 'Image',
        name: 'image',
        type: 'File',
        // description: 'The account profile image.',
        readAccess: acl.AccessLevels.Connected,
        readable: true,
        writable: true,
        urlExpirySeconds: config('uploads.s3.readUrlExpiry'),
        processors: [{
          type: 'image',
          name: 'content',
          source: 'content',
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          cropImage: false,
          allowUpload: true,
          maxFileSize: 1024 * 1000 * 5,
          maxWidth: 640,
          maxHeight: 640,
          passMimes: false,
          required: true
        }, {
          type: 'image',
          name: 'thumbnail',
          source: 'content',
          cropImage: true,
          imageWidth: 160,
          imageHeight: 160,
          maxFileSize: 1024 * 1000 * 5,
          mimes: ['image/jpeg', 'image/png', 'image/gif'],
          allowUpload: false
        }]
      }, {
        label: 'Mobile',
        name: 'mobile',
        type: 'String',
        // description: 'Mobile phone number in E.164 format. Required for 2-factor authentication',
        dependencies: ['locale'],
        readable: true,
        writable: true,
        nativeIndex: true,
        validators: [{
          name: 'phoneNumber',
          definition: {
            requireMobile: true
          }
        }]
      }, {
        label: 'Locale',
        name: 'locale',
        type: 'String',
        // description: 'Current locale of the Account for localization.',
        readable: true,
        writable: true,
        default: 'en_US',
        dependencies: ['mobile', 'name.first'],
        validators: [{
          name: 'locale'
        }]
      }, {
        label: 'State',
        name: 'state',
        type: 'String',
        // description: 'Current state for the account. (e.g. unverified, verified)',
        writeAccess: acl.AccessLevels.System,
        readable: true,
        writable: true,
        validators: [{
          name: 'stringEnum',
          definition: {
            values: _.values(consts.accountStates)
          }
        }],
        default: 'unverified'
      }, {
        label: 'Security',
        name: 'security',
        type: 'Document',
        public: false,
        readable: true,
        readAccess: acl.AccessLevels.System,
        writable: true,
        writeAccess: acl.AccessLevels.System,
        dependencies: ['locked'],
        properties: [{
          label: 'Locked At',
          name: 'lockedAt',
          type: 'Date',
          // description: 'The time the account was locked.',
          dependencies: ['security', 'locked']
        }, {
          label: 'Failed Attempts',
          name: 'attempts',
          type: 'Number',
          // description: 'The number of current failed sign-in attempts.',
          dependencies: ['security', 'locked']
        }, {
          label: 'Lock Expires',
          name: 'lockExpires',
          type: 'Boolean',
          // description: 'True if the lock will expire.',
          dependencies: ['security', 'locked']
        }]
      }, {
        label: 'Locked',
        name: 'locked',
        type: 'Boolean',
        // description: 'The account holder of a locked account cannot sign-in or otherwise use the api.',
        writeAccess: acl.AccessLevels.Script,
        readable: true,
        writable: true,
        default: false,
        dependencies: ['security'],
        writer: function(ac, node, value) {
          const locked = !!value
          this.security.lockedAt = locked ? new Date() : null
          this.security.lockExpires = false
          this.security.attempts = 0
          return value
        },
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'The organization root account cannot be locked.',
            validator: function(ac, node, value) {
              return !(value === true && utils.equalIds(ac.org.creator._id, ac.subjectId))
            }
          }
        }]
      }, {
        label: 'Password',
        name: 'password',
        type: 'String',
        // description: 'The account password.',
        dependencies: [
          'locale',
          'key.fingerprint',
          'key.secret',
          'key.hf',
          'stats'
        ],
        readable: true,
        writable: true,
        readAccess: acl.AccessLevels.System,
        writeAccess: acl.AccessLevels.System,
        auditing: {
          category: 'authentication',
          updateSubcategory: 'reset'
        },
        validators: [{
          name: 'required'
        }, {
          name: 'string',
          definition: {
            min: 1,
            max: 50
          }
        }, {
          // password strength validator
          name: 'adhoc',
          definition: {
            message: 'The chosen password does not meet the minimum Org password strength requirement.',
            code: 'cortex.invalidArgument.passwordStrength',
            validator: function(ac, node, value) {

              const result = utils.testPasswordStrength(value)
              return result.score >= utils.rInt(ac.org.configuration.minPasswordScore, 0)

            },
            skip: function(ac) {
              return ac.org.configuration.scriptablePasswordValidation && ac.org.configuration.compiledPasswordValidator
            }
          }
        }, {
          // scriptable validator
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              // call the script.
              const sandboxed = modules.sandbox.sandboxed(ac,
                ac.org.configuration.compiledPasswordValidator.compiled,
                {
                  skipTranspile: true,
                  requires: ac.org.configuration.compiledPasswordValidator.requires,
                  compilerOptions: {
                    label: `Validate ${node.fqpp}`,
                    type: 'validator',
                    language: 'javascript',
                    specification: 'es6'
                  },
                  scriptOptions: {
                    context: {
                      _id: ac.subjectId,
                      object: 'account',
                      password: value,
                      minScore: ac.org.configuration.minPasswordScore
                    },
                    api: {
                      context: {
                        zxcvbn: function(script, message, value, callback) {
                          callback(null, utils.testPasswordStrength(value))
                        }
                      }
                    }
                  }
                })

              sandboxed(err => {
                callback(err, !err)
              })

            },
            skip: function(ac) {
              return !(ac.org.configuration.scriptablePasswordValidation && ac.org.configuration.compiledPasswordValidator)
            }
          }
        }, {
          // modifier (this will "late-write" the password value as a hash and update the client key)
          // modifier will also late-write to password stats.
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              this.stats.lastPasswordReset = new Date()
              if (!this.isModified('stats.mustResetPassword')) {
                this.stats.mustResetPassword = Undefined
              }
              if (!this.isModified('stats.passwordExpires')) {
                this.stats.passwordExpires = Undefined
              }

              const fingerprint = uuid.v1(), secret = modules.authentication.genAlphaNumString(32)
              let success = true

              crypto.pbkdf2(value, fingerprint, clientKeyRounds, clientKeyLength, 'sha256', (err, derivedKey) => {

                if (err) {
                  logger.error('could not create client key', { error: (err.stack || err) })
                  success = false
                } else {
                  try {
                    const cipher = crypto.createCipher('aes256', derivedKey)
                    let encrypted = cipher.update(secret, 'utf8', 'base64')
                    encrypted += cipher.final('base64')
                    this.key.fingerprint = fingerprint
                    this.key.secret = encrypted
                    this.key.hf = 'sha256'
                  } catch (err) {
                    logger.error('could not encrypt client key', { error: (err.stack || err) })
                    success = false
                  }
                }

                modules.authentication.hashPassword(value, (err, hash) => {

                  if (!err) {
                    this.password = hash
                    if (success && utils.equalIds(this._id, utils.path(ac, 'req.principal._id'), utils.path(ac.req, 'session.passport.user.accountId'))) {
                      const session = ac.req.session
                      ac.hook('save').after(function(vars, callback) {
                        if (~vars.modified.indexOf('password')) {
                          session.clientKey = {
                            fingerprint: fingerprint,
                            secret: secret
                          }
                        }
                        callback()
                      })
                    }
                  }

                  callback(err, !err)
                })

              })
            }
          }
        }]
      }, {
        label: 'Login Methods',
        name: 'loginMethods',
        type: 'String',
        // description: 'Login methods available to account',
        array: true,
        uniqueValues: true,
        maxShift: false,
        canPush: true,
        canPull: true,
        readable: true,
        writable: true,
        default: [],
        validators: [{
          name: 'stringEnum',
          definition: {
            values: ['sso', 'credentials']
          }
        },
        {
          name: 'adhoc',
          definition: {
            errCode: 'cortex.accessDenied.propertyUpdate',
            message: 'Account loginMethods must first be enabled on the org.',
            validator: function(ac, node, value) {
              return ac.org.configuration.loginMethods.includes(value)
            }
          }
        }]
      },
      {
        label: 'Client Key',
        name: 'key',
        type: 'Document',
        // description: 'A fingerprint and secret, re-generated on password change. Useful for client-side PHI encryption/caching scenarios, it is available to the account holder for the life of an authenticated session.',
        readable: true,
        properties: [{
          label: 'Fingerprint',
          name: 'fingerprint',
          // description: 'The key fingerprint.',
          readable: true,
          type: 'String'
        }, {
          label: 'Secret',
          name: 'secret',
          // description: 'The key encryption secret.',
          type: 'String',
          readable: true
        }, {
          label: 'Hash Function',
          name: 'hf',
          type: 'String',
          readable: true,
          default: 'sha1'
        }],
        reader: function(ac) {
          if (utils.equalIds(ac.principalId, this._id, utils.path(ac, 'req.principalId')) && utils.path(ac, 'req.session')) {
            return ac.req.session.clientKey
          }
        }

      }, {
        label: 'Preferences',
        name: 'preferences',
        type: 'Document',
        optional: true,
        writable: true,
        properties: [
          new AccountNotificationPreferencesDefinition()
        ]
      }, {
        label: 'Profile',
        name: 'profile',
        type: 'Document',
        writable: true,
        properties: [{
          label: 'Provider',
          name: 'provider',
          type: 'Document',
          writable: true,
          dependencies: ['roles'],
          reader: function() {
            if (utils.inIdArray(this.roles, consts.roles.provider)) {
              return new UnhandledResult(utils.path(this, 'profile.provider'))
            }
            return undefined
          },
          writer: function(ac, node, value) {
            if (utils.inIdArray(this.roles, consts.roles.provider)) {
              return value
            }
            return undefined
          },
          properties: [{
            label: 'Visibility',
            name: 'visibility',
            type: 'Document',
            writable: true,
            properties: [
              {
                label: 'Public',
                name: 'public',
                type: 'Boolean',
                // description: 'Setting to allow provider profiles to be publicly visible to org members.',
                readable: true,
                writable: true,
                stub: false,
                reader: function() {
                  return !!_.find(utils.array(this.acl), function(entry) {
                    return entry &&
                      entry.allow === acl.AccessLevels.Public &&
                      entry.type === acl.AccessTargets.Account &&
                      utils.equalIds(entry.target, acl.PublicIdentifier)
                  })
                },
                writer: function(ac, node, value) {

                  // @todo this should be able to be written in a single step without the hook
                  const visible = !!value

                  if (this.isNew && visible) {
                    if (!_.isArray(this.acl)) this.acl = []
                    this.acl.push({ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Public })
                  } else if (!this.isNew && (visible !== node.reader.call(this, ac, node, null))) {
                    this.markModified(node.path)
                    ac.hook('save').after(function(vars) {
                      acl.AclOperation[visible ? 'increaseAccessLevel' : 'decreaseAccessLevel'](
                        AccessPrincipal.synthesizeAccount({ org: vars.ac.org, accountId: acl.PublicIdentifier }),
                        vars.ac.subject,
                        visible ? acl.AccessLevels.Public : acl.AccessLevels.None,
                        function(err) {
                          if (err) logger.error('setting provider visibility', {})
                        }
                      )
                    }, 'account-set-public-visibility', true)
                  }

                },
                virtual: true
              }, {
                label: 'Provider',
                name: 'provider',
                type: 'Boolean',
                // description: 'Setting to allow provider profiles to be publicly visible to providers.',
                readable: true,
                writable: true,
                reader: function() {
                  return !!_.find(utils.array(this.acl), function(entry) {
                    return entry &&
                      entry.allow === acl.AccessLevels.Public &&
                      entry.type === acl.AccessTargets.OrgRole &&
                      utils.equalIds(entry.target, acl.OrgProviderRole)
                  })
                },
                writer: function(ac, node, value) {

                  const visible = !!value

                  if (this.isNew && visible) {
                    if (!_.isArray(this.acl)) this.acl = []
                    this.acl.push({ type: acl.AccessTargets.OrgRole, target: acl.OrgProviderRole, allow: acl.AccessLevels.Public })
                  } else if (!this.isNew && (visible !== node.reader.call(this, ac, node, null))) {
                    this.markModified(node.path)
                    ac.hook('save').after(function(vars) {

                      const principal = this.synthesizeAccount({ org: vars.ac.org, accountId: acl.AnonymousIdentifier, roles: [acl.OrgProviderRole], state: 'verified' })
                      principal.targetType = acl.AccessTargets.OrgRole

                      acl.AclOperation[visible ? 'increaseAccessLevel' : 'decreaseAccessLevel'](
                        principal,
                        vars.ac.subject,
                        visible ? acl.AccessLevels.Public : acl.AccessLevels.None,
                        function(err) {
                          if (err) logger.error('setting provider visibility', {})
                        }
                      )
                    }, 'account-set-provider-visibility', true)
                  }
                },
                virtual: true
              }]
          },
          {
            label: 'Affiliation',
            name: 'affiliation',
            type: 'String',
            trim: true,
            // description: 'Institutional affiliation of the provider.',
            dependencies: ['locale'],
            readAccess: acl.AccessLevels.Connected,
            readable: true,
            writable: true,
            validators: [{
              name: 'printableString',
              definition: { min: 1, max: 100, anyFirstLetter: false }
            }],
            stub: ''
          }, {
            label: 'Npi',
            name: 'npi',
            type: 'String',
            // description: 'National Provider Identifier number',
            dependencies: ['name', 'locale', 'profile.provider.state'],
            readAccess: acl.AccessLevels.Public,
            readable: true,
            writable: true,
            validators: [{
              name: 'printableString',
              definition: { min: 1, max: 100, anyFirstLetter: false }
            }],
            writer: writeProviderValueWithVerificationUpdate
          }, {
            label: 'State',
            name: 'state',
            type: 'String',
            // description: 'State of provider verification (e.g. unverified, processing, verified, revoked)',
            dependencies: ['profile.provider.state'],
            readAccess: acl.AccessLevels.Public,
            readable: true,
            writable: true,
            validators: [{
              name: 'stringEnum',
              definition: {
                values: _.values(consts.ProviderStates)
              }
            }],
            stub: 'unverified'
          }, {
            label: 'License',
            name: 'license',
            type: 'Document',
            readable: true,
            writable: true,
            properties: [{
              label: 'State',
              name: 'state',
              type: 'String',
              // description: 'State/province where provider is licensed to practice',
              dependencies: ['name', 'locale', 'profile.provider.state'],
              readable: true,
              writable: true,
              validators: [{
                name: 'printableString',
                definition: { min: 1, max: 100, anyFirstLetter: true }
              }],
              stub: '',
              writer: writeProviderValueWithVerificationUpdate
            }, {
              label: 'Number',
              name: 'number',
              type: 'String',
              // description: 'State/province license number',
              dependencies: ['name', 'locale', 'profile.provider.state'],
              readable: true,
              writable: true,
              validators: [{
                name: 'printableString',
                definition: { min: 1, max: 100, anyFirstLetter: true }
              }],
              stub: '',
              writer: writeProviderValueWithVerificationUpdate
            }]
          }, {
            label: 'Specialty',
            name: 'specialty',
            type: 'String',
            // description: 'Specialty of provider',
            dependencies: ['locale'],
            readAccess: acl.AccessLevels.Public,
            readable: true,
            writable: true,
            validators: [{
              name: 'printableString',
              definition: { min: 1, max: 100, anyFirstLetter: false }
            }],
            stub: ''
          }]
        }]
      }, {
        label: 'Roles',
        name: 'roles',
        type: 'ObjectId',
        // description: 'Account roles (e.g. Provider, Administrator, Developer). Accounts can have more than one role.',
        array: true,
        uniqueValues: true,
        maxItems: 20,
        maxShift: false,
        canPush: true,
        canPull: true,
        nativeIndex: true,
        auditing: {
          updateSubcategory: 'access',
          changes: true
        },
        pusher: function(ac, node, values) {

          values = utils.uniqueIdArray(values)

          // allow direct role setting when provisioning. new account creation gates role
          if (!this.isNew) {

            const existing = utils.array(this.roles),
                  addingAdmin = !utils.inIdArray(existing, acl.OrgAdminRole) && utils.inIdArray(values, acl.OrgAdminRole),
                  addingSupport = !utils.inIdArray(existing, acl.OrgSupportRole) && utils.inIdArray(values, acl.OrgSupportRole),
                  addingDeveloper = !utils.inIdArray(existing, acl.OrgDeveloperRole) && utils.inIdArray(values, acl.OrgDeveloperRole)

            // only administrators can make these modifications, and only from a true request source (unless provisioning).
            if (!ac.option('provisioningOrg')) {
              const principal = ac?.req?.principal || ac?.principal
              if (addingAdmin && (!principal || !principal.isOrgAdmin())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The administrator role cannot be modified.', path: node.fullpath })
              }
              if (addingSupport && (!principal || !principal.isSupport())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The support role cannot be modified.', path: node.fullpath })
              }
              if (addingDeveloper && (!principal || !principal.isDeveloper())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The developer role cannot be modified.', path: node.fullpath })
              }
            }

            // disallow changes to provider roles for now.
            if (!utils.inIdArray(existing, acl.OrgProviderRole) && utils.inIdArray(values, acl.OrgProviderRole)) {
              throw Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'Updating Provider roles is not yet implemented', path: node.fullpath })
            }

          }

          return utils.intersectIdArrays(ac.org.roles.map(v => v._id), values)

        },
        writer: function(ac, node, values) {

          values = utils.uniqueIdArray(values)

          // allow direct role setting when provisioning. new account creation gates role
          if (!this.isNew) {

            const existing = utils.array(this.roles),
                  isSelf = utils.equalIds(ac.principalId, this._id),
                  addingAdmin = !utils.inIdArray(existing, acl.OrgAdminRole) && utils.inIdArray(values, acl.OrgAdminRole),
                  removingAdmin = utils.inIdArray(existing, acl.OrgAdminRole) && !utils.inIdArray(values, acl.OrgAdminRole),
                  addingSupport = !utils.inIdArray(existing, acl.OrgSupportRole) && utils.inIdArray(values, acl.OrgSupportRole),
                  removingSupport = utils.inIdArray(existing, acl.OrgSupportRole) && !utils.inIdArray(values, acl.OrgSupportRole),
                  addingDeveloper = !utils.inIdArray(existing, acl.OrgDeveloperRole) && utils.inIdArray(values, acl.OrgDeveloperRole),
                  removingDeveloper = utils.inIdArray(existing, acl.OrgDeveloperRole) && !utils.inIdArray(values, acl.OrgDeveloperRole)

            // only administrators can make these modifications, and only from a true request source (unless provisioning).
            if (!ac.option('provisioningOrg')) {
              const principal = ac?.req?.principal || ac?.principal
              if ((addingAdmin || removingAdmin) && (!principal || !principal.isOrgAdmin())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The administrator role cannot be modified.', path: node.fullpath })
              }
              if ((addingSupport || removingSupport) && (!principal || !principal.isSupport())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The support role cannot be modified.', path: node.fullpath })
              }
              if ((addingDeveloper || removingDeveloper) && (!principal || !principal.isDeveloper())) {
                throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The developer role cannot be modified.', path: node.fullpath })
              }
            }

            // an admin cannot remove their own admin role.
            if (isSelf && removingAdmin) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'An administrator cannot remove their own administrator role.', path: node.fullpath })
            }

            // the org create admin role cannot be removed.
            if (removingAdmin && utils.equalIds(ac.subjectId, ac.org.creator._id)) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The organization root account\'s administrator role cannot be removed.', path: node.fullpath })
            }

            // disallow changes to provider roles for now. an admin cannot remove their own role.
            if ((utils.inIdArray(existing, acl.OrgProviderRole) && !utils.inIdArray(values, acl.OrgProviderRole)) ||
              (!utils.inIdArray(existing, acl.OrgProviderRole) && utils.inIdArray(values, acl.OrgProviderRole))
            ) {
              throw Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'Updating provider roles is not yet implemented', path: node.fullpath })
            }

          }

          return utils.intersectIdArrays(ac.org.roles.map(v => v._id), values)

        },
        puller: function(ac, node, value) {

          // disallow changes to provider/admin roles for now. an admin cannot remove their own role.
          const roleId = utils.getIdOrNull(value),
                isSelf = utils.equalIds(ac.principalId, ac.subjectId),
                removingAdmin = roleId && utils.equalIds(acl.OrgAdminRole, roleId),
                removingSupport = roleId && utils.equalIds(acl.OrgSupportRole, roleId),
                removingDeveloper = roleId && utils.equalIds(acl.OrgDeveloperRole, roleId)

          // only administrators can make these modifications, and only from a true request source (unless provisioning).

          if (!ac.option('provisioningOrg')) {
            const principal = ac?.req?.principal || ac?.principal
            if (removingAdmin && (!principal || !principal.isOrgAdmin())) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The administrator role cannot be modified.', path: node.fullpath })
            }
            if (removingSupport && (!principal || !principal.isSupport())) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The support role cannot be modified.', path: node.fullpath })
            }
            if (removingDeveloper && (!principal || !principal.isDeveloper())) {
              throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The developer role cannot be modified.', path: node.fullpath })
            }
          }

          // an admin cannot remove their own admin role.
          if (isSelf && removingAdmin) {
            throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'An administrator cannot remove their own administrator role.', path: node.fullpath })
          }

          // the org create admin role cannot be removed.
          if (removingAdmin && utils.equalIds(ac.subjectId, ac.org.creator._id)) {
            throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'The organization root account\'s administrator role cannot be removed.', path: node.fullpath })
          }

          if (roleId && utils.equalIds(acl.OrgProviderRole, roleId)) {
            throw Fault.create('cortex.notImplemented.unspecified', { resource: ac.getResource(), reason: 'Updating provider roles is not yet implemented.', path: node.fullpath })
          }
          return value

        },
        writeAccess: acl.AccessLevels.Delete,
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgAdminRole, allow: acl.AccessLevels.Delete }],
        readable: true,
        writable: true
      }, {
        label: 'All Inherited Roles',
        name: 'inherited_roles',
        type: 'ObjectId',
        virtual: true,
        array: true,
        dependencies: ['roles'],
        reader: function(ac) {
          return utils.diffIdArrays(acl.expandRoles(ac.org.roles, this.roles), this.roles)
        }
      }, {
        label: 'Activation Required',
        name: 'activationRequired',
        type: 'Boolean',
        // description: 'True if the account must be activated before use. Dependent on Org settings.',
        writeAccess: acl.AccessLevels.System,
        readable: true,
        writable: true,
        removable: true
      }, {
        label: 'Stats',
        name: 'stats',
        type: 'Document',
        readAccess: acl.AccessLevels.Update,
        writeAccess: acl.AccessLevels.Script,
        array: false,
        writable: true,
        properties: [{
          label: 'Last Login',
          name: 'lastLogin',
          type: 'Document',
          readAccess: acl.Inherit,
          writeAccess: acl.AccessLevels.System,
          properties: [
            {
              label: 'Time',
              name: 'time',
              type: 'Date',
              nativeIndex: 1,
              readAccess: acl.Inherit,
              writeAccess: acl.AccessLevels.System
            },
            {
              label: 'IP Address',
              name: 'ip',
              type: 'String',
              readAccess: acl.Inherit,
              writeAccess: acl.AccessLevels.System
            }
          ]
        }, {
          label: 'Last Password Reset',
          name: 'lastPasswordReset',
          type: 'Date',
          readAccess: acl.Inherit,
          writeAccess: acl.AccessLevels.System
        }, {
          label: 'Password Expires',
          name: 'passwordExpires',
          type: 'Date',
          dependencies: ['stats', 'created'],
          readAccess: acl.Inherit,
          writeAccess: acl.Inherit,
          writable: true,
          removable: true,
          reader: function(ac) {
            let passwordExpires = utils.path(this.stats, 'passwordExpires')
            if (ac.org.configuration.passwordExpiryDays > 0) {
              const lastPasswordReset = utils.path(this.stats, 'lastPasswordReset') || this.created,
                    expiresUsingOrgSetting = new Date(lastPasswordReset.getTime() + (86400000 * ac.org.configuration.passwordExpiryDays))

              if (!utils.isValidDate(passwordExpires) || expiresUsingOrgSetting < passwordExpires) {
                passwordExpires = expiresUsingOrgSetting
              }
              return passwordExpires
            }
          }
        }, {
          label: 'Must Reset Password',
          name: 'mustResetPassword',
          type: 'Boolean',
          readAccess: acl.Inherit,
          writeAccess: acl.Inherit,
          writable: true,
          removable: true,
          writer: function(ac, node, value) {
            this.markModified('stats.mustResetPassword')
            return value
          }
        }]
      }, {
        label: 'Timezone',
        name: 'tz',
        type: 'String',
        // description: 'Used for determining UTC offset users in scripts',
        readable: true,
        writable: true,
        validators: [{
          name: 'timeZone'
        }]
      }]
  }
}

// shared methods --------------------------------------------------------

AccountDefinition.methods = {

  decryptClientKey: function(password, callback) {

    callback = _.once(callback)

    if (!_.isString(password)) {
      return callback(null, null)
    }

    crypto.pbkdf2(password, this.key.fingerprint || '', clientKeyRounds, clientKeyLength, this.key.hf || 'sha1', (err, derivedKey) => {

      let decrypted
      if (err) {
        logger.error('could not create client decryption key', { error: (err.stack || err) })
      } else {
        try {
          let decipher = crypto.createDecipher('aes256', derivedKey)
          decrypted = decipher.update(this.key.secret || '', 'base64', 'utf8')
          decrypted += decipher.final('utf8')
        } catch (e) {
          err = e
          logger.error('could not decrypt client key', { error: (err.stack || err) })
        }
      }
      callback(err, decrypted)
    })

  }

}

// shared statics --------------------------------------------------------

AccountDefinition.statics = {

  aclInit: function() {

    // after a role is removed. delete it from all accounts.
    modules.db.models.Org.hook('role.removed').after((vars, callback) => {
      this.collection.updateMany({ org: vars.ac.orgId, object: 'account' }, { $pull: { roles: vars.roleId } }, callback)
    })

  },

  updateLastLogin: function(accountId, ip, callback) {

    modules.db.sequencedUpdate(
      this,
      accountId, {
        $set: {
          'stats.lastLogin.time': new Date(),
          'stats.lastLogin.ip': ip
        }
      },
      utils.ensureCallback(callback)
    )
  },

  isAclReady: function(account) {
    return (
      modules.db.isModelInstance(account) &&
            account.constructor.__ObjectSchema__ &&
            account.constructor.objectName === 'account' &&
            account.isSelected('_id') &&
            account.isSelected('org') &&
            account.isSelected('roles') &&
            account.isSelected('email') &&
            account.isSelected('locked') &&
            account.isSelected('reap') &&
            !account.reap
    )
  }

}

// indexes ---------------------------------------------------------------

AccountDefinition.indexes = [

  [{ org: 1, object: 1, type: 1, roles: 1, _id: 1 }, { name: 'idxAccountRoles', partialFilterExpression: { object: 'account', roles: { $exists: true } } }],

  [{ org: 1, object: 1, type: 1, email: 1, _id: 1 }, { unique: true, name: 'idxAccountEmails', partialFilterExpression: { object: 'account', email: { $exists: true } } }],

  [{ org: 1, object: 1, type: 1, username: 1 }, { unique: true, name: 'idxAccountUsernames', partialFilterExpression: { object: 'account', username: { $exists: true } } }],

  // these will spill over into patient file! so native index there as well.
  [{ org: 1, object: 1, type: 1, 'name.first': 1, _id: 1 }, { name: 'idxFirstName', partialFilterExpression: { 'name.first': { $exists: true } } }],

  [{ org: 1, object: 1, type: 1, 'name.last': 1, _id: 1 }, { name: 'idxLastName', partialFilterExpression: { 'name.last': { $exists: true } } }],
  [{ org: 1, object: 1, type: 1, 'mobile': 1, _id: 1 }, { name: 'idxMobile', partialFilterExpression: { mobile: { $exists: true } } }],

  // for login stats
  [{ object: 1, 'stats.lastLogin.time': 1 }, { name: 'idxLastLoginTime', partialFilterExpression: { object: 'account', 'stats.lastLogin.time': { $exists: true } } }]
]

// shared hooks  ---------------------------------------------------------

AccountDefinition.apiHooks = [{
  name: 'post.create',
  before: function(vars, callback) {
    vars.ac.post.account = { _id: vars.ac.subjectId }
    callback()
  }
}, {
  name: 'create',
  fail: function(err, vars, callback) {
    if (err.errCode === 'cortex.conflict.duplicateKey') {
      err = Fault.create('cortex.conflict.duplicateEmail', { resource: vars.ac.getResource(), reason: 'An account with this email address already exists.', path: 'email' })
    }
    callback(err)
  }
}, {
  name: 'delete',
  before: function(vars, callback) {

    if (!vars.ac.org.configuration.allowAccountDeletion) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Cannot remove accounts in this organization.' }))
    }

    // never let the org creator be deleted
    if (utils.equalIds(vars.ac.org.creator._id, vars.ac.subjectId)) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Cannot remove the root account.' }))
    }
    if (utils.equalIds(vars.ac.principalId, vars.ac.subjectId)) {
      return callback(Fault.create('cortex.accessDenied.unspecified', { resource: vars.ac.getResource(), reason: 'Cannot remove your own account.' }))
    }
    callback()
  }
}, {
  name: 'update',
  after: function(vars) {

    const ac = vars.ac,
          modified = vars.modified

    // update the principal, if necessary.
    if (utils.equalIds(ac.subjectId, ac.principalId)) {
      ac.principal = new AccessPrincipal(ac.org, Object.assign(ac.principal.toObject(), ac.subject._doc || ac.subject.toObject()))
    }
    if (ac.script && utils.equalIds(ac.subjectId, ac.script.ac.principalId)) {
      ac.script.ac.principal = new AccessPrincipal(ac.org, Object.assign(ac.script.ac.principal.toObject(), ac.subject._doc || ac.subject.toObject()))
    }

    if (~modified.indexOf('profile.provider.state') && utils.path(ac.subject, 'profile.provider.state') === 'processing') {
      try {
        const recipients = utils.array(utils.path(ac.org, 'configuration.email.providerVerifications'))
        if (recipients.length > 0) {
          ac.org.sendNotification('AdminProviderAccountVerificationRequired', {
            account: ac.subject,
            subject: consts.Notifications.Types.AdminProviderAccountVerificationRequired.label,
            message: 'A provider in your organization (' + ac.subject.email + ') has submitted provider information that requires verification.',
            recipients: recipients,
            req: ac.req
          })
        }
      } catch (e) {}

      ac.org.sendNotification('ProviderVerificationProcessing', { account: ac.subject, req: ac.req })
    }

    // profile update trigger. skip with skipAccountProfileUpdateTrigger.
    if (!ac.option('skipAccountProfileUpdateTrigger')) {

      if (~modified.indexOf('password')) {
        ac.org.sendNotification('PasswordChangeNotification', { account: ac.subject, locale: ac.subject.locale, req: ac.req })
      }

      if (~modified.indexOf('mobile')) {
        ac.org.sendNotification('MobileChangeNotification', { account: ac.subject, locale: ac.subject.locale, req: ac.req })
      }

    }

    if (modified.includes('locked') && ac.subject.locked) {
      // Log audit for account locked
      modules.audit.recordEvent(ac, 'account', 'locked', { metadata: { message: 'Account access has been disabled.' } })
    }
  }
}]

// exports --------------------------------------------------------

module.exports = AccountDefinition
