'use strict'

const DocumentDefinition = require('./types/document-definition'),
      utils = require('../../../utils'),
      util = require('util'),
      _ = require('underscore'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      consts = require('../../../consts'),
      ap = require('../../../access-principal'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      makeUrlsDefinition = require('./properties/urls').definition

function OrgAppClientDefinition(options) {

  let properties = [{
    label: '_id',
    name: '_id',
    auto: true,
    type: 'ObjectId',
    // description: 'The client identifier.',
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
    readable: true,
    writable: false,
    dependencies: ['.key', '.rsa'],
    set: function(id) {
      this.key = modules.authentication.genAlphaNumString(consts.API_KEY_LENGTH)
      return id
    }
  }, {
    label: 'Enabled',
    name: 'enabled',
    type: 'Boolean',
    // description: 'Check this to enable calls into the API using this application client key.',
    readable: true,
    writable: true,
    default: false,
    acl: acl.Inherit
  }, {
    label: 'Key',
    name: 'key',
    type: 'String',
    // description: 'The application public key. Sent as the value of the Medable-Client-Key request header value, it is for all calls into the API.',
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
    readable: true,
    writable: true,
    writeAccess: acl.AccessLevels.System,
    validators: [{
      name: 'pattern',
      definition: {
        pattern: '/^([0-9a-z-A-Z]){' + consts.API_KEY_LENGTH + '}$/i'
      }
    }]

  }, {
    label: 'Label',
    name: 'label',
    type: 'String',
    // description: 'The client label.',
    readable: true,
    writable: true,
    acl: acl.Inherit,
    validators: [{
      name: 'required'
    }, {
      name: 'string',
      definition: { min: 1, max: 100 }
    }]
  }, {
    label: 'Read Only',
    name: 'readOnly',
    type: 'Boolean',
    // description: 'Checking this will only allow GET, HEAD, and OPTIONS API calls to be made using this key. Other methods will result in "kAccessDenied (readonly)" errors.',
    readable: true,
    writable: true,
    default: false,
    acl: acl.Inherit
  }, {
    label: 'Allow Name Mapping',
    name: 'allowNameMapping',
    type: 'Boolean',
    // description: 'Set to true to allow the parent app unique key to be used instead of the unique api key. app -> client is now always 1 to 1',
    writable: true,
    default: false,
    acl: acl.Inherit
  }, {
    label: 'Expires',
    name: 'expires',
    type: 'Date',
    // description: 'If set, API calls will fail with a kAccessDenied fault if made after the expiry date. Leave this blank to disable key expiry.',
    readable: true,
    writable: true,
    acl: acl.Inherit
  }, {
    label: 'Sessions',
    name: 'sessions',
    type: 'Boolean',
    // description:
    //    'API clients use POST /accounts/login to authenticate, and cookies are used to track the session. Most applications ' +
    //    'that call the API from a client application such as an iOS app will want to use a session-backed app. When disabled, ' +
    //    'clients must use the secret key to sign requests. Signing keys are better suited for back-end to back-end communications, or for allowing ' +
    //    'unprivileged calls into the API, with an "unsigned request". This option cannot be modified once a client is created.',
    readable: true,
    default: true,
    creatable: true,
    dependencies: ['.secret'],
    acl: acl.Inherit,
    set: function(value) {
      if (!value && this.isNew && !this.secret) {
        this.secret = modules.authentication.genAlphaNumString(consts.API_SECRET_LENGTH)
      }
      return value
    }
  }, {
    label: 'Auth Duration',
    name: 'authDuration',
    type: 'Number',
    // description: 'The session timeout value, it represents the number of seconds of inactivity before a request produces a cortex.accessDenied.sessionExpired fault.',
    readable: true,
    writable: true,
    validators: [{
      name: 'required'
    }, {
      name: 'number',
      definition: { min: 60, max: 86400, allowNull: false, allowDecimal: false }
    }],
    default: 900,
    acl: acl.Inherit
  }, {
    label: 'CSRF Session Protection',
    name: 'csrf',
    type: 'Boolean',
    // description: 'When true, authentication will produce a "medable-csrf-token" response header, which must be sent as a request header with each subsequent call for the duration of the session.',
    readable: true,
    writable: true,
    default: true,
    acl: acl.Inherit
  }, {
    label: 'CORS',
    name: 'CORS',
    type: 'Document',
    // description: 'CORS settings.',
    writable: true,
    properties: [{
      label: 'Origins',
      name: 'origins',
      type: 'String',
      // description: 'The list of origin domains allowed to make cross origin requests to supported API methods (e.g. https://myapp.example.com). Adding * will allow all origins.',
      array: true,
      uniqueValues: true,
      maxItems: utils.rInt(config('models.orgAppClient.corsMaxItems'), 100),
      canPush: true,
      canPull: true,
      readable: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'printableString',
        definition: { min: 1, max: 100, anyFirstLetter: true }
      }]
    }]
  }, {
    label: 'Allow Unsigned',
    name: 'allowUnsigned',
    type: 'Boolean',
    // description: 'Applies to Signing Keys. If true, API calls can be made using only the public api key. For security reasons, all unsigned calls are made anonymously (the client Client Account property and the Medable-Client-Account request header are ignored).',
    readable: true,
    writable: true,
    default: false,
    acl: acl.Inherit
  }, {
    label: 'Secret',
    name: 'secret',
    type: 'String',
    // description: 'The client secret key, used for signing request. Applies to sessionless clients.',
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
    readable: true,
    optional: true
  }, {
    label: 'Max Tokens per Principal',
    name: 'maxTokensPerPrincipal',
    type: 'Number',
    // description: 'The maximum number of permanent tokens per subject',
    acl: acl.Inherit,
    writable: true,
    default: 10,
    validators: [{
      name: 'number',
      definition: { min: 0, max: 100, allowNull: false, allowDecimal: false }
    }]
  }, {
    label: 'Expose to API',
    name: 'expose',
    type: 'Boolean',
    writable: true,
    default: false,
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
  }, {
    label: 'RSA',
    name: 'rsa',
    type: 'Document',
    acl: acl.Inherit,
    writable: true,
    properties: [{
      label: 'Regenerate',
      name: 'regenerate',
      type: 'Boolean',
      default: false,
      optional: true,
      writable: true,
      dependencies: ['.timestamp', '.public', '.private', '.rotated'],
      writer: function(ac, node, value, options, callback) {
        if (!value) {
          return callback(null, undefined)
        }
        modules.authentication.genRsaKeypair(2048, (err, { pub, priv } = {}) => {
          if (!err) {
            this.rsa.timestamp = new Date()
            this.rsa.public = pub
            this.rsa.private = priv
            this.rsa.rotated = []
            ac.hook('save').after(() => {
              ac.object.fireHook('client.generated_key_pair.after', null, { ac: ac, clientId: this._id, timestamp: this.rsa.timestamp }, () => {})
            })
          }
          callback(err, undefined)
        })
      }
    }, {
      label: 'Rotate',
      name: 'rotate',
      type: 'Boolean',
      default: false,
      optional: true,
      writable: true,
      dependencies: ['.timestamp', '.public', '.private', '.rotated'],
      writer: function(ac, node, value, options, callback) {
        if (!value) {
          return callback(null, undefined)
        }
        modules.authentication.genRsaKeypair(2048, (err, { pub, priv } = {}) => {
          if (!err) {
            if (this.rsa.private) {
              while (this.rsa.rotated.length >= 10) {
                this.rsa.rotated.shift()
              }
              this.rsa.rotated.push({
                timestamp: this.rsa.timestamp,
                public: this.rsa.public,
                private: this.rsa.private
              })
            }

            this.rsa.timestamp = new Date()
            this.rsa.public = pub
            this.rsa.private = priv
          }
          callback(err, undefined)
        })
      }
    }, {
      label: 'Generation Unix Timestamp',
      name: 'timestamp',
      type: 'Date',
      acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
    }, {
      label: 'Key Id',
      name: 'kid',
      type: 'Number',
      acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
      dependencies: ['.timestamp'],
      virtual: true,
      reader: function() {
        return this.rsa && this.rsa.timestamp ? this.rsa.timestamp.getTime() : undefined
      }
    }, {
      label: 'Public Key',
      name: 'public',
      type: 'String',
      acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
    }, {
      label: 'Private Key',
      name: 'private',
      type: 'String',
      readable: false
    }, {
      label: 'Rotated Keys',
      name: 'rotated',
      type: 'Document',
      acl: acl.Inherit,
      array: true,
      canPull: true,
      properties: [{
        label: 'Generation Unix Timestamp',
        name: 'timestamp',
        type: 'Date',
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
      }, {
        label: 'Key Id',
        name: 'kid',
        type: 'Number',
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
        dependencies: ['.timestamp'],
        virtual: true,
        reader: function() {
          return this.timestamp.getTime()
        }
      }, {
        label: 'Public Key',
        name: 'public',
        type: 'String',
        acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
      }, {
        label: 'Private Key',
        name: 'private',
        type: 'String',
        readable: false
      }]
    }]
  }, {
    label: 'IP Whitelist',
    name: 'whitelist',
    type: 'String',
    // description: 'When set, only IPv4 addresses that match listed ips or fall in the listed IPv4 CIDR ranges will be processed. All others will produce "kAccessDenied (ip)" faults.',
    array: true,
    uniqueValues: true,
    maxItems: 40,
    maxShift: false,
    canPush: true,
    canPull: true,
    writable: true,
    acl: acl.Inherit,
    validators: [{
      name: 'IPv4AddrOrCidr'
    }]
  },
  makeUrlsDefinition(), {
    label: 'IP Blacklist',
    name: 'blacklist',
    type: 'String',
    // description: 'When set, IPv4 addresses that match listed ips or fall in the listed IPv4 CIDR ranges will produce "kAccessDenied (ip)" faults.',
    array: true,
    uniqueValues: true,
    maxItems: 40,
    canPush: true,
    canPull: true,
    writable: true,
    acl: acl.Inherit,
    validators: [{
      name: 'IPv4AddrOrCidr'
    }]
  }, {
    label: 'filter',
    name: 'filter',
    type: 'Expression',
    writable: true,
    removable: true
  }, {
    label: 'API Pattern Restrictions',
    name: 'patterns',
    type: 'String',
    // description:
    //    'By adding pattern-matching, an app client can limit API access. This can be useful if using a key ' +
    //    'in an untrusted zone by limiting the scope of a client key to a few API calls. The regular expression patterns ' +
    //    'are matched against the HTTP method + the request path. For example, "GET /accounts/me" will match against "/^GET \/accounts\/me\/?$"',
    array: true,
    uniqueValues: true,
    maxItems: 40,
    canPush: true,
    canPull: true,
    readable: true,
    writable: true,
    acl: acl.Inherit,
    validators: [{
      name: 'printableString',
      definition: { min: 1, max: 255, anyFirstLetter: true }
    }, {
      name: 'adhoc',
      definition: {
        message: 'A valid pattern in the form of /^\\/(.*)\\/(.*)/',
        validator: function(ac, node, v) {
          var match
          return (_.isString(v) && v.length > 0 && (match = v.match(/^\/(.*)\/(.*)/)) && match[0].length > 0)
        }
      }
    }]
  }, {
    label: 'Principal Override',
    name: 'principalOverride',
    type: 'Boolean',
    // description: 'When true, a signed request can send a "Medable-Client-Account" request header with an account id that overrides the Client Account value for this app.',
    dependencies: ['.sessions'],
    readable: true,
    writable: true,
    default: false
  }, {
    label: 'Principal Id',
    name: 'principalId',
    type: 'ObjectId',
    // description: 'Applies to signing keys. The account used for requests made with this app key.',
    readable: true,
    writable: true,
    acl: acl.Inherit,
    default: acl.AnonymousIdentifier,
    validators: [{
      name: 'required'
    }, {
      name: 'adhoc',
      definition: {
        validator: function(ac, node, value, callback) {
          ap.create(ac.org, value, (err, principal) => {
            if (!err && principal && principal.role) {
              callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'App principal cannot be a role.' }))
            } else if (err && err.code === 'kNotFound') {
              callback(Fault.create('cortex.notFound.account'))
            } else {
              callback(err, principal && principal._id)
            }
          })
        }
      }
    }]
  }, {
    label: 'Principal Name',
    name: 'principalName',
    type: 'String',
    // description: 'Applies to signing keys. The name of the account being used for request made with this app key.',
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
    readable: true,
    virtual: true,
    dependencies: ['org', '.principalId'],
    groupReader: function(node, principal, entries, req, script, selection, callback) {

      let ids = utils.uniqueIdArray(entries.map(function(entry) { return entry.input.principalId }))
      function next(names) {
        entries.forEach(function(entry) {
          const accountId = entry.input.principalId,
                serviceAccount = principal.org.serviceAccounts.find(sa => utils.equalIds(sa._id, accountId))

          if (utils.equalIds(accountId, acl.AnonymousIdentifier)) {
            entry.parent[entry.key] = 'Anonymous'
          } else if (utils.equalIds(accountId, acl.PublicIdentifier)) {
            entry.parent[entry.key] = 'Org Member'
          } else if (serviceAccount) {
            entry.parent[entry.key] = `${serviceAccount.label} (${serviceAccount.name}@${principal.org.code}-iam.serviceaccount.medable.com)`
          } else if (accountId) {
            var fullName = utils.path(utils.findIdInArray(names, '_id', accountId), 'name')
            entry.parent[entry.key] = fullName ? ((fullName.first || '') + ' ' + (fullName.last || '')).trim() : ''
          } else {
            entry.parent[entry.key] = ''
          }
        })
        callback()
      }

      if (ids.length === 0) {
        next([])
      } else {
        modules.db.models.account.aclList(principal, { where: { _id: { $in: ids } }, req: req, script: script, skipAcl: true, override: true, paths: ['name'] }, function(err, accounts) {
          void err
          next(utils.path(accounts, 'data') || [])
        })
      }
    }
  }]

  DocumentDefinition.call(this, utils.extend({}, options, { properties: properties }))
}
util.inherits(OrgAppClientDefinition, DocumentDefinition)

OrgAppClientDefinition.prototype.aclWrite = function(ac, parentDocument, values, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback, true, false)

  DocumentDefinition.prototype.aclWrite.call(this, ac, parentDocument, values, options, (err, result) => {

    if (!err) {

      const added = parentDocument.getValue(this.docpath).filter(v => v.isNew)
      if (added.length) {

        ac.hook('save').before(function(vars, callback) {

          async.each(
            added,
            (doc, callback) => {
              modules.authentication.genRsaKeypair(2048, (err, { pub, priv } = {}) => {
                if (!err) {
                  doc.rsa.timestamp = new Date()
                  doc.rsa.public = pub
                  doc.rsa.private = priv
                  doc.rsa.rotated = []
                }
                callback()
              })
            },
            callback
          )
        })
      }
    }

    callback(err, result)

  })

}

module.exports = OrgAppClientDefinition
