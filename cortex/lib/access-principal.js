'use strict'

let _synPaths

const {
        inIdArray, equalIds, findIdInArray, ensureCallback, path: pathTo,
        array: toArray, isInt, getIdOrNull, createId, rString, couldBeId,
        option: getOption, isPlainObject, isIdFormat, isId, resolveOptionsCallback
      } = require('./utils'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('./modules'),
      acl = require('./acl'),
      async = require('async'),
      clone = require('clone'),
      _ = require('underscore'),
      synPaths = () => {
        if (!_synPaths) {
          _synPaths = modules.db.models.account.requiredAclPaths.reduce((selected, path) => {
            selected[path] = 1
            return selected
          }, {})
        }
        return _synPaths
      }

// -----------------------------------------------------------

module.exports = class AccessPrincipal {

  constructor(org, contextData) {

    this._org = org
    this._contextData = contextData || {}

    // transform to primitives for some queries. @hack @todo all incoming context data should be based on primitives (or the backing doc).
    // issue #320 will cure this.
    if (_.isFunction(this.name.toObject)) {
      this._name = JSON.parse(JSON.stringify(this.name.toObject()))
    }

    this._grant = acl.AccessLevels.None

    this._resolved_scope = null

  }

  hasRole(roleId) {
    return inIdArray(this.roles, roleId)
  }

  isAnonymous() {
    return equalIds(this._id, acl.AnonymousIdentifier)
  }

  isPublic() {
    return equalIds(this._id, acl.PublicIdentifier)
  }

  isAuthenticated() {
    return !(equalIds(this._id, acl.AnonymousIdentifier) || equalIds(this._id, acl.PublicIdentifier))
  }

  isOrgAdmin() {
    return this.hasRole(acl.OrgAdminRole)
  }

  isDeveloper() {
    return this.hasRole(acl.OrgDeveloperRole)
  }

  isSupport() {
    return this.hasRole(acl.OrgSupportRole)
  }

  isProvider() {
    return this.hasRole(acl.OrgProviderRole)
  }

  isSysAdmin() {
    return this.isOrgAdmin() && equalIds(acl.BaseOrg, this.org)
  }

  isAccount() {
    return !this.isServiceAccount() && !this.isRole()
  }

  isServiceAccount() {
    return this._contextData.service === true
  }

  isRole() {
    return this._contextData.role === true
  }

  get uniqueKey() {
    if (this.isRole()) {
      return `role.${this.name}`
    }
    if (this.isServiceAccount()) {
      return `serviceAccount.${this.name}`
    }
    return `account.${this.email}`
  }

  toObject() {
    const object = {
      _id: this._id,
      type: acl.AccessTargets.Account,
      object: this._contextData.object,
      org: this.orgId,
      roles: this.roles.slice(),
      roleCodes: this.roleCodes.slice(),
      locked: this.locked,
      state: this.state,
      email: this.email,
      username: this.username,
      name: this.name,
      tz: this.tz
    }
    if (this.isServiceAccount()) {
      object.service = true
    }
    if (this.isRole()) {
      object.role = true
    }
    if (this.skipAcl) {
      object.skipAcl = true
    }
    if (this.grant > acl.AccessLevels.None) {
      object.grant = this.grant
    }
    if (this.bypassCreateAcl) {
      object.bypassCreateAcl = true
    }
    if (this._scope) {
      object.scope = clone(this.scope)
    }
    if (this._isSupportLogin) {
      object.support = true
    }
    if (this._isPrivileged) {
      object.privileged = true
    }
    return object
  }

  clone() {

    const p = new AccessPrincipal(this._org, clone(this._contextData.toObject ? this._contextData.toObject() : this._contextData))

    if (this._roles) {
      p._roles = this._roles.slice() // these are expanded
    }
    if (this.__roles) {
      p.__roles = this.__roles.slice() // these are overrides
    }
    if (this._skipAcl) {
      p._skipAcl = true
    }
    if (this._bypassCreateAcl) {
      p._bypassCreateAcl = true
    }
    if (this._grant) {
      p._grant = this._grant
    }
    if (this._isSupportLogin) {
      p._isSupportLogin = true
    }
    if (this._skipAcl) {
      p._skipAcl = true
    }
    if (this._scope) {
      p._scope = clone(this._scope)
    }
    if (this._resolved_scope) {
      p._resolved_scope = clone(this._resolved_scope)
    }
    return p
  }

  merge(ac, options) {

    options = options || {}

    if (options.roles !== undefined) {
      this.roles = [...this.roles, ...toArray(options.roles, options.roles)]
    }
    if (options.scope) {
      const scope = modules.authentication.optimizeAuthScope(options.scope)
      scope.forEach(v => modules.authentication.validateAuthScope(ac.org, v))
      this.scope = scope
    }
    if (options.grant) {
      this.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }
    if (options.skipAcl) {
      this.skipAcl = true
    }
    if (options.bypassCreateAcl) {
      this.bypassCreateAcl = true
    }
    if (ac.principal.isSupportLogin) {
      this.isSupportLogin = true
    }

    return this
  }

  deScoped(force = false) {

    if (this.scope === null && !force) {
      return this
    }

    const p = this.clone()
    p.scope = null
    return p

  }

  /**
     * @param options
     *      req: null,
     *      email: false. true to include the principal's email address
     *      username: false. true to include the principal's username
     *      accessLevel: passed to org reader
     *      inspectAccess: passed to org reader
     *
     * @param callback
     */
  toJSON(options, callback) {

    if (_.isFunction(options)) {
      callback = options; options = {}
    } else {
      callback = ensureCallback(callback); options = options || {}
    }

    async.parallel({

      roles: callback => {
        const roles = []
        this.roles.forEach(roleId => {
          const role = findIdInArray(this.org.roles, '_id', roleId)
          if (role) {
            roles.push({
              _id: role._id,
              name: role.name
            })
          }
        })
        callback(null, roles)
      },

      org: callback => {
        const ac = new acl.AccessContext(this, this.org, { grant: options.accessLevel })
        this.org.aclRead(ac, function(err, json) {
          callback(err, json)
        })
      }

    }, (err, result) => {

      if (!err) {
        result._id = this._id
        if (!!options.email && this.email) result.email = this.email
        if (!!options.username && this.username) result.username = this.username
        result.name = {
          first: this.name.first,
          last: this.name.last
        }
      }
      callback(err, result)
    })

  }

  inScope(requiredScope, acceptPrefixMatch = true, exactMatch = false) {
    return modules.authentication.authInScope(this.scope, requiredScope, acceptPrefixMatch, exactMatch)
  }

  accessQuery(ac, accessLevel, options = {}, baseFind = {}) {

    accessLevel = acl.fixAllowLevel(accessLevel)

    // 1. resolve as much access as possible using default acl.
    const defaultAcl = acl.mergeAndSanitizeEntries(options.defaultAcl, options.defaultAclOverride || pathTo(ac.object, 'defaultAcl')),
          access = (new acl.AccessContext(this, null, { object: ac.object, grant: ac.grant, roles: ac.roles })).resolveAccess({ acl: defaultAcl }),
          accessRange = _.range(accessLevel, acl.AccessLevels.Max + 1)

    // 2. we've already got a pass. no need to add to the query.
    if (access.resolved >= accessLevel) {
      return baseFind
    }

    // resolve targeted account acl entries.
    // @important. we assume ids are unique across collections.
    let targets = [
          ...(this.isAnonymous() ? [acl.AnonymousIdentifier] : (this.isPublic() ? [acl.AnonymousIdentifier, acl.PublicIdentifier] : [acl.AnonymousIdentifier, acl.PublicIdentifier, this._id])),
          ...this.roles
        ],
        match,
        ownerOrCreatorField,
        topQuery,
        roleMatches

    match = _.extend({}, baseFind)
    match[ac.documentPathForAclKey('acl')] = {
      $elemMatch: {
        target: { $in: targets },
        allow: { $in: accessRange }
      }
    }
    topQuery = [match]

    // apply non-calculable, non-targeted acl defaults that satisfy the allow level.
    defaultAcl.filter(entry => entry && !entry.target && isInt(entry.allow) && entry.allow >= accessLevel).forEach(entry => {
      switch (entry.type) {
        case acl.AccessPrincipals.Self:
          if (equalIds(modules.db.models.account._id, ac.objectId)) {
            match = {}
            match[ac.documentPathForAclKey('_id')] = this._id
            topQuery.push(match)
          }
          break
        case acl.AccessPrincipals.Creator:
          match = _.extend({}, baseFind)
          ownerOrCreatorField = ac.documentPathForAclKey('creator')
          if (ownerOrCreatorField) match[ownerOrCreatorField] = this._id
          topQuery.push(match)
          break
        case acl.AccessPrincipals.Owner:
          match = _.extend({}, baseFind)
          ownerOrCreatorField = ac.documentPathForAclKey('owner')
          if (ownerOrCreatorField) match[ownerOrCreatorField] = this._id
          topQuery.push(match)
          break
      }
    })

    // apply calculable, targeted acl defaults as instance roles
    // any default acl that allows an account or role an access level, look for entries in the
    // instance acl that assign that role to the calling principal.
    // if entry.allow >= desired and targets match caller.
    roleMatches = acl.expandRoles(ac.org.roles, defaultAcl.reduce((roleMatches, entry) => {

      // note: instance acl only has account entries.
      // if this default entry allows a role the access we want, looks for instance entries where the target matches the caller
      // by account and grant the role.
      if (entry && entry.type === acl.EntryTypes.Role && entry.target && isInt(entry.allow) && entry.allow >= accessLevel) {
        roleMatches.push(entry.target)
      }
      return roleMatches
    }, []))

    if (roleMatches.length > 0) {
      match = _.extend({}, baseFind)
      match[ac.documentPathForAclKey('acl')] = {
        $elemMatch: {
          target: ac.principalId,
          allow: { $in: roleMatches }
        }
      }
      topQuery.push(match)
    }

    // non-targeted specific entries - not implemented. here, we'd take what wasn't covered by the defaults.
    // this is for acl entries in a document instance that have no target. for now, these are only suppported
    // at the object level as defaults.

    if (topQuery.length > 1) {
      return { $or: topQuery }
    }
    return topQuery[0]

  }

  get targetType() {
    return this._targetType !== undefined ? this._targetType : acl.AccessTargets.Account
  }
  set targetType(type) {
    if (type === acl.AccessTargets.Account || type === acl.AccessTargets.OrgRole) {
      this._targetType = type
    }
  }

  get _id() {

    if (this._targetType === acl.AccessTargets.OrgRole) {
      return this._contextData.roles[0]
    }
    return this._contextData._id
  }

  get org() {
    return this._org
  }

  updateOrg(org) {
    if (equalIds(this._org._id, org._id)) {
      this._org = org
    }
  }

  get orgId() {
    return this._org._id
  }

  get email() {
    return this._contextData.email
  }

  get username() {
    return this._contextData.username
  }

  get tz() {
    return this._contextData.tz || this._org.tz || null
  }

  get account() {
    return this._contextData
  }

  get locked() {
    return this._contextData.locked
  }

  get state() {
    return this._contextData.state
  }

  get name() {
    return this._name || this._contextData.name
  }

  get isSupportLogin() {
    return !!this._isSupportLogin
  }
  set isSupportLogin(v) {
    this._isSupportLogin = !!v
  }

  /**
   * Privileged principals allows the use of privileged options in things like drivers
   *
   * @returns {boolean}
   */
  get isPrivileged() {
    return !!this._isPrivileged
  }
  set isPrivileged(v) {
    this._isPrivileged = !!v
  }

  get skipAcl() {
    return !!this._skipAcl
  }
  set skipAcl(v) {
    this._skipAcl = !!v
  }

  get bypassCreateAcl() {
    return !!this._bypassCreateAcl
  }
  set bypassCreateAcl(v) {
    this._bypassCreateAcl = !!v
  }

  get grant() {
    return this._grant || acl.AccessLevels.None
  }

  set grant(v) {
    this._grant = acl.fixAllowLevel(v, true, acl.AccessLevels.None)
  }

  get scope() {
    if (!this._scope) {
      return null
    }
    if (!this._resolved_scope) {
      this._resolved_scope = modules.authentication.compileAuthScope(this.roles.reduce((scope, roleId) => {
        return toArray(pathTo(findIdInArray(this._org.roles, '_id', roleId), 'scope')).reduce((scope, entry) => {
          if (!~scope.indexOf(entry)) {
            scope.push(entry)
          }
          return scope
        }, scope)
      }, this._scope.slice()))
    }
    return this._resolved_scope
  }
  set scope(v) {
    this._resolved_scope = null
    this._scope = v === null ? null : toArray(v, v)
  }

  get roles() {
    if (!this._roles) {
      this._roles = acl.expandRoles(this._org.roles, this.__roles || this._contextData.roles)
    }
    return this._roles
  }

  set roles(roles) {
    this._roles = this._roleCodes = this._resolved_scope = null
    this.__roles = this.org.resolveRoles(roles)
  }

  get roleCodes() {
    if (!this._roleCodes) {
      const { org: { roles } } = this
      this._roleCodes = this.roles.map(roleId => roles.find(v => equalIds(v._id, roleId))?.code || roleId).sort()
    }
    return this._roleCodes

  }

  static is(principal) {
    return (principal instanceof AccessPrincipal)
  }

  static synthesizeOrgAdmin(org, accountId) {
    return this.synthesizeAccount({ org, accountId, roles: [acl.OrgAdminRole], state: 'verified' })
  }

  static synthesizeAnonymous(org) {
    return this.synthesizeAccount({ org, accountId: acl.AnonymousIdentifier, state: 'unverified' })
  }

  static synthesizeAccount({ org, accountId, email, username, roles, state, name, tz } = {}) {

    const contextData = {
            _id: getIdOrNull(accountId, true) || createId(),
            org: getIdOrNull(org, true),
            object: 'account',
            reap: false,
            email: email || 'principal@' + org.code,
            username: username || 'principal.' + org.code,
            roles: acl.expandRoles(org.roles, toArray(roles, roles)),
            state: rString(state, 'verified'),
            tz: rString(tz, rString(pathTo(org, 'tz'), null)),
            name: {
              first: rString(pathTo(name, 'first'), ''),
              last: rString(pathTo(name, 'last'), '')
            }
          },
          account = new modules.db.models.account(undefined, synPaths(), true).init(contextData)

    return new AccessPrincipal(org, account)

  }

  static hasRoleAccount(org, data) {
    return isPlainObject(data)
      ? org.roles.find(role => equalIds(role._id, data._id) || (role.code && role.code === data.code))
      : org.roles.find(role => equalIds(role._id, data) ||
        (role.code && role.code === data) ||
        (role.code && data === `${role.code}@${org.code}-iam.role.medable.com`))
  }

  static createRoleAccount(org, data, callback) {

    const orgRole = this.hasRoleAccount(org, data)

    if (!orgRole) {

      return callback(Fault.create('cortex.notFound.role'))

    } else {

      const contextData = {
              _id: orgRole._id,
              org: org._id,
              object: 'account',
              role: true,
              reap: false,
              locked: orgRole.locked,
              email: `${orgRole.code || orgRole._id}@${org.code}-iam.role.medable.com`,
              username: orgRole.code || orgRole._id,
              roles: acl.expandRoles(org.roles, orgRole._id),
              state: 'unverified',
              tz: rString(pathTo(org, 'tz'), null),
              name: {
                first: orgRole.name,
                last: 'Role'
              }
            },
            account = new modules.db.models.account(undefined, synPaths(), true).init(contextData)

      callback(null, new AccessPrincipal(org, account))
    }

  }

  static hasServiceAccount(org, data) {
    return isPlainObject(data)
      ? org.serviceAccounts.find(sa => equalIds(sa._id, data._id) || sa.name === data.name)
      : org.serviceAccounts.find(sa => equalIds(sa._id, data) ||
        sa.name === data ||
        data === `${sa.name}@${org.code}-iam.serviceaccount.medable.com`)
  }
  static createServiceAccount(org, data, callback) {

    const orgServiceAccount = this.hasServiceAccount(org, data)

    if (!orgServiceAccount) {

      return callback(Fault.create('cortex.notFound.serviceAccount'))

    } else {

      const contextData = {
              _id: orgServiceAccount._id,
              org: org._id,
              object: 'account',
              service: true,
              reap: false,
              locked: orgServiceAccount.locked,
              email: `${orgServiceAccount.name}@${org.code}-iam.serviceaccount.medable.com`,
              username: orgServiceAccount.name,
              roles: acl.expandRoles(org.roles, orgServiceAccount.roles),
              state: 'verified',
              tz: rString(pathTo(org, 'tz'), null),
              name: {
                first: orgServiceAccount.label,
                last: 'Service Account'
              }
            },
            account = new modules.db.models.account(undefined, synPaths(), true).init(contextData)

      callback(null, new AccessPrincipal(org, account))

    }
  }

  /**
     * @param org
     * @param data (Object|String|ObjectId)
     *  to create using username, the { username } option must exist.
     * @param options
     *  include: []. an array of paths to require. only applies to account. if passed, account is automatically set as the type hint.
     *
     * @param callback
     */
  static create(org, data, options, callback) {

    [options, callback] = resolveOptionsCallback(options, callback, false, false)

    const promise = new Promise((resolve, reject) => {

      data = data || {}

      if (data instanceof AccessPrincipal) {
        return resolve(data.clone())
      }

      if (equalIds(data, acl.AnonymousIdentifier) || data === 'anonymous') {
        return resolve(this.synthesizeAnonymous(org))
      } else if (equalIds(data, acl.PublicIdentifier) || data === 'public') {
        return resolve(this.synthesizeAccount({ org, accountId: acl.PublicIdentifier, state: 'unverified' }))
      }

      modules.db.models.org.prepareForAcl(org, (err, org) => {

        if (err) {
          return reject(err)
        }

        const isAnId = couldBeId(data),
              dataIsEmail = !isAnId && modules.validation.isEmail(data)

        if (dataIsEmail) {
          data = data.toLowerCase()
        }

        if (this.hasRoleAccount(org, data)) {
          return this.createRoleAccount(org, data, (err, principal) => {
            err ? reject(err) : resolve(principal)
          })
        }

        if (this.hasServiceAccount(org, data)) {
          return this.createServiceAccount(org, data, (err, principal) => {
            err ? reject(err) : resolve(principal)
          })
        }

        org.createObject('account', function(err, Account) {

          if (err) {
            return reject(err)
          }

          const requiredPaths = Account.requiredAclPaths.concat(getOption(options, 'include', []))

          let match

          // from document. we can exit here if we've got everything we need.
          if (acl.isAccessSubject(data) && data.constructor.objectName === Account.objectName) {
            if (_.every(requiredPaths, function(path) { return data.isSelected(path) })) {
              if (equalIds(org._id, data.org)) {
                resolve(new AccessPrincipal(org, data))
              } else {
                reject(Fault.create('cortex.notFound.account'))
              }
              return
            }
            match = { _id: data._id }
          } else if (isPlainObject(data)) {
            if (requiredPaths.every(path => pathTo(data, path) !== undefined)) {
              // keep only the paths we require for future security.
              const init = {}, sel = {}
              requiredPaths.forEach(function(path) {
                pathTo(init, path, pathTo(data, path))
                sel[path] = 1
              })
              if (equalIds(org._id, data.org)) {
                resolve(new AccessPrincipal(org, (new Account(undefined, sel, true)).init(init)))
              } else {
                reject(Fault.create('cortex.notFound.account'))
              }
              return
            }
            if (_.isString(data.username)) {
              match = { username: data.username }
            } else if (_.isString(data.email)) {
              match = { email: data.email }
            } else {
              match = { _id: getIdOrNull(data._id, true) }
            }
          } else if (isId(data) || isIdFormat(data)) { // from account id
            match = { _id: getIdOrNull(data) }
          } else if (modules.validation.isEmail(data)) { // from account email
            match = { email: data.toLowerCase() }
          }
          if (!match) {
            return reject(Fault.create('cortex.notFound.account'))
          }
          Account.aclLoad(AccessPrincipal.synthesizeAnonymous(org), { internalWhere: match, paths: requiredPaths, hooks: false, forceSingle: true, skipAcl: true, throwNotFound: false }, (err, account) => {
            if (!err && !account) {
              err = Fault.create('cortex.notFound.account')
            }
            err ? reject(err) : resolve(new AccessPrincipal(org, account))
          })
        })

      })

    })

    if (callback) {
      promise
        .then(v => callback(null, v))
        .catch(e => callback(e))
    }

    return promise

  }

}
