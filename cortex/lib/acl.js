'use strict'

const utils = require('./utils'),
      { array: toArray, bson } = utils,
      util = require('util'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      modules = require('./modules'),
      consts = require('./consts'),
      IncomingMessage = require('http').IncomingMessage,
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      Hooks = require('./classes/hooks'),
      _ = require('underscore'),
      local = Object.defineProperties({}, {
        ap: { get: function() { return (this._ap || (this._ap = require('./access-principal'))) } },
        ExpansionQueue: { get: function() { return (this._eq || (this._eq = require('./modules/db/definitions/classes/expansion-queue'))) } },
        Org: { get: function() { return (this._Org || (this._Org = modules.db.models.Org)) } },
        Object: { get: function() { return (this._Object || (this._Object = modules.db.models.Object)) } }
      }),
      acl = module.exports = {
        BaseOrgName: 'Medable',
        BaseOrg: utils.createId('4d656461626c6552756c657a'),
        AnonymousIdentifier: consts.principals.anonymous,
        PublicIdentifier: consts.principals.public,
        SystemAdmin: utils.createId('000000000000000000000002'),
        OrgAdminRole: consts.roles.admin,
        OrgProviderRole: consts.roles.provider,
        OrgSupportRole: consts.roles.support,
        OrgDeveloperRole: consts.roles.developer,
        AccessTargets: {
          Account: 1,
          Reserved: 2,
          OrgRole: 3
        },
        AccessPrincipals: {
          Reserved: 1,
          Self: 2, // the context's access to itself (useful for users)
          Creator: 3, // *not used for context access*. may be used for other access entries..
          Owner: 4 // the context owner can access
        },
        AccessLevels: {
          // None: 0 this is set below based on minimum access level
          Public: 1, // can scan a minimum of public context details (ie. thumbnail image, name)
          Connected: 2, // can read non-private context details (ie. 'colleagues' get this access level)
          Reserved: 3, // reserved for future use.
          Read: 4, // can read all context details
          Share: 5, // can share/invite others to the object (eg. update colleagues) promote/demote access at this level or lower.
          Update: 6, // can update the context properties (base and accessible profiles)
          Delete: 7, // can delete the context
          Script: 8, // script access. can only be granted through scripts.
          System: 9 // full control. can read and write all properties. principals cannot be assigned this level of access.
        }
      },
      AclOperation = acl.AclOperation = {}

let Undefined

acl.EntryTypes = {
  Account: acl.AccessTargets.Account,
  Self: acl.AccessPrincipals.Self,
  Role: acl.AccessTargets.OrgRole,
  Owner: acl.AccessPrincipals.Owner,
  Access: 5,
  Expression: 6
}

acl.EntryTypesLookup = _.invert(acl.EntryTypes)

acl.AccessLevels.Min = acl.AccessLevels.Public
acl.AccessLevels.Max = acl.AccessLevels.System

acl.AccessLevels.None = acl.AccessLevels.Min - 1 // default level in allow access chain

acl.Inherit = -1

acl.VisibleAllowLevels = [acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update, acl.AccessLevels.Delete, acl.AccessLevels.Script].sort()

acl.AccessLevelsLookup = _.invert(acl.AccessLevels)
acl.AccessLevelsLowerCase = Object.entries(acl.AccessLevels).reduce((lcase, [key, value]) => {
  lcase[key.toLowerCase()] = value
  return lcase
}, {})
// -----------------------------------------------------------------------------------------------------------

class AclAccess {

  constructor(allow = acl.AccessLevels.None) {
    this.allow = allow
  }
  get allow() {
    return this._allow
  }
  set allow(v) {
    this._allow = acl.fixAllowLevel(v, true)
  }
  get resolved() {
    return this._allow
  }
  set resolved(v) {
    this.allow = v
  }
  merge(allow) {
    this._allow = Math.max(this._allow, acl.fixAllowLevel(allow, true))
    return this
  }
  hasAccess(v) {
    return this.resolved >= acl.fixAllowLevel(v)
  }

}

// -----------------------------------------------------------------------------------------------------------

/**
 *
 * @param {AccessPrincipal} principal
 * @param {object} subject
 * @param {object=} options
 *      override null. an acl access override. if 'true', sets to Max.
 *      object: an overriding object to use. if no subject is present, an object must be set in order for the AccessContext to function.
 *      grant null. an acl access level to grant (at least this level). resolved access equals Max(natural,grant). overridden by override
 *      roles. roles to grant the access context.
 *      req null. the https request or request id. if set, the 'method' property is set to match the request, unless overriden.
 *      method null. explicit request method option (head, get, put, post, delete, options).
 *      eq: null. the expansion queue to be used for reading operations. if none is passed, expansions will be disabled
 *      scoped true. if false, scopes should not be checked for this access context.
 *      options: null. a list of options to set using ac.option()
 *
 * @constructor
 */
function AccessContext(principal, subject = null, options = {}) {

  options = options || {}

  this.$__path = []
  this.$__resource = []

  this._id = utils.createId()
  this.principal = principal
  this.subject = subject

  this.override = utils.rBool(options.override, false)
  this.object = options.object
  this.grant = utils.rVal(options.grant, acl.AccessLevels.None)
  this.roles = options.roles
  this.method = utils.rVal(options.method, utils.path(options, 'req.method'))
  this.pacl = utils.array(options.pacl)
  this.script = utils.rVal(options.script, null)
  this.dryRun = options.dryRun
  this.unindexed = options.unindexed
  this.passive = Boolean(options.passive)

  this.$__scoped = utils.rBool(options.scoped, true)
  this.$__access = null
  this.setLocale(options.locale)
  this.$__hooks = null
  this.$__req = options.req
  this.$__eq = options.eq

  const acOptions = utils.option(options, 'options')
  if (_.isObject(acOptions)) {
    for (let option in acOptions) {
      if (acOptions.hasOwnProperty(option)) {
        this.option(option, acOptions[option])
      }
    }
  }

}

/**
 * prevent accidental export.
 * @returns {undefined}
 */
AccessContext.prototype.toJSON = function() {
  return undefined
}

AccessContext.RequestMethods = ['get', 'put', 'post', 'patch', 'delete', 'options']

AccessContext.prototype.inheritResource = function(resourcePath = null, sep = '/') {
  this.$__resource = []
  if (_.isString(resourcePath)) {
    this.$__inheritResource = resourcePath + sep
  } else if (Array.isArray(resourcePath)) {
    this.$__inheritResource = resourcePath.join('.') + sep
  } else {
    this.$__inheritResource = null
  }
}

AccessContext.prototype.beginResource = function(resourcePath) {
  this.$__resource = []
  if (resourcePath) {
    this.pushResource(resourcePath)
  }
}

AccessContext.prototype.replaceResource = function(resourcePath) {
  const old = this.$__resource.slice()
  this.$__resource = toArray(resourcePath, resourcePath).slice()
  return old
}

AccessContext.prototype.pushResource = function(resourcePath) {
  this.$__resource.push(resourcePath)
}

AccessContext.prototype.setResource = function(resourcePath) {
  if (this.$__resource.length) {
    this.$__resource[this.$__resource.length - 1] = resourcePath
  }
}

AccessContext.prototype.popResource = function() {
  return this.$__resource.pop()
}

AccessContext.prototype.getResource = function() {
  const resource = this.$__resource.join('.')
  if (this.$__inheritResource) {
    return `${this.$__inheritResource}${resource}`
  }
  return resource
}

AccessContext.prototype.initPath = function(objectName, identifier) {
  this.$__path = []
  const { prefix, object, _id } = this.initReadPath
  if (prefix) {
    this.addPath(prefix)
  }
  if (object) {
    this.addPath(objectName)
  }
  if (_id) {
    this.addPath(identifier)
  }
}
AccessContext.prototype.addPath = function(p) {
  this.$__path.push(p)
}
AccessContext.prototype.setPath = function(p) {
  if (this.$__path.length) {
    this.$__path[this.$__path.length - 1] = p
  }
}
AccessContext.prototype.delPath = function() {
  this.$__path.pop()
}
AccessContext.prototype.getPath = function(join = '.') {
  return this.$__path.join(join)
}

AccessContext.prototype.inAuthScope = function(scopeString, accept_prefix_match = true, validate = false) {
  if (!this.scoped) {
    return true
  }
  if (validate) {
    modules.authentication.validateAuthScope(this.org, scopeString)
  }
  return modules.authentication.authInScope(this.principal.scope, scopeString, accept_prefix_match)
}

Object.defineProperties(AccessContext.prototype, {
  document: {
    get: function() {
      return this.$__subject
    }
  },
  req: {
    get: function() {
      return this.$__req
    },
    set: function(req) {
      this.$__req = req
    }
  },
  readThroughPath: {
    get: function() {
      return this.$__readThroughPath || null
    },
    set: function(path) {
      this.$__readThroughPath = path || null
    }
  },
  initReadPath: {
    get: function() {
      return this.$__initReadPath || { object: true, _id: true, prefix: null }
    },
    set: function({ object = true, _id = true, prefix = null } = {}) {
      this.$__initReadPath = { object, _id, prefix }
    }
  },
  singlePath: {
    get: function() {
      return this.$__singlePath || null
    },
    set: function(path) {
      this.$__singlePath = utils.normalizeObjectPath(path, false, false, true)
      delete this.$__propPath
    }
  },
  singleCursor: {
    get: function() {
      return this.$__singleCursor || false
    },
    set: function(is) {
      this.$__singleCursor = Boolean(is)
    }
  },
  singleOptions: {
    get: function() {
      return this.$__singleOptions
    },
    set: function(v) {
      this.$__singleOptions = v
    }
  },
  singleCallback: {
    get: function() {
      return this.$__singleCallback
    },
    set: function(v) {
      this.$__singleCallback = v
    }
  },
  propPath: {
    get: function() {
      if (this.$__singlePath && this.$__propPath === undefined) {
        this.$__propPath = utils.normalizeObjectPath(this.$__singlePath, true, true, true)
      }
      return this.$__propPath || null

    }
  },
  script: {
    get: function() {
      return this.$__script || utils.path(this.$__req ? this.$__req.script : null)
    },
    set: function(script) {
      if (script == null || modules.sandbox.isPoolScript(script)) {
        this.$__script = script || null
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: this.getResource(), reason: 'AccessContext.script' })
      }
    }
  },
  reqId: {
    get: function() {
      return this.$__req ? utils.getIdOrNull(this.$__req, true) : null
    }
  },
  method: {
    get: function() {
      return this.$__method
    },
    set: function(method) {
      this.$__method = AccessContext.RequestMethods[AccessContext.RequestMethods.indexOf(String(method).toLowerCase())]
    }
  },
  scoped: {
    get: function() {
      return this.$__scoped
    },
    set: function(scoped) {
      this.$__scoped = !!scoped
    }
  },
  eq: {
    get: function() {
      return this.$__eq
    },
    set: function(eq) {
      this.$__eq = eq
    }
  },
  isSupportLogin: {
    get: function() {
      if (this.principal.isSysAdmin()) {
        return true
      }
      return this.principal.isSupportLogin
    }
  },
  access: {
    get: function() {
      if (!this.$__access) {
        this.resolve()
      }
      return this.$__access
    }
  },
  resolved: {
    get: function() {
      return this.$__override === false ? Math.max(this.grant, this.resolve(false)) : this.$__override
    },
    set: function(level) {
      this.access.resolved = level
    }
  },
  override: {
    get: function() {
      return this.$__override
    },
    set: function(override) {
      this.$__override = (override == null || override === false) ? false : acl.fixAllowLevel(override, true, override === true ? acl.AccessLevels.Max : undefined)
    }
  },
  grant: {
    get: function() {
      return Math.max(this.$__grant, this.principal.grant)
    },
    set: function(grant) {
      this.$__grant = acl.fixAllowLevel(grant, true, acl.AccessLevels.None)
    }
  },
  roles: {
    get: function() {
      if (!this.$__resolved_roles) {
        this.$__resolved_roles = acl.expandRoles(this.org ? this.org.roles : [], [...this.$__roles, ...(this.$__principal ? this.$__principal.roles : [])], this.org ? this.org.inlinedRoles : [])
      }
      return this.$__resolved_roles
    },
    set: function(roles) {
      this.$__roles = this.org.resolveRoles(roles)
      this.$__resolved_roles = null
      this.$__resolved_roleCodes = null
    }
  },
  roleCodes: {
    get: function() {
      if (!this.$__resolved_roleCodes) {
        const { org: { roles } } = this
        this.$__resolved_roleCodes = this.roles.map(roleId => roles.find(v => utils.equalIds(v._id, roleId))?.code || roleId).sort()
      }
      return this.$__resolved_roleCodes
    }
  },
  instance_roles: {
    get: function() {
      return this.$__roles || []
    }
  },
  org: {
    get: function() {
      return this.$__principal ? this.$__principal.org : null
    }
  },
  orgId: {
    get: function() {
      return this.$__principal ? this.$__principal.org._id : null
    }
  },
  object: {
    get: function() {
      return this.$__object || (this.$__subject ? this.$__subject.$model || this.$__subject.constructor : null)
    },
    set: function(object) {
      if (!object || acl.isObjectModel(object)) {
        this.$__object = object
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: this.getResource(), reason: 'AccessContext.object' })
      }
    }
  },
  objectId: {
    get: function() {
      return this.object ? this.object.objectId : null
    }
  },
  objectLabel: {
    get: function() {
      return this.object ? this.object.objectLabel : ''
    }
  },
  objectName: {
    get: function() {
      return this.object ? this.object.objectName : ''
    }
  },
  objectTypeId: {
    get: function() {
      return this.object ? this.object.objectTypeId : undefined
    }
  },
  objectTypeName: {
    get: function() {
      return this.object ? this.object.objectTypeName : undefined
    }
  },
  principal: {
    get: function() {
      return this.$__principal
    },
    set: function(principal) {
      if (principal === null || local.ap.is(principal)) {
        this.$__access = null
        this.$__resolved_roles = null
        this.$__principal = principal
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { resource: this.getResource(), reason: 'AccessContext.principal' })
      }
    }
  },
  principalId: {
    get: function() {
      return this.$__principal ? this.$__principal._id : null
    }
  },
  self: {
    get: function() {
      return utils.equalIds(this.principalId, this.subjectId)
    }
  },
  subject: {
    get: function() {
      return this.$__subject
    },
    set: function(subject) {
      this.$__access = null
      this.$__isAccessSubject = acl.isAccessSubject(subject)
      this.$__subject = subject
    }
  },
  hasOwner: {
    get: function() {
      return this.object && this.object.hasOwner
    }
  },
  hasCreator: {
    get: function() {
      return this.object && this.object.hasCreator
    }
  },
  ownerId: {
    get: function() {
      return this.hasOwner ? utils.path(this.$__subject, 'owner._id') : null
    }
  },
  creatorId: {
    get: function() {
      return this.hasCreator ? utils.path(this.$__subject, 'creator._id') : null
    }
  },
  subjectId: {
    get: function() {
      return this.$__subject ? this.$__subject._id : null
    }
  },
  allow: {
    get: function() {
      return this.access.allow
    },
    set: function(level) {
      this.access.allow = level
    }
  },
  isOwner: {
    get: function() {
      return this.$__isAccessSubject ? this.$__subject.isOwner(this.$__principal) : false
    }
  },
  isCreator: {
    get: function() {
      return this.$__isAccessSubject ? this.$__subject.isCreator(this.$__principal) : false
    }
  },
  apiHooks: {
    get: function() {
      return this.$__hooks || (this.$__hooks = new Hooks())
    }
  },
  indexRebuilds: {
    get: function() {
      return this.$__idx_rebuilds || (this.$__idx_rebuilds = new Set())
    }
  }

})

AccessContext.prototype.getLocale = function(discern = true, ensure = true) {

  if (!this.$__locale && discern) {

    // try to get the request locale using the context principal
    this.$__locale = modules.locale.discern(this.req, { ensure, principal: this.principal })

  }
  return this.$__locale
}

AccessContext.prototype.setLocale = function(locale) {
  locale = modules.locale.getCaseMatch(locale)
  if (locale) {
    this.$__locale = locale
    this.$__fixed_locale = locale
  }
}

AccessContext.prototype.getFixedLocale = function() {

  const { script, req } = this
  return this.$__fixed_locale || (script && script.fixedLocale) || (req && req.fixedLocale)

}

AccessContext.prototype.rebuildSubjectIndex = function() {
  const rebuilds = this.indexRebuilds
  if (rebuilds.size > 0) {
    modules.db.definitions.prepIndex(this.subject)
    rebuilds.forEach(property => property._rebuildPropertyIndex(this.subject))
  }
}

AccessContext.prototype.dispose = function() {
  this.$__parentAc = this.$__principal = this.$__override = this.$__access = this.$__subject = this.$__hooks = this.$__grant = this.$__object = null
}
AccessContext.prototype.resolve = function(force, customAcl) {
  if (!this.$__access || force) {
    this.$__access = this.$__principal ? this.resolveAccess({ acl: customAcl }) : new AclAccess()
  }
  return this.$__access.resolved
}
AccessContext.prototype.hasAccess = function(level) {
  return this.resolved >= acl.fixAllowLevel(level)
}
AccessContext.prototype.hasRole = function(v) {
  return utils.inIdArray(this.roles, v) || this.principal.hasRole(v)
}
AccessContext.prototype.canCreate = function(customAcl, override = false) {
  if (this.$__principal && this.object) {
    let createAcl = this.object.createAcl
    if (customAcl) {
      createAcl = acl.mergeAndSanitizeEntries(customAcl, override || createAcl)
    }
    const access = this.resolveAccess({ acl: createAcl })
    return access.hasAccess(acl.AccessLevels.Min)
  }
  return false
}

AccessContext.prototype.hook = function(name) {
  return this.apiHooks.register(name)
}

AccessContext.prototype.toObject = function() {

  return {
    object: 'ac',
    allow: this.allow,
    resolved: this.resolved,
    grant: this.grant,
    roles: this.roles,
    roleCodes: this.roleCodes,
    locale: this.getLocale(),
    instanceRoles: this.instance_roles,
    principal: this.principal ? this.principal.toObject() : (this.org ? local.ap.synthesizeAnonymous(this.org) : null),
    org: {
      _id: this.orgId,
      code: this.org ? this.org.code : ''
    },
    context: {
      _id: this.subjectId || Undefined,
      object: this.objectName
    },
    dryRun: this.dryRun || Undefined
  }

}

AccessContext.prototype.resolveAccess = function(options) {

  options = options || {}

  const principal = options.principal || this.principal,
        access = new AclAccess()

  if (principal) {

    const customAcl = utils.option(options, 'acl'),
          aclEntries = _.isArray(customAcl)
            ? customAcl
            : [
              ...utils.array(utils.path(this.object, 'defaultAcl')),
              ...utils.array(utils.path(this.subject, 'acl'))
            ],
          isCrossOrg = this.subject && utils.isId(this.subject.org) && !utils.equalIds(principal.org, utils.path(this.subject, 'org')), // if there's no subject, assume we're in the same org.
          isOrgObject = this.objectName === 'org'

    // acl can only be processed in the same org.
    if (!isCrossOrg) {

      // sys admins get automatic update access to their native org object.
      if (principal.isOrgAdmin() && isOrgObject) {
        access.allow = acl.AccessLevels.Update
      }

      // figure out which roles the caller holds based on passed in acl, combining them with current internal roles.
      this.roles = utils.idArrayUnion(this.$__roles, acl.expandRoles(
        this.org.roles,
        aclEntries.reduce((roles, entry) => this._mergeAclRoles(roles, entry, principal), [])
      ))
      aclEntries.forEach(entry => this._mergeAclEntry(access, entry, principal))
    }

  }

  if (options.withGrants) {
    access.merge(this.grant)
    access.merge(this.override)
  }

  return access
}

AccessContext.prototype._mergeAclRoles = function(roles, entry, principal) {
  if (utils.couldBeId(entry.allow)) {
    if (entry.target) {
      switch (entry.type) {
        case acl.AccessTargets.Account:
          if (utils.equalIds(principal._id, entry.target)) {
            roles.push(entry.allow)
          } else {
            if (utils.equalIds(acl.PublicIdentifier, entry.target) && !principal.isAnonymous()) {
              roles.push(entry.allow)
            }
            if (utils.equalIds(acl.AnonymousIdentifier, entry.target)) {
              roles.push(entry.allow)
            }
          }
          break
        case acl.AccessTargets.OrgRole:
          if (principal.hasRole(entry.target)) {
            roles.push(entry.allow)
          }
          break
      }
    } else {
      switch (entry.type) {
        case acl.AccessPrincipals.Self: // account is accessing itself.
          if (this.objectName === 'account' && utils.equalIds(principal._id, this.subjectId)) {
            roles.push(entry.allow)
          }
          break
        case acl.AccessPrincipals.Creator: // the target is the subject creator
          if (utils.equalIds(principal._id, this.creatorId)) {
            roles.push(entry.allow)
          }
          break
        case acl.AccessPrincipals.Owner: // the target is the subject owner
          if (utils.equalIds(principal._id, this.ownerId)) {
            roles.push(entry.allow)
          }
          break
      }
    }
  }
  return roles
}

AccessContext.prototype._mergeAclEntry = function(access, entry, principal) {

  if (utils.isInt(entry.allow)) {
    if (entry.target) {
      switch (entry.type) {
        case acl.AccessTargets.Account:
          if (utils.equalIds(principal._id, entry.target)) {
            access.merge(entry.allow)
          } else {
            if (utils.equalIds(acl.PublicIdentifier, entry.target) && !principal.isAnonymous()) {
              access.merge(entry.allow)
            }
            if (utils.equalIds(acl.AnonymousIdentifier, entry.target)) {
              access.merge(entry.allow)
            }
          }
          break
        case acl.AccessTargets.OrgRole:
          if (utils.inIdArray(this.$__roles, entry.target) || principal.hasRole(entry.target)) { // use internal $__roles in case principal does not match this.$__principal.
            access.merge(entry.allow)
          }
          break
      }
    } else {
      switch (entry.type) {
        case acl.AccessPrincipals.Self: // account is accessing itself.
          if (this.objectName === 'account' && utils.equalIds(principal._id, this.subjectId)) {
            access.merge(entry.allow)
          }
          break
        case acl.AccessPrincipals.Creator: // the target is the subject creator
          if (utils.equalIds(principal._id, this.creatorId)) {
            access.merge(entry.allow)
          }
          break
        case acl.AccessPrincipals.Owner: // the target is the subject owner
          if (utils.equalIds(principal._id, this.ownerId)) {
            access.merge(entry.allow)
          }
          break
      }
    }
  }
}

/**
 * options getter and setter
 */

/**
 * set arbitrary options that can be used in the pipeline.
 *
 * @param option can be pathed (listing.apiHooks)
 * @param value if present, the option is set and this is returns
 * @return
 */
AccessContext.prototype.option = function(option, value) {

  const options = this.$__options || (this.$__options = {})
  if (arguments.length > 1) {
    options[option] = value
    return this
  }
  return options[option]

}

AccessContext.prototype._copyOptions = function() {

  // hacky but for now it'll work. $ options don't copy and are local to an ac. all others are copied through the hierarchy.
  return Object.keys(this.$__options || {}).reduce((opts, key) => {
    if (key && key[0] !== '$') {
      opts[key] = this.$__options[key]
    }
    return opts
  }, {})

}

/**
 * creates a new access context with a new subject. arbitrary options are not preserved. grant, override, object, req, method, scoped are preserved
 *
 * @param subject
 * @param options
 * @param copyOptions
 * @param breakWithParent
 * @param copyEq
 * @param inheritRoles
 * @returns {AccessContext}
 */
AccessContext.prototype.copy = function(subject, options, copyOptions = false, breakWithParent = false, copyEq = false, inheritRoles = true) {
  let ac,
      opts = utils.extend({ dryRun: this.dryRun, override: this.$__override, grant: this.$__grant, object: this.$__object, scoped: this.$__scoped, locale: this.$__locale, req: this.req, script: this.script, method: this.method, unindexed: this.unindexed, passive: this.passive }, options)
  if (copyOptions) {
    opts.options = this._copyOptions()
  }
  ac = new AccessContext(this.$__principal, subject, opts)
  ac.$__parentAc = breakWithParent ? null : this
  ac.$__singlePath = this.$__singlePath
  ac.$__singleCursor = this.$__singleCursor
  ac.$__singleOptions = this.$__singleOptions
  ac.$__singleCallback = this.$__singleCallback
  ac.$__propPath = this.$__propPath
  ac.$__readThroughPath = this.$__readThroughPath
  ac.$__inheritResource = this.$__inheritResource
  ac.$__resource = this.$__resource.slice()
  if (copyEq && this.$__eq) {
    ac.$__eq = this.$__eq
  }
  if (inheritRoles) {
    ac.roles = this.$__roles
  }
  return ac
}

AccessContext.prototype.updateOrg = function(org) {
  if (org !== this.principal.org) {
    if (this.req instanceof IncomingMessage) {
      if (utils.equalIds(this.req.org._id, org._id)) {
        this.req.org = org
      }
    }
    this.principal.updateOrg(org)
    if (this.script) {
      this.script.updateOrg(org)
    }
    if (this.$__parentAc) {
      this.$__parentAc.updateOrg(org)
    }
  }
}

AccessContext.prototype.markSafeToUpdate = function(node) {
  (this.$__safe || (this.$__safe = new Set())).add(node)
}

AccessContext.prototype.isSafeToUpdate = function(node) {
  return this.$__safe ? this.$__safe.has(node) : false
}

AccessContext.prototype.documentPathForAclKey = function(key) {
  switch (key) {
    case '_id':
    case 'acl':
    case 'aclv':
      return key
    case 'owner': return (this.object && this.object.hasOwner) ? 'owner._id' : null
    case 'creator': return (this.object && this.object.hasCreator) ? 'creator._id' : null
  }
  return null
}

AccessContext.prototype._handleAutoCreate = function(callback) {

  if (this.object.isUnmanaged) {
    return callback()
  }

  modules.db.definitions.validateAutoCreate(this.org, this.object, (err, collected) => {

    if (err || !collected || collected.length === 0) {
      return callback(err)
    }

    // create new ones, making sure they will all validate before saving.
    async.mapSeries(
      collected,
      (node, callback) => {
        node.autoCreateContext(this, (err, contextAc) => {
          if (!err) {
            contextAc.option('$autoCreateNode', node)
          }
          callback(err, contextAc)
        })
      },
      (err, created) => {
        if (err) {
          return callback(err)
        }
        // after they've all saved, write the successful ones to the document references.
        async.eachSeries(
          created,
          (contextAc, callback) => {
            contextAc.script = this.script // to honour max execution depth.
            contextAc.req = this.req
            contextAc.dryRun = this.dryRun
            contextAc.save(err => {
              if (err) return callback(err)
              const node = contextAc.option('$autoCreateNode')
              utils.path(this.subject, node.fullpath, { _id: contextAc.subjectId })
              node.forceImmediateIndexRebuild(this, this.subject, callback)
            })
          },
          err => {
            if (err && !this.dryRun) {
              // attempt to delete successfully created contexts?
              created.forEach(function(contextAc) {
                if (!contextAc.subject.isNew) {
                  contextAc.method = 'delete'
                  contextAc.save(err => {
                    if (err) {
                      logger.error('failed to delete dangling auto-create reference', Object.assign(utils.toJSON(err, { stack: true }), { subjectId: contextAc.subjectId, objectName: contextAc.objectName, hostObject: this.objectName }))
                    }
                  })
                }
              })
            }
            callback(err)
          })
      }
    )
  })
}

AccessContext.prototype._preAction = function(action, { isUnmanaged, modifiedPaths, changedPaths, disableTriggers, skipValidation }, callback) {

  const object = this.object,
        subject = this.subject

  if (isUnmanaged) {
    if (skipValidation) {
      return callback()
    }
    return subject.validateWithAc(this, callback)
  }

  modules.sandbox.triggerScript(`${action}.before`, this.script, this, { disableTriggers, attachedSubject: subject, changedPaths: changedPaths, isNew: subject.isNew }, { dryRun: this.dryRun, modified: modifiedPaths }, err => {
    if (err) {
      return callback(Fault.from(err, false, true))
    }
    object.fireHook(`${action}.before`, null, { ac: this }, err => {
      if (err) {
        return callback(Fault.from(err, false, true))
      }
      object.fireHook('validate.before', null, { ac: this }, err => {
        if (err) {
          return callback(Fault.from(err, false, true))
        }
        this.apiHooks.fire(subject, 'validate.before', null, { ac: this }, err => {
          if (err) {
            return callback(Fault.from(err, false, true))
          }

          const validated = err => {
            object.fireHook('validate.after', Fault.from(err), { ac: this }, err => {
              this.apiHooks.fire(subject, 'validate.after', err, { ac: this }, err => {
                if (err) {
                  return callback(Fault.from(err, false, true))
                }
                object.fireHook('save.before', null, { ac: this, modified: modifiedPaths }, err => {
                  if (err) {
                    return callback(Fault.from(err, false, true))
                  }
                  this.apiHooks.fire(subject, 'save.before', null, { ac: this, modified: modifiedPaths }, callback)
                })
              })
            })
          }
          if (skipValidation) {
            validated()
          } else {
            subject.validateWithAc(this, validated)
          }
        })
      })
    })
  })
}

AccessContext.prototype._postAction = function(action, err, isNew, { isUnmanaged, modifiedPaths, readableModified, changedPaths, disableTriggers }, callback) {

  const subject = this.subject,
        object = this.object,
        apiHooks = this.apiHooks

  if (isUnmanaged || object.isUnmanaged) {
    return callback(err, readableModified)
  }

  this.$__hooks = null

  // post hooks, should not interrupt program flow unless inline. errors generated by these hooks are ignored.
  apiHooks.fire(subject, 'save.after', err, { ac: this, modified: modifiedPaths }, () => {
    object.fireHook(`${action}.after`, err, { ac: this, modified: modifiedPaths }, () => {
      if (err) {
        return callback(Fault.from(err, false, true))
      }
      modules.sandbox.triggerScript(`${action}.after`, this.script, this, { disableTriggers, attachedSubject: subject, changedPaths: changedPaths, isNew: isNew }, { modified: readableModified }, (err, results) => {
        void err
        let inlineResultWithError = results && results.executions.find(v => v.inline && v.err)
        callback(inlineResultWithError && inlineResultWithError.err, readableModified)
      })
    })
  })
}

/**
 *
 * @param options
 *   insert (default true) if false, the insert object is returned in the callback,
 *   disableTriggers: false
 * @param callback -> err, readableModified
 * @private
 */
AccessContext.prototype._create = function(options, callback) {

  callback = utils.profile.fn(callback, 'ac._create')

  const modifiedPaths = this.subject.modifiedPaths(true, true),
        object = this.object,
        subject = this.subject,
        isUnmanaged = options.isUnmanaged || object.isUnmanaged

  this._preAction('create', { modifiedPaths, isUnmanaged, disableTriggers: options.disableTriggers, skipValidation: options.skipValidation }, err => {

    if (!err) {
      try {
        object.schema.node.walk(property => {
          property._checkShouldReIndex(this, subject)
        })
        this.rebuildSubjectIndex()
      } catch (e) {
        err = e
      }
    }
    if (err) {
      return callback(err)
    }

    this._handleAutoCreate(err => {

      if (err) {
        return callback(err)
      }

      // get new paths (before save can update new paths not in the cache)
      const modifiedPaths = subject.modifiedPaths(),
            readableModified = subject.readableModifiedPaths(modifiedPaths),
            insert = subject.toObject({ depopulate: 1 }),
            sz = bson.calculateObjectSize(insert)

      utils.path(insert, 'meta.sz', sz)
      if (object.dataset && object.dataset.targetCollection) {
        (insert.meta.up = utils.array(insert.meta.up, insert.meta.up)).push(consts.metadata.updateBits.migrate)
      }
      if (options.insert === false) {
        return callback(null, insert)
      } else if (this.dryRun) {
        callback(err, readableModified)
      } else {
        subject.$__reset()
        subject.isNew = false
        subject.emit('isNew', false)
        this.object.collection.insertOne(insert, { writeConcern: { w: 'majority' } }, err => {
          err = this._detectIndexError(err, subject)
          if (!err) {
            if (utils.path(this.object, 'auditing.enabled')) {
              modules.audit.recordEvent(this, this.object.auditing.category, 'create')
            }
            modules.db.models.Stat.addRemoveDocuments(insert.org, insert.object, insert.object, insert.type, 1, sz)
          } else {
            err = Fault.from(err)
          }
          this._postAction('create', err, true, { isUnmanaged, disableTriggers: options.disableTriggers, modifiedPaths, readableModified, changedPaths: options.changedPaths }, callback)
        })
      }
    })
  })

}

AccessContext.prototype._delete = function(options, callback) {

  beforeDelete(this, err => {

    if (err) {
      return callback(err)
    } else if (this.dryRun) {
      return callback(null, [])
    }

    const match = { _id: this.subjectId, reap: false },
          update = { $inc: { sequence: 1 }, $set: { reap: true, idx: { v: -1 } } } // skip the sequencing but increment anyway to force others to re-read.

    this.object.collection.updateOne({ _id: this.subjectId, reap: false }, update, { writeConcern: { w: 'majority' } }, (err, result) => {
      err = Fault.from(err)
      const wasDeleted = utils.path(result, 'modifiedCount') === 1
      if (wasDeleted) {
        if (utils.path(this.object, 'auditing.enabled')) {
          modules.audit.recordEvent(this, this.object.auditing.category, 'delete', { metadata: { filter: match, deletedCount: 1 } })
        }
        if (config('debug.instantReaping')) {
          const reaper = modules.workers.getWorker('instance-reaper'),
                WorkerMessage = require('./modules/workers/worker-message'),
                message = new WorkerMessage(null, reaper, { req: options.req })
          return reaper.process(message, {}, {}, () => {
            callback(err, [])
          })
        } else {
          modules.workers.runNow('instance-reaper')
        }
      }
      afterDelete(err, this, err => {
        if (err) {
          callback(err)
        } else {
          if (!this.object.isUnmanaged) {
            contextCleanup(this)
          }
          callback(null, [])
        }
      })
    })
  })

  function beforeDelete(ac, callback) {
    if (ac.object.isUnmanaged) {
      return callback()
    }
    modules.sandbox.triggerScript('delete.before', ac.script, ac, { disableTriggers: options.disableTriggers, attachedSubject: ac.subject }, { dryRun: ac.dryRun }, err => {
      if (err) {
        return callback(err)
      }
      ac.object.fireHook('delete.before', null, { ac }, callback)
    })
  }

  function afterDelete(err, ac, callback) {
    if (ac.object.isUnmanaged) {
      return callback()
    }
    ac.object.fireHook('delete.after', err, { ac, modified: [] }, () => {
      if (err) {
        return callback(err)
      }
      modules.sandbox.triggerScript('delete.after', ac.script, ac, { disableTriggers: options.disableTriggers, attachedSubject: ac.subject }, { modified: [] }, () => {
        callback()
      })
    })
  }

  function contextCleanup(ac) {

    const start = utils.profile.start(),
          { orgId: org, objectName: object } = ac,
          type = null

    async.parallel([
      callback => {
        modules.db.models.Object.getRemoteCascadeDeleteProperties(ac.orgId, ac.objectName, (err, props) => {
          if (err) {
            logger.error(`error setting up cascade delete for ${ac.objectName}.${ac.subjectId}`, utils.toJSON(err, { stack: true }))
          } else if (props.length) {
            modules.workers.send('work', 'cascade-deleter', {
              req: ac.reqId,
              org: ac.orgId,
              principal: ac.principalId,
              subject: ac.subjectId,
              properties: props
            }, {
              reqId: ac.reqId,
              orgId: ac.orgId
            })
          }
          callback()
        })
      },
      callback => {
        modules.db.models.notification.collection.deleteMany({ 'context._id': ac.subjectId }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('aclDelete notification removal error: ', utils.toJSON(err, { stack: true }))
          callback()
        })
      },
      callback => {
        modules.db.models.history.collection.updateMany({ org, object, type, 'context._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('aclDelete history reap error: ', utils.toJSON(err, { stack: true }))
          callback()
        })
      },
      callback => {
        modules.db.models.post.collection.updateMany({ 'context._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('aclDelete post reap error: ', utils.toJSON(err, { stack: true }))
          callback()
        })
      },
      callback => {
        modules.db.models.comment.collection.updateMany({ 'pcontext._id': ac.subjectId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('aclDelete comment reap error: ', utils.toJSON(err, { stack: true }))
          callback()
        })
      },
      callback => {
        modules.db.models.connection.deleteMany({ org, 'context.object': object, 'context._id': ac.subjectId }, function(err) {
          if (err) logger.error('aclDelete connections removal error: ', utils.toJSON(err, { stack: true }))
          callback()
        })
      },
      callback => {
        if (ac.objectName === 'account') {
          acl.AclOperation.removeAllTargetEntries(local.ap.synthesizeAccount({ org: ac.org, accountId: ac.subjectId }), function(err) {
            if (err) logger.error(ac.object.objectName + '.remove. error removing acl entries for ' + ac.subjectId, utils.toJSON(err, { stack: true }))
            callback()
          })
        } else {
          callback()
        }
      }
    ], () => {
      utils.profile.end(start, 'ac.contextCleanup')
    })
  }

}

AccessContext.prototype._resolveUpdateError = function(err, result, isVersioned, version, sequencing, indexing, callback) {

  // if versioned, the missing document may be due to either sequencing or versioning. attempt to resolve by retrieving the version
  if (!err && isVersioned && result.matchedCount === 0) {
    this.object.collection.find({ _id: this.subjectId }).limit(1).project({ _id: 1, version: 1 }).toArray((err, docs) => {
      const doc = docs && docs[0]
      if (!err && doc) {
        if (version !== (doc.version || 0)) {
          err = Fault.create('cortex.conflict.versionOutOfDate', { resource: this.getResource(), path: this.object.schema.node.findNode('version').fqpp })
        }
      }
      versionChecked(this, err)
    })
  } else {
    versionChecked(this, err)
  }

  function versionChecked(self, err) {

    err = self._detectIndexError(err, self.subject, indexing, result)

    // if versioned, the missing document may be due to either sequencing or versioning.
    // determine which by attempting to retrieve the version
    if (!err && isVersioned && result.matchedCount === 0) {
      err = Fault.create('cortex.conflict.sequencing', { resource: self.getResource(), reason: 'Sequencing Error (vue)', path: self.subject ? `${self.subject.object}.${self.subject._id}` : Undefined })
    }
    if (!err && sequencing && result.matchedCount === 0) {
      err = Fault.create('cortex.conflict.sequencing', { resource: self.getResource(), reason: 'Sequencing Error (rue)', path: self.subject ? `${self.subject.object}.${self.subject._id}` : Undefined })
    }
    callback(err)
  }

}

AccessContext.prototype._update = function(options, callback) {

  callback = utils.profile.fn(callback, 'ac._update')

  const subject = this.subject,
        object = this.object,
        root = object.schema.node,
        isUnmanaged = options.isUnmanaged || this.object.isUnmanaged,
        modifiedPaths = subject.modifiedPaths(true, true),
        isVersioned = utils.rBool(options.versioned, true) && object.isVersioned,
        version = this.option('$setVersion'),
        migrating = object.dataset && object.dataset.targetCollection

  // require a version to be written for existing documents, storing the value in $setVersion for save.
  if (isVersioned) {
    if (!utils.isInt(version)) {
      return callback(Fault.create('cortex.invalidArgument.versionRequired', { resource: this.getResource(), path: utils.path(root.findNode('version'), 'fqpp') }))
    } else if ((subject.version || 0) !== version) {
      return callback(Fault.create('cortex.conflict.versionOutOfDate', { resource: this.getResource(), path: utils.path(root.findNode('version'), 'fqpp') }))
    }
  }

  if (!subject.isModified(null, modifiedPaths)) {
    const readableModified = this.option('$readableModified') || []
    if (isUnmanaged || readableModified.length === 0) {
      return callback(null, readableModified)
    }
    // indirectly modified (probably through a list update)
    return modules.sandbox.triggerScript(`update.after`, this.script, this, { disableTriggers: options.disableTriggers, attachedSubject: this.subject, changedPaths: modifiedPaths, isNew: false }, { modified: readableModified }, (err, results) => {
      void err
      let inlineResultWithError = results && results.executions.find(v => v.inline && v.err)
      callback(inlineResultWithError && inlineResultWithError.err, readableModified)
    })
  }

  this._preAction('update', { modifiedPaths, isUnmanaged, changedPaths: options.changedPaths, disableTriggers: options.disableTriggers, skipValidation: options.skipValidation }, err => {

    if (!err) {
      try {
        this.rebuildSubjectIndex()
      } catch (e) {
        err = e
      }
    }
    if (err) {
      return callback(err)
    }

    if (!object.isUnmanaged) {
      subject.updated = Date.now()
      if (!subject.updater || !utils.equalIds(subject.updater._id, this.principalId)) {
        subject.updater = { _id: this.principalId }
      }
    }

    // get new paths (before save can update new paths not in the cache)
    const modifiedPaths = subject.modifiedPaths(),
          readableModified = subject.readableModifiedPaths(modifiedPaths),
          delta = subject.$__delta(),
          update = delta[1] || {},
          find = { _id: subject._id },
          where = delta[0],
          sequencing = where && where.sequence !== undefined,
          indexing = this._sequenceIndexes(subject, find, update, modifiedPaths)

    if (delta instanceof Error) {
      return callback(delta)
    } else if (!delta) {
      subject.$__reset()
      return callback(null, [])
    }

    if (sequencing) {
      find.sequence = where.sequence
      update.$inc || (update.$inc = {})
      update.$inc['sequence'] = 1
    }
    if (isVersioned) {
      // objects newly configured with isVersioned will have no version at all.
      const raw = subject.$raw || { version: subject.version }
      if (raw.version === undefined) {
        find.version = { $exists: false }
        update.$set || (update.$set = {})
        update.$set['version'] = 1
      } else {
        find.version = subject.version
        update.$inc || (update.$inc = {})
        update.$inc['version'] = 1
      }
    }

    if (update.$set && _.isArray(update.$set['meta.up'])) {
      update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.documentSize))
      if (migrating) {
        update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.migrate))
      }
    } else {
      let metaUp = (update.$addToSet || (update.$addToSet = {}))['meta.up'] || (update.$addToSet['meta.up'] = { $each: [] })
      if (_.isNumber(metaUp)) {
        metaUp = (update.$addToSet['meta.up'] = { $each: [] })
      }
      metaUp.$each.push(consts.metadata.updateBits.documentSize)
      if (migrating) {
        metaUp.$each.push(consts.metadata.updateBits.migrate)
      }
    }

    try {
      this._guardArrayUpdates(subject, update.$set, root)
    } catch (err) {
      return callback(err)
    }

    if (this.dryRun) {
      return callback(null, readableModified)
    }

    object.collection.updateOne(find, update, { writeConcern: { w: 'majority' } }, (err, result) => {

      this._resolveUpdateError(err, result, isVersioned, version, sequencing, indexing, err => {

        if (!err) {
          if (sequencing) {
            subject.setValue('sequence', (subject.getValue('sequence') || 0) + 1)
          }
          if (isVersioned) {
            subject.setValue('version', (subject.getValue('version') || 0) + 1)
          }
          if (indexing) {
            subject.setValue('idx.v', (subject.getValue('idx.v') || 0) + 1)
          }
          subject.$__reset()
          if (this.$__safe) {
            this.$__safe.clear()
          }
        }

        this._postAction(
          'update',
          err,
          false,
          {
            modifiedPaths,
            isUnmanaged: options.isUnmanaged,
            disableTriggers: options.disableTriggers,
            changedPaths: options.changedPaths,
            readableModified: _.uniq([...readableModified, ...utils.array(this.option('$readableModified'))]).sort()
          },
          callback
        )

      })

    })

  })

}

/**
 * depending on the method, a save operation can 'put'/'post': create or update, 'delete': delete a context.

 * @param options
 *    changedPaths
 *    dryRun (boolean=false)
 *    versioned (boolean=true)
 *    skipValidation (boolean=false)
 * @param callback err, readableModifiedPaths
 *
 */
AccessContext.prototype.save = function(options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback)

  if (!this.principal || !this.org || !this.object || !this.subject || !this.subject.schema || !this.subject.schema.node.root) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: this.getResource(), reason: 'missing principal, org, object and/or subject' }))
  }

  this.subject.increment()

  if (this.subject.isNew) {
    this._create(options, callback)
  } else if (this.method === 'delete') {
    this._delete(options, callback)
  } else {
    this._update(options, callback)
  }

}

AccessContext.prototype._sequenceIndexes = function(subject, find, update, modifiedPaths) {

  // existing object that have a modifed index must be versioned in order to allow for
  if (!subject.isNew && subject.isModified('idx', modifiedPaths)) {
    find['idx.v'] = subject.idx.v // will trigger a sequencing error.
    update.$inc || (update.$inc = {})
    update.$inc['idx.v'] = 1
    if (update.$set) {
      delete update.$set['idx.v']
    }
    return true
  }
  return false

}

AccessContext.prototype._detectIndexError = function(err, target, indexing, result) {

  if (indexing && !err && result.matchedCount === 0) {
    err = Fault.create('cortex.conflict.sequencing', { resource: this.getResource(), reason: 'Sequencing Error (dei)' })
  } else if (err && ((err instanceof Error && err.name === 'MongoError') || err.constructor.name === 'WriteError' || err.constructor.name === 'BulkWriteError')) {
    if (err.code === 11000 || err.code === 11001) {
      const propertyIds = utils.getIdArray((err.message || err.errmsg || '').match(/([a-f0-9]{24})/ig))
      for (let propertyId of propertyIds) {
        const property = target.schema.node.findNodeById(propertyId)
        if (property) {
          return Fault.validationError('cortex.conflict.duplicateKey', { resource: this.getResource(), path: property.fullpath })
        }
      }
      err = Fault.validationError('cortex.conflict.duplicateKey', { resource: this.getResource(), path: '?' })
    }
  }
  return err
}

/**
 *
 * @param options
 *  subject
 *  dryRun
 * @param callback
 * @returns {*}
 */
AccessContext.prototype.lowLevelUpdate = function(options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback)

  const dryRun = this.dryRun,
        subject = utils.rVal(options.subject, this.$__subject) // hack. low level subject access.

  if (!subject) {

    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: this.getResource(), reason: 'invalid access context update subject' }))

  } else {

    subject.increment()

    const delta = subject.$__delta()

    if (delta instanceof Error) {

      return callback(delta)

    } else if (!delta) {

      subject.$__reset()
      return callback()

    } else {

      const update = delta[1] || {},
            find = { _id: subject._id },
            where = delta[0],
            sequencing = where && where.sequence !== undefined,
            indexing = this._sequenceIndexes(subject, find, update),
            onUpdated = (err) => {
              if (!err && sequencing) {
                subject.setValue('sequence', (subject.getValue('sequence') || 0) + 1)
              }
              if (!err && indexing) {
                subject.setValue('idx.v', (subject.getValue('idx.v') || 0) + 1)
              }
              if (!err) {
                subject.$__reset()
                if (this.$__safe) {
                  this.$__safe.clear()
                }
              }
              callback(err)
            }

      if (sequencing) {
        find.sequence = where.sequence
        update.$inc || (update.$inc = {})
        update.$inc['sequence'] = 1
      }

      if (update.$set && _.isArray(update.$set['meta.up'])) {
        update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.documentSize))
        if (subject.constructor.dataset && subject.constructor.dataset.targetCollection) {
          update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.migrate))
        }
      } else {
        let metaUp = (update.$addToSet || (update.$addToSet = {}))['meta.up'] || (update.$addToSet['meta.up'] = { $each: [] })
        if (_.isNumber(metaUp)) {
          metaUp = (update.$addToSet['meta.up'] = { $each: [] })
        }
        metaUp.$each.push(consts.metadata.updateBits.documentSize)
        if (subject.constructor.dataset && subject.constructor.dataset.targetCollection) {
          metaUp.$each.push(consts.metadata.updateBits.migrate)
        }
      }

      try {
        this._guardArrayUpdates(subject, update.$set, subject.schema.node.root)
      } catch (err) {
        return callback(err)
      }

      if (dryRun) {
        onUpdated(null)
      } else {
        subject.constructor.collection.updateOne(find, update, { writeConcern: { w: 'majority' } }, (err, result) => {
          err = this._detectIndexError(err, subject, indexing, result)
          if (!err && sequencing && result.matchedCount === 0) {
            err = Fault.create('cortex.conflict.sequencing', { resource: this.getResource(), reason: 'Sequencing Error (llu)' })
          }
          onUpdated(err)
        })
      }
    }
  }
}

AccessContext.prototype._guardArrayUpdates = function(subject, $set) {

  const start = utils.profile.start()

  if ($set) {
    for (const setKey in $set) {
      if ($set.hasOwnProperty(setKey)) {

        // disallow setting of document arrays, but allow array sets.
        // a multi node might have several branches with common properties. discern the correct branch.
        const path = _.filter(setKey.split('.'), function(v) { return !utils.isInteger(v) && v !== '$' }).join('.'),
              node = subject.discernNode(setKey)

        if (!node) {
          throw Fault.create('cortex.notFound.unspecified', { resource: this.getResource(), reason: 'Array overwrite guard could not find a corresponding node for path: ' + path, path: path })
        } else if (node.array && !this.isSafeToUpdate(node)) {
          // is the node completely selected? then we are okay!
          if (!subject.isSelected(node.fullpath)) {
            throw Fault.create('cortex.unsupportedOperation.unspecified', {
              resource: this.getResource(),
              reason: 'Array overwrite guard detected illegal set on ' + node.fullpath,
              path: node.fullpath
            })
          }
        }
      }
    }
  }

  utils.profile.end(start, 'ac._guardArrayUpdates')

}

/**
 * updates properties in a copy of the subject in a sideband operation, updating the local subject with modified paths (sans setters and modifications)
 * this is pretty dangerous, since we skip setters and could create synchronization issues. this was created to mitigate write-through update issues where
 * simultaneous operations on children are causing the parent chain to sequence only because of updateOnWriteThrough.
 *
 * HERE BE DRAGONS!
 *
 * Does not use writers!
 *
 * sets a $readableModified property on the access context subject parent saves use to bubble up modifications
 *
 * @param payload
 * @param options
 * @param callback
 */
AccessContext.prototype.sidebandUpdate = function(payload, options, callback) {

  if (!utils.isPlainObjectWithSubstance(payload)) {
    return callback()
  }
  if (!this.subject) {
    return callback()
  }

  // can't do this for new objects (for which sequencing is not really an issue anyway).
  if (this.subject.isNew) {
    this.subject.set(payload)
    return callback()
  }

  const flattened = utils.flattenObjectPaths(payload),
        selections = this.object.schema.node.selectPaths(this.principal, { paths: Object.keys(flattened) })

  modules.db.sequencedFunction(

    callback => {

      this.object.findOne({ _id: this.subjectId, org: this.orgId, object: this.objectName }).select(selections).lean().exec((err, doc) => {

        let targetSubject = null
        if (!err) {
          try {
            targetSubject = new (this.object)(undefined, selections, true)
            targetSubject.init(doc, null, null, true)
          } catch (e) {
            err = e
          }
        }
        if (err) {
          return callback(err)
        }

        targetSubject.set(payload)

        const modified = targetSubject.modifiedPaths(),
              readableModified = targetSubject.readableModifiedPaths()

        if (readableModified && readableModified.length) {
          const mod = this.option('$readableModified') || []
          mod.push(...readableModified)
          this.option('$readableModified', mod)
        }
        this.lowLevelUpdate({ subject: targetSubject }, err => {
          if (!err) {
            modified.push('sequence')
            modified.forEach(path => {
              this.subject.setValue(path, targetSubject.getValue(path))
            })
          }
          callback(err, modified)
        })

      })

    },
    10,
    callback
  )

}

acl.AccessContext = AccessContext

// -----------------------------------------------------------------------------------------------------------

/**
 * Access context for posts. the subject is a post object. the object, if set, must be a post model.
 *
 * @param principal
 * @param post
 * @param options
 * @constructor
 */
function PostAccessContext(principal, post, options) {
  AccessContext.call(this, principal, post, options)
}
util.inherits(PostAccessContext, AccessContext)

// extensions ------------------------------------

Object.defineProperties(PostAccessContext.prototype, {
  document: {
    get: function() {
      return this.$__comment || this.$__subject
    }
  },
  model: {
    get: function() {
      return this.$__object || (this.$__subject ? this.$__subject.constructor : null)
    }
  },
  post: {
    get: function() {
      return this.$__subject
    }
  },
  posterId: {
    get: function() {
      return utils.getIdOrNull(utils.path(this.$__subject, 'creator._id'), true)
    }
  },
  isPostCreator: {
    get: function() {
      return this.$__subject ? this.$__subject.isPostCreator(this.$__principal) : false
    }
  },
  postId: {
    get: function() {
      return this.$__subject ? this.$__subject._id : null
    }
  },
  postType: {
    get: function() {
      return utils.path(this.model, 'postType')
    }
  },
  postTypeId: {
    get: function() {
      return utils.path(this.model, 'postTypeId')
    }
  },
  // @todo. revamp. this is a bit weird. setting wants a post model, but getting gets the context's object
  object: {
    get: function() {
      return utils.path(this.model, 'parentObject')
    },
    set: function(object) {
      if (object == null || acl.isPostModel(object)) {
        this.$__object = object
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'PostAccessContext.object must be a post model' })
      }
    }
  },
  ownerId: {
    get: function() {
      return this.hasOwner ? utils.path(this.$__subject, 'ctx.owner') : null
    }
  },
  creatorId: {
    get: function() {
      return this.hasCreator ? utils.path(this.$__subject, 'ctx.creator') : null
    }
  },
  subjectId: {
    get: function() {
      return utils.getIdOrNull(utils.path(this.post, 'context._id'), true)
    }
  },
  subject: {
    get: function() {
      return this.comment || this.post
    },
    set: function(subject) {
      if (subject == null || acl.isPostSubject(subject)) {
        this.$__access = null
        this.$__subject = subject
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'PostAccessContext.subject' })
      }
    }
  },
  comment: {
    get: function() {
      return this.$__comment
    },
    set: function(comment) {
      if (comment == null || acl.isPostComment(comment)) {
        this.$__access = null
        this.$__comment = comment
      } else {
        throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'PostAccessContext.comment' })
      }
    }
  },
  isOwner: {
    get: function() {
      return utils.equalIds(this.ownerId, this.principalId)
    }
  },
  isCreator: {
    get: function() {
      return utils.equalIds(this.creatorId, this.principalId)
    }
  }
})

// overrides ------------------------------------

PostAccessContext.prototype.toObject = function(options, callback) {

  if (_.isFunction(options)) {
    callback = options
    options = {}
  } else {
    options = options || {}
  }

  AccessContext.prototype.toObject.call(this, options, (err, object) => {

    if (err) {
      return callback(err)
    }

    object.subject = {
      _id: this.comment ? this.comment._id : this.postId,
      object: this.comment ? 'comment' : 'post',
      postType: this.postType
    }

    if (this.comment) {

      object.subject.context = {
        _id: this.postId,
        object: 'post',
        context: {
          _id: this.subjectId,
          object: this.objectName
        }
      }

    } else {
      object.subject.context = {
        _id: this.subjectId,
        object: this.objectName
      }
    }

    callback(null, object)

  })

}

PostAccessContext.prototype.sidebandUpdate = function(payload, callback) {

  // unsupported
  if (utils.isPlainObjectWithSubstance(payload) && this.subject) {
    this.subject.set(payload)
  }
  return callback()

}

PostAccessContext.prototype.copy = function(post, options, copyOptions = false, breakWithParent = false, copyEq = false) {

  let pac,
      opts = utils.extend({ override: this.$__override, grant: this.$__grant, object: this.$__object, scoped: this.$__scoped, locale: this.$__locale, req: this.req, script: this.script, method: this.method }, options)
  if (copyOptions) {
    opts.options = this._copyOptions()
  }
  pac = new PostAccessContext(this.$__principal, post, opts)
  pac.comment = this.comment
  pac.$__parentAc = breakWithParent ? null : this
  pac.$__singlePath = this.$__singlePath
  pac.$__singleCursor = this.$__singleCursor
  pac.$__propPath = this.$__propPath
  pac.$__readThroughPath = this.$__readThroughPath
  if (copyEq && this.$__eq) {
    pac.$__eq = this.$__eq
  }
  return pac
}
PostAccessContext.prototype.resolve = function(force, customAcl) {
  if (!this.$__access || force) {
    if (this.$__principal) {
      if (customAcl) {
        this.$__access = this.resolveAccess({ acl: customAcl })
      } else if (this.comment) {
        this.$__access = new AclAccess(utils.equalIds(this.comment.creator._id, this.principalId) ? acl.AccessLevels.Delete : acl.AccessLevels.Read)
      } else {
        this.$__access = this.resolveAccess({ acl: utils.path(this.model, 'postInstanceAcl') })
        this.$__access.merge(acl.AccessLevels.Read)
        if (this.post && utils.equalIds(this.post.creator._id, this.principalId)) {
          this.$__access.merge(acl.AccessLevels.Delete)
        }
      }
    } else {
      this.$__access = new AclAccess()
    }
  }
  return this.$__access.resolved
}
PostAccessContext.prototype.canCreate = function(ac) {
  const model = this.model
  if (this.$__principal && model) {
    // first, resolve access to the subject's feed write access.
    if (ac.hasAccess(model.contextCreateAccess)) {
      // if there is a postCreateAcl, further ensure access is granted.
      if (model.postCreateAcl.length === 0) {
        return true
      }
      const access = this.resolveAccess({ acl: model.postCreateAcl })
      return access.hasAccess(model.contextCreateAccess)
    }
  }
  return false
}

PostAccessContext.prototype.documentPathForAclKey = function(key) {
  switch (key) {
    case '_id': return 'context._id'
    case 'acl': return 'ctx.acl'
    case 'aclv': return 'ctx.aclv'
    case 'owner': return (this.object && this.object.hasOwner) ? 'ctx.owner' : null
    case 'creator': return (this.object && this.object.hasCreator) ? 'ctx.creator' : null
  }
  return null
}

/**
 * depending on the method, a save operation can 'put'/'post': create or update, 'delete': delete a context.
 *
 * @param options
 * changedPaths
 * skipValidation
 *
 * @param callback err, modified
 *
 */
PostAccessContext.prototype.save = function(options, callback) {

  if (_.isFunction(options)) {
    callback = options
    options = {}
  } else {
    options = options || {}
  }

  const comment = this.comment

  if (!this.principal || !this.org || !this.post || !this.post.schema || !this.post.schema.node.root) {
    callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'missing principal, org, model and/or post' }))
    return
  }

  if (comment && !acl.isPostComment(comment)) {
    callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'missing comment' }))
    return
  }

  let target = comment || this.post,
      targetName = comment ? 'comment' : 'post',
      targetModel = target.constructor,
      isDelete = this.method === 'delete'

  target.increment() // always increment

  // if the target is being deleted, don't allow any initial modifications?
  if (isDelete) {
    if (target.isNew) {
      callback(Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'delete unsaved post/comment' }))
      return
    }
    if (target.isModified()) {
      callback(Fault.create('cortex.unsupportedOperation.unspecified', { reason: 'delete modified post/comment' }))
      return
    }
  }

  if (!isDelete && !target.isModified()) {

    callback(null, this.option('$readableModified') || [])

  } else {

    let self = this,
        isNew = target.isNew,
        tasks

    if (isDelete) {

      // clear indexes.
      target.idx = { v: utils.path(target, 'idx.v') || 0 }

      tasks = [
        function(callback) {
          self.object.fireHook(targetName + '.delete.before', null, { ac: self }, callback)
        }
      ]

      if (_.isFunction(self.option('$preDelete'))) {
        tasks.push(function(callback) {
          self.option('$preDelete')(self, function(err) {
            callback(err)
          })
        })
      }

      tasks.push(function(callback) {
        modules.sandbox.triggerScript(targetName + '.delete.before', self.script, self, null, {/* comment: comment - must be a json object!!! */}, function(err) {
          callback(err)
        })
      })

    } else {

      if (isNew) {
        targetModel.schema.node.walk(function(property) {
          property._checkShouldReIndex(self, target)
        })
      }

      tasks = [
        function(callback) {
          modules.sandbox.triggerScript(isNew ? targetName + '.create.before' : targetName + '.update.before', self.script, self, { attachedSubject: target, changedPaths: options.changedPaths, isNew: isNew }, {}, function(err) {
            callback(err)
          })
        },
        function(callback) {
          self.object.fireHook(isNew ? targetName + '.create.before' : targetName + '.update.before', null, { ac: self, comment: comment }, callback)
        },
        function(callback) {
          self.object.fireHook(targetName + '.validate.before', null, { ac: self, comment: comment }, callback)
        },
        function(callback) {
          self.apiHooks.fire(target, 'validate.before', null, { ac: self }, callback)
        },
        function(callback) {
          if (options.skipValidation) {
            self.object.fireHook(targetName + '.validate.after', null, { ac: self, comment: comment }, callback)
          } else {
            target.validateWithAc(self, function(err) {
              self.object.fireHook(targetName + '.validate.after', Fault.from(err), { ac: self, comment: comment }, callback)
            })
          }
        },
        function(callback) {
          self.object.fireHook(targetName + '.save.before', null, { ac: self, comment: comment }, callback)
        },
        function(callback) {
          self.apiHooks.fire(target, 'save.before', null, { ac: self }, callback)
        },
        function(callback) {
          let err
          try {
            self.rebuildSubjectIndex()
          } catch (e) {
            err = e
          }
          callback(err)
        }
      ]

    }

    // do the insert/update/delete
    tasks.push(function(callback) {

      if (!isNew) {
        target.updated = new Date()
        if (!target.updater || !utils.equalIds(target.updater._id, self.principalId)) {
          target.updater = { _id: self.principalId }
        }
      }

      let delta,
          update,
          find,
          where,
          sequencing,
          modifiedPaths = target.modifiedPaths(), readableModified = target.readableModifiedPaths(modifiedPaths)

      // --------------------------

      if (!isNew && !comment && (self.post.isModified('ctx.acl', modifiedPaths) || self.post.isModified('ctx.aclv', modifiedPaths))) {
        callback(Fault.create('cortex.unsupportedOperation.directAclWrite'))
        return
      }

      if (!isDelete && isNew) {

        let insert = target.toObject({ depopulate: 1 })

        // allow low-level query access to internal property updaters for special cases like favorites array updates.
        self.apiHooks.fire(target, 'query.insert.before', null, { ac: self, insert: insert, modified: modifiedPaths }, function(err) {
          if (err) {
            callback(err)
          } else {
            const sz = bson.calculateObjectSize(insert)
            utils.path(insert, 'meta.sz', sz)
            target.$__reset()
            target.isNew = false
            target.emit('isNew', false)
            target.collection.insertOne(insert, { writeConcern: { w: 'majority' } }, function(err) {
              err = self._detectIndexError(err, target)
              if (!err) {
                const { Stat } = modules.db.models
                Stat.addRemoveDocuments(insert.org, Stat.getDocumentSource(insert), insert.object, insert.type, 1, sz)
              }
              callback(err, modifiedPaths, readableModified)
            })
          }
        })
        return
      }

      // --------------------------

      if (isDelete) {
        target.reap = true
        target.increment() // to ensure cache miss
      }

      if (target.isModified('body', modifiedPaths)) {
        target.views = [self.principalId]
        self.markSafeToUpdate(target.schema.node.properties.views)
      }

      delta = target.$__delta()
      if (delta instanceof Error) {
        callback(delta)
        return
      }

      if (!delta) {
        target.$__reset()
        callback(null, null)
        return
      }

      // note: for now, we are using mongoose's sequencing for modified arrays with the 'sequence' versionKey
      update = delta[1] || {}
      find = { _id: target._id }
      where = delta[0]
      sequencing = where && where.sequence !== undefined

      if (sequencing) {
        find.sequence = where.sequence
        update.$inc || (update.$inc = {})
        update.$inc['sequence'] = 1
      }

      if (update.$set && _.isArray(update.$set['meta.up'])) {
        update.$set['meta.up'] = _.uniq(update.$set['meta.up'].concat(consts.metadata.updateBits.documentSize))
      } else {
        let metaUp = (update.$addToSet || (update.$addToSet = {}))['meta.up'] || (update.$addToSet['meta.up'] = { $each: [] })
        if (_.isNumber(metaUp)) {
          metaUp = (update.$addToSet['meta.up'] = { $each: [] })
        }
        metaUp.$each.push(consts.metadata.updateBits.documentSize)
      }

      try {
        self._guardArrayUpdates(target, update.$set, target.schema.node.root)
      } catch (err) {
        return callback(err)
      }

      // allow low-level query access to internal property updaters for special cases like favorites array updates.
      self.apiHooks.fire(target, 'query.update.before', null, { ac: self, find: find, update: update, modified: modifiedPaths }, function(err) {
        if (err) {
          callback(err)
        } else {
          var indexing = !isDelete && self._sequenceIndexes(target, find, update, modifiedPaths)
          targetModel.collection.updateOne(find, update, { writeConcern: { w: 'majority' } }, function(err, result) {
            err = self._detectIndexError(err, target, indexing, result)
            if (!err && sequencing && result.matchedCount === 0) {
              err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (ps)' })
            }
            if (!err && sequencing) {
              target.setValue('sequence', (target.getValue('sequence') || 0) + 1)
            }
            if (!err && indexing) {
              target.setValue('idx.v', (target.getValue('idx.v') || 0) + 1)
            }
            if (!err) {
              target.$__reset()
              if (self.$__safe) {
                self.$__safe.clear()
              }
            }

            // push the post updated date.
            if (comment) {
              self.post.setValue('updated', comment.updated)
              self.post.setValue('updater', comment.updater)
              self.model.collection.updateOne({ _id: self.postId, updated: { $lt: comment.updated } }, { $set: { updated: comment.updated, updater: comment.updater.toObject() } }, { writeConcern: { w: 'majority' } }, function(err) {
                if (err) logger.error('updating post date failed.', utils.toJSON(err, { stack: true }))
              })
            }
            callback(err, modifiedPaths, readableModified)
          })
        }
      })

    })

    async.waterfall(tasks, function(err, modifiedPaths, readableModified) {

      // operation cancelled. fail silently without firing hooks.
      if (err === true) {
        callback(null, [...target.readableModifiedPaths(), ...(self.option('$readableModified') || [])].sort())
        return
      }

      readableModified = [...(readableModified || []), ...(self.option('$readableModified') || [])].sort()

      err = Fault.from(err)

      if (!err && isDelete) {
        modules.workers.runNow('instance-reaper')
      }

      // call any internal hooks, which expire after save. also, after save hooks cannot interrupt program flow.
      var apiHooks = self.apiHooks
      self.$__hooks = null
      apiHooks.fire(target, isDelete ? 'delete.after' : 'save.after', err, { ac: self, modified: modifiedPaths }, function() {

        async.waterfall([
          function(callback) {
            if (isDelete || isNew || modifiedPaths) {
              // post hooks, even if inline, should not interrupt program flow. errors generated by these hooks are ignored.
              self.object.fireHook(isDelete ? targetName + '.delete.after' : (isNew ? targetName + '.create.after' : targetName + '.update.after'), err, { ac: self, comment: comment, modified: modifiedPaths }, function() {

                if (err) {
                  return callback(err)
                }
                modules.sandbox.triggerScript(isDelete ? targetName + '.delete.after' : (isNew ? targetName + '.create.after' : targetName + '.update.after'), self.script, self, { attachedSubject: target, changedPaths: options.changedPaths, isNew: isNew }, { modified: readableModified }, function(err, results) {
                  void err
                  let inlineResultWithError = results && results.executions.find(v => v.inline && v.err)
                  callback(inlineResultWithError && inlineResultWithError.err, readableModified)
                })

              })
            } else {
              callback(err, readableModified)
            }
          },
          function(modified, callback) {
            if (!isDelete && self.model.notifications && modified) {
              modules.db.models.Post.notifyPostTargets(self, comment)
            }
            callback(null, readableModified)
          }

        ], callback)
      })

    })

  }
}

acl.PostAccessContext = PostAccessContext

// -----------------------------------------------------------------------------------------------------------

/**
 * recursively expands a role holders roles into the full list of roles, based on an org's included roles.
 * @param orgRoles
 * @param holderRoles
 * @param inlinedRoles: Object
 */
acl.expandRoles = function(orgRoles, holderRoles, inlinedRoles) {
  if (inlinedRoles) {
    return holderRoles.filter(v => !!inlinedRoles[v.toString()])
  }

  orgRoles = _.isArray(orgRoles) ? orgRoles : []

  function add(role, arr) {
    if (!utils.inIdArray(arr, role)) {
      arr.push(role)
      return true
    }
    return false
  }

  function expand(roles, expanded) {
    roles.forEach(function(role) {
      orgRoles.forEach(function(orgRole) {
        if (orgRole) {
          if (utils.equalIds(role, orgRole._id)) {
            if (add(orgRole._id, expanded)) {
              var include = utils.getIdArray(orgRole.include)
              if (include.length > 0) {
                expand(include, expanded)
              }
            }
          }
        }
      })
    })
    return expanded
  }

  var expanded = []
  return expand(utils.getIdArray(holderRoles), expanded)

}

acl.isAccessSubject = function(subject, including) {
  if (subject) {
    if (subject.isAccessSubject) {
      if (subject.$model) {
        return subject.isAccessSubject(including)
      }
      return modules.db.isModelInstance(subject) && (subject.constructor.__ObjectSchema__)
    }
  }
  return false
}

acl.isPostSubject = function(subject, including) {
  return modules.db.isModelInstance(subject) && (subject.constructor.__PostSchema__) && subject.isPostSubject(including)
}

acl.isPostComment = function(subject, including) {
  return modules.db.isModelInstance(subject) && (subject.constructor.__CommentSchema__) && subject.isCommentSubject(including)
}

acl.isAnySubject = function(subject, including) {
  if (subject && modules.db.isModelInstance(subject)) {
    switch (true) {
      case subject.constructor.__ObjectSchema__:
        return subject.isAccessSubject(including)
      case subject.constructor.__PostSchema__:
        return subject.isPostSubject(including)
      case subject.constructor.__CommentSchema__:
        return subject.isCommentSubject(including)
    }
  }
  return false
}

acl.isObjectModel = function(object) {
  return (object && object.__ObjectSchema__)
}

acl.isPostModel = function(model) {
  return (model && model.__PostSchema__)
}

acl.fixAllowLevel = function(accessLevel, includeNone, defaultValue) {
  const lowerBound = includeNone ? acl.AccessLevels.None : acl.AccessLevels.Min
  defaultValue = (defaultValue !== undefined) ? fixLevel(defaultValue, lowerBound, acl.AccessLevels.Max, lowerBound) : lowerBound
  return fixLevel(accessLevel, lowerBound, acl.AccessLevels.Max, defaultValue)
}

acl.mergeAccess = function(access, allow) {
  access = access || {}
  access.allow = Math.max(acl.fixAllowLevel(access.allow, true), acl.fixAllowLevel(allow, true))
  return access
}

acl.isBuiltInPrincipal = function(principal) {
  return acl.isBuiltInAccount(principal) || acl.isBuiltInRole(principal)
}

acl.isBuiltInAccount = function(principal) {
  return utils.equalIds(principal, acl.AnonymousIdentifier) || utils.equalIds(principal, acl.PublicIdentifier)
}

acl.isBuiltInRole = function(principal) {
  return !!(principal && (consts.defaultRoles[principal] || consts.defaultRoles[principal._id]))
}

acl.requiredPaths = ['_id', 'org', 'object', 'acl', 'aclv', 'sequence', 'reap', 'meta', 'facets', 'idx']

acl.mergeAndSanitizeEntries = function(...aclArrays) {

  const outputEntries = []

  aclArrays.forEach(function(arr) {
    if (Array.isArray(arr)) {
      arr.forEach(function(currEntry) {
        if (currEntry && currEntry.type) {

          // only merge when access levels are in play with id-based targets. skip over access based.
          const targetId = utils.getIdOrNull(currEntry.target),
                targetLevel = utils.isInt(currEntry.target) ? currEntry.target : null

          let matchingEntry = null

          for (let i = 0, j = outputEntries.length; i < j; i++) {
            let outputEntry = outputEntries[i]
            if (outputEntry.type === currEntry.type) {
              if (targetLevel === outputEntry.target || utils.equalIds(targetId, outputEntry.target)) {
                if ((utils.isInt(outputEntry.allow) && utils.isInt(currEntry.allow)) || utils.equalIds(outputEntry.allow, currEntry.allow)) {
                  matchingEntry = outputEntry
                  break
                }
              }
            }
          }
          if (matchingEntry) {
            if (utils.isInt(currEntry.allow)) {
              acl.mergeAccess(matchingEntry, currEntry.allow)
            }
          } else {
            let entry = {
              type: currEntry.type
            }
            if (targetId !== null || targetLevel !== null) {
              entry.target = targetId || targetLevel
            }
            if (utils.isInt(currEntry.allow)) {
              let allow = acl.fixAllowLevel(currEntry.allow, true)
              if (allow > acl.AccessLevels.None) {
                entry.allow = allow
              }
            } else if (utils.couldBeId(currEntry.allow)) {
              let allow = utils.getIdOrNull(currEntry.allow)
              if (allow) {
                entry.allow = allow
              }
            }
            if (entry.allow !== undefined && entry.allow !== acl.AccessLevels.None) {
              outputEntries.push(entry)
            }
          }

        }
      })
    }
  })

  // tidy entries that have no access.
  for (let i = outputEntries.length - 1; i >= 0; i--) {
    let entry = outputEntries[i]
    if (!entry.allow || entry.allow === acl.AccessLevels.None) {
      outputEntries.splice(i, 1)
    }
  }

  return outputEntries

}

function fixLevel(level, lowerBound, upperBound, defaultValue) {
  if (_.isString(level)) {
    const value = acl.AccessLevelsLowerCase[level]
    if (utils.isSet(value)) {
      level = value
    }
  }
  if (_.isFinite(level)) {
    return Math.min(upperBound, Math.max(lowerBound, level))
  }
  return defaultValue
}

// ---------------------------------------------------------------------------------------------------------------------
// acl updating and locking. @todo this suffers from inconsistency. refactor

AclOperation.defaultFilter = function(currentAllow, newAllow) {
  return newAllow
}

/**
 *
 *
 * @param callingPrincipal
 * @param newOwnerPrincipal
 * @param callback (err)
 */
AclOperation.setOwner = function(callingPrincipal, newOwnerPrincipal, object, subjectId, callback) {

  if (!local.ap.is(callingPrincipal) ||
        !local.ap.is(newOwnerPrincipal) ||
        !acl.isObjectModel(object) ||
        !utils.equalIds(callingPrincipal.orgId, newOwnerPrincipal.orgId)) {

    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'acl.setOwner operation requires valid principal, object and subject arguments.' }))

  }

  if (!object.hasOwner) {
    return callback(Fault.create('cortex.unsupportedOperation.setOwnerRequiresOwner', { reason: 'acl.setOwner operation cannot set ownership of contexts without an owner.' }))
  }

  modules.db.sequencedFunction(
    callback => {

      object.findOne({ _id: subjectId, org: callingPrincipal.orgId, object: object.objectName }).select(object.requiredAclPaths.join(' ')).exec(function(err, subject) {

        if (err) {
          return callback(err)
        } else if (!subject) {
          return Fault.create('cortex.notFound.unspecified')
        } else if (utils.equalIds(newOwnerPrincipal._id, subject.owner)) {
          return callback()
        }

        const find = { _id: subject._id, aclv: subject.aclv, sequence: subject.sequence },
              update = { $set: { owner: { _id: newOwnerPrincipal._id } }, $inc: { aclv: 1, sequence: 1 } }

        object.collection.updateOne(find, update, { writeConcern: { w: 'majority' } }, function(err, result) {
          if (!err && result.matchedCount === 0) {
            err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (so)' })
          }
          if (!err) {
            subject.setValue('owner._id', newOwnerPrincipal._id)
            subject.setValue('aclv', utils.rInt(subject.aclv, 0) + 1)
            modules.db.models.Post.syncAcl(new acl.AccessContext(callingPrincipal, subject))
          }
          callback(err)
        })

      })

    },
    10,
    callback
  )

}

/**
 * @param principal the affected principal.
 * @param subject
 * @param toAllowLevel if null, no change is made
 * @param instanceRoles if null, no change is made
 * @param {(object|function)=} options
 *  {
 *      filter: function(currentAllow, newAllow, callback(allow))
 *      forceAcl: null. an initial acl array to use. supercedes and replaces the one loaded from the lock. must be an array.
 *  }
 * @param {function=} callback -> err, updated, old, new
 */
AclOperation.setAccessLevel = function(principal, subject, toAllowLevel, instanceRoles, options, callback) {

  if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

  if (!local.ap.is(principal) ||
        !acl.isAccessSubject(subject)) {

    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'acl.setAccessLevel operation requires valid principal and subject arguments.' }))
  }

  let currentAllow, newAllow, currentRoles = [], newRoles = [], dryRun = options.dryRun

  modules.db.sequencedFunction(
    callback => {

      const object = subject.constructor

      object.findOne({ _id: subject._id, org: principal.orgId, object: object.objectName }).select(object.requiredAclPaths.join(' ')).exec(function(err, subject) {

        if (err) {
          return callback(err)
        } else if (!subject) {
          return Fault.create('cortex.notFound.instance')
        }

        const rawSubject = subject.toObject(),
              filter = utils.option(options, 'filter', AclOperation.defaultFilter, function(filter) { return _.isFunction(filter) }),
              aclEntries = utils.option(
                options,
                'forceAcl',
                rawSubject.acl,
                aclEntries => _.isArray(aclEntries),
                aclEntries => aclEntries
              )

        // lookup the principal's entries. principals may have multiple role entries but only a single access level entry.
        let find,
            update,
            currentEntries = []

        for (let i = aclEntries.length - 1; i >= 0; i--) {
          if (utils.equalIds(aclEntries[i].target, principal._id)) {
            currentEntries.push(aclEntries.splice(i, 1)[0])
          }
        }

        currentAllow = acl.fixAllowLevel(currentEntries.reduce((allow, entry) => {
          if (utils.isInt(entry.allow)) {
            allow = Math.max(allow, entry.allow)
          }
          return allow
        }, acl.AccessLevels.None), true)

        newAllow = toAllowLevel = acl.fixAllowLevel(filter(currentAllow, toAllowLevel === null ? currentAllow : toAllowLevel), true)

        currentRoles = currentEntries.reduce((roles, entry) => {
          if (utils.isId(entry.allow)) {
            roles.push(entry.allow)
          }
          return roles
        }, [])

        newRoles = instanceRoles.filter(role => {
          return !!principal.org.roles.find(r => utils.equalIds(r._id, role))
        })

        if (toAllowLevel === currentAllow && currentRoles.length === newRoles.length && utils.intersectIdArrays(currentRoles, newRoles).length === currentRoles.length) {
          return callback(null, false)
        }

        // an instance must have an access entry as well as a role entry.
        if (toAllowLevel !== acl.AccessLevels.None) {
          aclEntries.push({
            target: principal._id,
            type: principal.targetType,
            allow: toAllowLevel
          })
        }
        if (newRoles.length > 0) {
          newRoles.forEach(role => {
            aclEntries.push({
              target: principal._id,
              type: principal.targetType,
              allow: role
            })
          })
        }

        find = {
          _id: subject._id,
          aclv: subject.aclv,
          sequence: subject.sequence
        }
        update = {
          $set: {
            acl: aclEntries
          },
          $inc: {
            aclv: 1,
            sequence: 1
          }
        }

        update.$addToSet = { 'meta.up': consts.metadata.updateBits.documentSize }

        if (dryRun) {
          return callback(null, true)
        }

        object.collection.updateOne(find, update, { writeConcern: { w: 'majority' } }, function(err, result) {
          if (!err && result.matchedCount === 0) {
            err = Fault.create('cortex.conflict.sequencing', { reason: 'Sequencing Error (sac)' })
          }
          if (!err) {
            subject.setValue('aclv', utils.rInt(subject.aclv, 0) + 1)
            subject.setValue('sequence', utils.rInt(subject.sequence, 0) + 1)
            subject.setValue('acl', aclEntries)
            modules.db.models.Post.syncAcl(new acl.AccessContext(principal, subject))
          }
          callback(err, true)
        })

      })

    },
    10,
    (err, updated) => {
      callback(err, updated, currentAllow, newAllow, currentRoles, newRoles)
    }
  )

}

/**
 *
 * @param principal
 * @param subject
 * @param toAllowLevel
 * @param options
 * @param callback -> err, updated, old, new
 */
AclOperation.increaseAccessLevel = function(principal, subject, toAllowLevel, options, callback) {
  if (_.isFunction(options)) { callback = options; options = {} } else options = options || {}
  options.filter = (currentAllow, newAllow) => Math.max(currentAllow, newAllow)
  AclOperation.setAccessLevel(principal, subject, toAllowLevel, null, options, callback)
}

/**
 *
 * @param principal
 * @param subject
 * @param toAllowLevel
 * @param options
 * @param callback -> err, updated, old, new
 */
AclOperation.decreaseAccessLevel = function(principal, subject, toAllowLevel, options, callback) {
  if (_.isFunction(options)) { callback = options; options = {} } else options = options || {}
  options.filter = (currentAllow, newAllow) => Math.min(currentAllow, newAllow)
  AclOperation.setAccessLevel(principal, subject, toAllowLevel, null, options, callback)
}

/**
 *
 * @param principal
 * @param subject
 * @param options
 * @param callback -> err, updated, old, new
 */
AclOperation.removeAccess = function(principal, subject, options, callback) {
  if (_.isFunction(options)) { callback = options; options = {} } else options = options || {}
  AclOperation.setAccessLevel(principal, subject, acl.AccessLevels.None, [], options, callback)
}

/**
 * remove all acl entries for a target. banks on the assumption a single target won't have too many acl entries.
 * in addition, the subject may or may not exist.
 *
 * @param {AccessPrincipal|object} principal
 * @param callback
 */
AclOperation.removeAllTargetEntries = function(principal, callback) {

  async.eachSeries(principal.org.objects, function(entry, callback) {
    principal.org.createObject(entry.lookup, function(err, object) {
      if (err) {
        logger.error('removeAllTargetEntries', Object.assign(utils.toJSON(err, { stack: true }), { objectId: entry.lookup, principal: principal._id }))
        callback()
      } else {

        const masterNode = object.schema.node.typeMasterNode || object.schema.node,
              findTypes = masterNode.typed ? [...masterNode.typeNames, null] : [null],
              find = {
                org: principal.orgId,
                object: object.objectName,
                type: findTypes.length === 1 ? findTypes[0] : { $in: findTypes },
                'acl.target': principal._id
              }

        object.find(find).select(object.schema.node.requiredAclPaths.join(' ')).exec(function(err, subjects) {
          if (err) {
            logger.error('removeAllTargetEntries', Object.assign(utils.toJSON(err, { stack: true }), { objectName: object.objectName, principal: principal._id }))
            callback()
          } else {
            async.eachSeries(subjects, function(subject, callback) {
              AclOperation.removeAccess(principal, subject, function(err) {
                if (err) {
                  logger.error('removeAllTargetEntries', Object.assign(utils.toJSON(err, { stack: true }), { objectName: object.objectName, principal: principal._id, subject: subject._id }))
                }
                callback()
              })
            }, callback)
          }
        })
      }
    })
  })

}
