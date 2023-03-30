'use strict'

const util = require('util'),
      { singularize, capitalize } = require('inflection'),
      PropertyDefinition = require('../property-definition'),
      properties = require('../properties'),
      { transformAccessContext } = require('../properties/accessTransforms'),
      utils = require('../../../../utils'),
      {
        isSet, rString, array: toArray, idArrayUnion, isCustomName, isUuidString,
        uniqueIdArray, equalIds, getIdOrNull
      } = utils,
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      modules = require('../../../../modules'),
      semver = require('semver'),
      SelectionTree = require('../classes/selection-tree'),
      _ = require('underscore'),
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      clone = require('clone'),
      AclDefinition = require('../acl-definition'),
      Handlebars = require('handlebars').create()

let Undefined

Handlebars.registerHelper('hasRole', function(..._args) {

  let has = false, options = {}, idx = _args.length, args, role, principal, org
  while (idx-- > 1) {
    if (_args[idx] !== undefined) {
      options = _args[idx]
      break
    }
  }
  args = _args.slice(0, idx)
  role = args[0]
  principal = utils.path(options, 'data.ac.principal')
  org = utils.path(options, 'data.ac.org')

  if (principal && org && role) {
    if (!utils.couldBeId(role)) {
      role = org.roles.filter(r => r.name === role || r.code === role).map(r => r._id)[0]
    }
    if (role) {
      has = principal.hasRole(role)
    }
  }

  if (has) {
    return options.fn(this)
  } else {
    return options.inverse(this)
  }

})

Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context)
})

function assignId(object, _id) {
  object = object || {}
  if (isSet(object._id)) {
    object = { $and: [object, { _id }] }
  } else {
    object._id = _id
  }
  return object
}

function ListDefinition(options) {

  options = options || {}

  options.optional = true
  options.virtual = true
  options.array = true
  options.apiType = 'Reference[]'
  options.writable = options.canPush = options.canPull = false

  // dynamic properties could be functions.
  this.grant = _.isFunction(options.grant) ? options.grant : acl.fixAllowLevel(options.grant, true, acl.AccessLevels.None)
  this.skipAcl = _.isFunction(options.skipAcl) ? options.skipAcl : utils.rBool(options.skipAcl, false)
  this.roles = _.isFunction(options.roles) ? options.roles : utils.uniqueIdArray(options.roles)
  this.defaultAcl = _.isFunction(options.defaultAcl) ? options.defaultAcl : toArray(options.defaultAcl)
  this.createAcl = _.isFunction(options.createAcl) ? options.createAcl : toArray(options.createAcl)
  this.writeThrough = _.isFunction(options.writeThrough) ? options.writeThrough : Boolean(options.writeThrough)
  this.inheritInstanceRoles = _.isFunction(options.inheritInstanceRoles) ? options.inheritInstanceRoles : Boolean(options.inheritInstanceRoles)
  this.updateOnWriteThrough = _.isFunction(options.updateOnWriteThrough) ? options.updateOnWriteThrough : Boolean(options.updateOnWriteThrough)
  this.implicitCreateAccessLevel = _.isFunction(options.implicitCreateAccessLevel) ? options.implicitCreateAccessLevel : options.implicitCreateAccessLevel
  this.inheritPropertyAccess = _.isFunction(options.inheritPropertyAccess) ? options.inheritPropertyAccess : Boolean(options.inheritPropertyAccess)
  this.hoistList = _.isFunction(options.hoistList) ? options.hoistList : Boolean(options.hoistList)

  // source object cannot by dynamic in userland.
  this.sourceObject = options.sourceObject

  this.readThrough = Boolean(options.readThrough)

  this.defaultAclOverride = utils.rBool(options.defaultAclOverride, false)
  this.createAclOverride = utils.rBool(options.createAclOverride, false)

  this.where = options.where
  this.variables = toArray(options.variables)
  this.jsonTransformer = options.jsonTransformer
  this.preSort = options.preSort
  this.defaultLimit = options.defaultLimit > 0 ? options.defaultLimit : Undefined

  if (options.compiled && !semver.satisfies(Handlebars.VERSION, String(options.compiler_version))) {
    try {
      options.compiled = Handlebars.precompile(options.where)
    } catch (e) {

    }
  }
  this.compiled = options.compiled

  this.accessTransforms = toArray(options.accessTransforms)

  this.linkedReferences = toArray(options.linkedReferences)
  if (options.linkedProperty && !this.linkedReferences.find(v => v.source === '_id')) {
    this.linkedReferences = [...this.linkedReferences, { source: '_id', target: options.linkedProperty }]
  }
  this.linkedReferences.forEach(({ source }) => this.addDependency(source))

  // loosely load just about everything we'd need?
  options.dependencies = [
    '_id', 'object', 'type',
    ...toArray(options.dependencies),
    ...toArray(this.variables, !!this.variables),
    ...this.accessTransforms.map(v => {
      if (v && v.name === 'direct') {
        return '.' + v.property // if there's a local property used in a transform, always load it.
      }
    }).filter(v => v),
    ...this.linkedReferences.map(({ source }) => source)
  ]

  options.deferWrites = this.linkedReferences.length > 0

  options.groupReader = function(node, principal, entries, req, script, selection, callback) {

    // detect read-through.
    let readThroughId,
        readThroughKey,
        readThroughPath,
        parentSinglePath = entries[0].ac.singlePath,
        parentSingleCursor = false,
        singleCursor = false,
        parentSingleCallback,
        singleCallback = null,
        parentSingleOptions,
        singleOptions,
        isProjection,
        listOpts,
        queryArguments,
        getSelections = true

    if (entries.length === 1 && parentSinglePath) {
      let singlePath = parentSinglePath
      if (singlePath.indexOf(node.fullpath) === 0) {
        singlePath = singlePath.substr(node.fullpath.length + 1)
        singleCursor = entries[0].ac.singleCursor
        singleOptions = entries[0].ac.singleOptions
        singleCallback = entries[0].ac.singleCallback
      } else {
        singlePath = null
      }
      if (singlePath) {

        const dotPos = singlePath.indexOf('.'),
              inspectPath = ~dotPos ? singlePath.substring(singlePath, dotPos) : singlePath

        readThroughKey = (isCustomName(inspectPath, ['c_', 'o_']) || isUuidString(inspectPath)) ? inspectPath : null
        readThroughId = !readThroughKey && getIdOrNull(inspectPath)

        if ((readThroughId || readThroughKey) && ~dotPos) {
          readThroughPath = singlePath.substring(dotPos + 1)
        }
        parentSingleCursor = entries[0].ac.singleCursor
        parentSingleOptions = entries[0].ac.singleOptions
        parentSingleCallback = entries[0].ac.singleCallback

        // pass read down to child list. if there's only an id and no more path
        // allow cursor reading as if the last item was a preMatch for find() in case.
        // https://jira.devops.medable.com/browse/CTXAPI-369
        if (readThroughPath) {
          singleCursor = false
          singleCallback = null
        }

        if (!(readThroughId || readThroughKey)) {
          return callback(entries[0].ac.passive ? null : Fault.create('cortex.notFound.property', { resource: entries[0].ac.getResource(), path: node.fullpath, reason: 'List property path not found.' }))
        } else if (!node.readThrough) {
          return callback(entries[0].ac.passive ? null : Fault.create('cortex.invalidArgument.unspecified', { resource: entries[0].ac.getResource(), path: node.fullpath, reason: 'List property read-through is disabled.' }))
        }

      }
    }

    isProjection = !!selection.runtimeProcessor

    if (isProjection) {
      selection = selection.runtimeProcessor(node, principal, entries, req, script, selection)
    }

    listOpts = {
      req: req,
      script: script,
      defaultAclOverride: node.defaultAclOverride,
      createAclOverride: node.createAclOverride,
      jsonTransformer: node.jsonTransformer
    }

    if (isProjection) {
      queryArguments = selection.projection
      getSelections = false
    } else {

      // get a normalized path without the first component (which should always be the object);
      const topPath = utils.pathParts(utils.normalizeObjectPath(utils.rString(utils.path(req, 'path'), '').replace(/\//g, '.'), true, true, true))[1] || ''
      if (readThroughPath) {
        queryArguments = {}
      } else {
        if (singleOptions) {
          // we've used a path prefix from somewhere that's allowed (not a client provided projection).
          queryArguments = singleOptions
          getSelections = false
          utils.extend(listOpts, _.pick(singleOptions || {}, 'skipAcl', 'grant', 'allowNoLimit', 'returnParser')) // privileged
        } else if (!script) {
          // don't pick up request options from a script.
          const numComponents = topPath ? topPath.split('.').length : 0,
                dotPath = utils.normalizeObjectPath(selection.fullPath).split('.').slice(numComponents).join('.')
          if (parentSinglePath === dotPath) {
            queryArguments = utils.path(req, 'query')
          } else {
            queryArguments = utils.dotPath(utils.path(req, 'query'), dotPath)
          }
        }
      }

    }
    queryArguments = queryArguments || {}
    utils.extend(listOpts, _.pick(queryArguments, 'limit', 'skip', 'where', 'map', 'group', 'sort', 'pipeline', 'paths', 'include', 'expand'))

    // const query_arguments = is_projection ? selection.projection : utils.dotPath(utils.path(req, 'query'), selection.fullPath);
    // utils.extend(list_opts, _.pick(query_arguments||{}, 'limit', 'skip', 'where', 'map', 'group', 'sort', 'pipeline', 'paths', 'include', 'expand'));

    // set options at this level.
    selection.setOption('deferGroupReads', true)
    selection.setOption('forgiving', false)

    async.eachSeries(entries, (entry, callback) => {
      node._createBaseContext(principal, entry.input, (err, baseCtx, Source) => {

        if (err) {
          return callback(err)
        }

        if (readThroughKey && !Source.uniqueKey) {
          if (entry.ac.passive) {
            // the caller is asking for a c_{key} but there isn't one. likely, there's an error. if passive, return a null value.
            readThroughKey = null
            readThroughId = consts.emptyId
          } else {
            return callback(
              Fault.create(
                'cortex.invalidArgument.unspecified',
                {
                  reason: `readThrough key "${readThroughKey}" was specified but a uniqueKey is not set for the source object.`,
                  resource: entry.ac.getResource(),
                  path: node.fqpp
                }
              )
            )
          }

        }

        if (getSelections) {
          listOpts.selectionTree = (readThroughId || readThroughKey) ? selection.findSelection((readThroughId || readThroughKey).toString()) : selection
        } else {
          listOpts.selectionTree = null
        }

        node._readInputVariables(Source, entry.ac, entry.input, baseCtx, (err, entryCtx) => { // use original ac for reading current input
          if (err) {
            return callback(err)
          }
          node._getPreMatch(entry.ac, entryCtx, (err, preMatch) => {

            if (err) {
              return callback(err)
            }

            if ((readThroughId || readThroughKey)) {
              if (!preMatch) {
                preMatch = readThroughId ? { _id: readThroughId } : { [Source.uniqueKey]: readThroughKey }
              } else if (readThroughId) {
                preMatch = assignId(preMatch, readThroughId)
              } else {
                preMatch[Source.uniqueKey] = readThroughKey
              }
              listOpts.preMatch = preMatch

              // add relative path to all expand, include, paths.
              if (readThroughPath) {
                ['paths', 'include', 'expand'].forEach(function(key) {
                  if (listOpts[key]) {
                    listOpts[key] = toArray(listOpts[key], true).map(function(entry) {
                      return readThroughPath + '.' + entry
                    })
                  }
                })
                if (listOpts.paths) {
                  listOpts.paths.push(readThroughPath)
                } else {
                  listOpts.paths = [readThroughPath]
                }
                listOpts.singlePath = readThroughPath
                listOpts.singleCursor = parentSingleCursor
                listOpts.singleOptions = parentSingleOptions
                listOpts.singleCallback = parentSingleCallback
              }
            } else {
              listOpts.preMatch = preMatch

            }

            // set from current input document properties. document definition is responsible for loading options (eg. see oo-definition listOptions)
            listOpts.grant = node.getRuntimeOption('grant', entry.input)
            listOpts.roles = node.getRuntimeOption('roles', entry.input)
            listOpts.skipAcl = node.getRuntimeOption('skipAcl', entry.input)
            listOpts.defaultAcl = toArray(node.getRuntimeOption('defaultAcl', entry.input))
            listOpts.createAcl = toArray(node.getRuntimeOption('createAcl', entry.input))
            listOpts.skipAcl = node.getRuntimeOption('skipAcl', entry.input)

            listOpts.readThroughPath = (entry.ac.readThroughPath || '') + (node.readThrough ? `/${entry.ac.getPath().replace(/\./g, '/')}` : '')
            listOpts.initReadPath = { prefix: node.docpath, object: false, _id: true }
            listOpts.resourcePath = entry.resourcePath
            listOpts.preSort = node.preSort

            node.transformAccessContext(entry.ac, entry.input, { forWrite: false }, (err, ac) => {
              if (err) {
                return callback(err)
              }
              listOpts.roles = idArrayUnion(listOpts.roles, ac.instance_roles)
              if (ac.dryRun) {
                listOpts.documents = toArray(utils.path(entry.ac.subject, '$__inplace.' + node.docpath))
                listOpts.dryRun = true
              }
              listOpts.unindexed = entry.ac.unindexed

              if (node.getRuntimeOption('inheritPropertyAccess', entry.input)) {
                listOpts.grant = Math.max(listOpts.grant, node.getRuntimeAccess(ac))
              }

              listOpts.passive = ac.passive
              listOpts.locale = queryArguments.locale || ac.getLocale(false, false) // set locale only if explicitly set in the current context
              listOpts.eq = ac.eq

              if (singleCursor) {
                if (listOpts.returnParser) {
                  Source.aclLoad(ac.principal, listOpts, function(err, result, parser, select) {
                    if (singleCallback) {
                      singleCallback(err, result, parser, select)
                    }
                    if (!err) {
                      utils.path(entry.output, node.docpath, result)
                    }
                    callback(err)
                  })
                } else {
                  Source.aclCursor(ac.principal, listOpts, function(err, result) {
                    if (singleCallback) {
                      singleCallback(err, result)
                    }
                    if (!err) {
                      utils.path(entry.output, node.docpath, result)
                    }
                    callback(err)
                  })
                }
              } else {

                listOpts.defaultLimit = node.defaultLimit

                Source.aclList(ac.principal, listOpts, (err, result) => {

                  let hoisted = false

                  if (!err && result && result.object === 'list' && Array.isArray(result.data)) {
                    if (node.getRuntimeOption('hoistList', entry.input)) {
                      result = result.data
                      hoisted = true
                    } else if (!isSet(result.path)) {
                      result.path = `${listOpts.readThroughPath}/${node.docpath}`
                    }
                  }

                  if (singleCallback) {
                    singleCallback(err, result)
                  }
                  if (!err) {
                    utils.path(entry.output, node.docpath, (readThroughId || readThroughKey) ? (hoisted ? result : result.data) : result)
                  }
                  callback(err)
                })
              }
            })

          })
        })
      })

    }, callback)

  }

  PropertyDefinition.call(this, options)

}

util.inherits(ListDefinition, PropertyDefinition)

ListDefinition.typeName = 'List'
ListDefinition.mongooseType = null

ListDefinition.prototype.aclAccess = function(ac, parentDocument, parts, options, callback) {

  parts = utils.normalizeAcPathParts(parts)
  if (parts.length === 0) {
    return PropertyDefinition.prototype.aclAccess.call(this, ac, parentDocument, parts, options, callback)
  }

  if (!this.readable) {
    return callback(Fault.create('cortex.notFound.property', { resource: ac.getResource(), path: this.fqpp }))
  } else if (!this.readThrough || !this.getRuntimeOption('sourceObject', parentDocument)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'readThrough is not enabled for aclAccess()', path: this.fqpp }))
  } else if (!this.getRuntimeOption('sourceObject', parentDocument)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'sourceObject is required for aclAccess()', path: this.fqpp }))
  }

  this._createBaseContext(ac.principal, parentDocument, (err, baseCtx, Source) => {
    if (err) {
      return callback(err)
    }
    this._readInputVariables(Source, ac, ac.subject, baseCtx, (err, entryCtx) => {
      if (err) {
        return callback(err)
      }
      this._getPreMatch(ac, entryCtx, (err, preMatch) => {
        if (err) {
          return callback(err)
        }
        this.transformAccessContext(ac, parentDocument, { forWrite: false }, (err, ac) => {

          if (err) {
            return callback(err)
          }

          const accessOptions = {
            method: ac.method,
            script: ac.script,
            req: ac.req,
            grant: Math.max(this.getRuntimeOption('grant', parentDocument), ac.grant),
            roles: idArrayUnion(this.roles, ac.instance_roles),
            skipAcl: this.skipAcl || ac.principal.skipAcl,
            defaultAcl: toArray(this.getRuntimeOption('defaultAcl', parentDocument)),
            defaultAclOverride: this.defaultAclOverride,
            createAcl: toArray(this.getRuntimeOption('createAcl', parentDocument)),
            dryRun: ac.dryRun,
            locale: ac.getLocale(false, false),
            passive: ac.passive,
            preMatch,
            requiredReferences: this.linkedReferences.map(ref => ref.target)
          }
          Source.buildAccessContext(ac.principal, parts, accessOptions, callback)
        })
      })
    })
  })

}

/**
 *
 * @param ac
 * @param entryCtx
 * @param callback -> err, preMatch
 * @returns {*}
 * @private
 */
ListDefinition.prototype._getPreMatch = function(ac, entryCtx, callback) {

  // simple match?
  if (!this.where) {

    if (this.linkedReferences.length) {
      return callback(null, this.linkedReferences.reduce((where, ref) => {
        // where[`${ref.target}._id`] = ref.source === '_id' ? entryCtx.input._id : utils.path(entryCtx.input, `${ref.source}._id`)
        where[ref.target] = ref.source === '_id' ? entryCtx.input._id : utils.path(entryCtx.input, `${ref.source}._id`)
        return where
      }, {}))
    }
    return callback(null, null)
  }

  let err, preMatch = null
  try {
    preMatch = JSON.parse(Handlebars.template(eval('(' + this.compiled + ')'))(entryCtx, { // eslint-disable-line no-eval
      data: {
        ac: ac,
        ctx: entryCtx
      }
    }).trim())
    if (this.linkedReferences.length) {
      preMatch = this.linkedReferences.reduce((where, ref) => {
        // where[`${ref.target}._id`] = ref.source === '_id' ? entryCtx.input._id : utils.path(entryCtx.input, `${ref.source}._id`)
        where[ref.target] = ref.source === '_id' ? entryCtx.input._id : utils.path(entryCtx.input, `${ref.source}._id`)
        return where
      }, preMatch || {})
    }
  } catch (e) {
    err = Fault.create('cortex.error.unspecified', { resource: ac.getResource(), reason: 'Where clause template rendering error.' })
  }
  return callback(err, preMatch)

}

/**
 *
 * @param Source
 * @param ac
 * @param input
 * @param baseCtx
 * @param callback -> err, baseCtx (with ac access and variables as input)
 * @private
 */
ListDefinition.prototype._readInputVariables = function(Source, ac, input, baseCtx, callback) {

  const varPaths = this.variables.filter(v => v.source === this.root.objectName).map(v => v.name).concat(['_id', 'object'])

  if (this.linkedReferences.length) {
    this.linkedReferences.forEach(ref => varPaths.push(ref.source))
  }

  // add the unique key but don't require it if it's not among the requested variables.
  let loadsPaths = Source.uniqueKey ? [...varPaths, Source.uniqueKey] : varPaths,
      varTree = new SelectionTree({ paths: loadsPaths, ignoreMissing: true }),
      varAc

  varTree.setOption('important', true)
  varTree.setOption('forgiving', true)

  // aclRead the json to match up with variables. skip most acl.
  varAc = new acl.AccessContext(ac.principal, input, { grant: acl.AccessLevels.Script })
  input.aclRead(varAc, varTree, (err, docJSON) => {
    if (!err) {
      baseCtx = clone(baseCtx)
      baseCtx.input = docJSON
      baseCtx.access = ac.resolved
      for (let i = 0; i < varPaths.length; i++) {
        if (utils.path(docJSON, varPaths[i]) === undefined) {
          err = Fault.create('cortex.invalidArgument.unspecified', { resource: ac.getResource(), reason: 'A required list variable (' + varPaths[i] + ') is missing from the input document.' })
          break
        }
      }
    }
    callback(err, baseCtx)
  })

}

ListDefinition.prototype.transformAccessContext = transformAccessContext

/**
 *
 * @param principal
 * @param parentDocument
 * @param callback -> err, baseCtx, Source
 * @private
 */
ListDefinition.prototype._createBaseContext = function(principal, parentDocument, callback) {

  const baseCtx = {
          access: acl.AccessLevels.None,
          principal: {
            _id: principal._id,
            roles: principal.roles,
            email: principal.email,
            name: principal.name
          },
          org: {
            _id: principal.org._id,
            code: principal.org.code
          },
          account: {
            _id: principal._id,
            roles: principal.roles,
            email: principal.email,
            name: principal.name
          }
        },
        gotBaseCtx = (baseCtx) => {
          principal.org.createObject(this.getRuntimeOption('sourceObject', parentDocument), (err, Source) => {
            callback(err, baseCtx, Source)
          })
        },
        // load account variables.
        acctPaths = this.variables.filter(v => v.source === 'account').map(v => v.name)

  if (acctPaths.length === 0) {
    gotBaseCtx(baseCtx)
  } else {
    principal.org.createObject('Account', (err, Account) => {
      if (err) {
        return callback(err)
      }
      const acctTree = new SelectionTree({ paths: acctPaths })
      acctTree.setOption('forgiving', true)
      Account.aclReadOne(principal, principal._id, { paths: acctPaths, selectionTree: acctTree }, (err, accountJson) => {
        if (err) {
          return callback(err)
        }
        utils.extend(true, baseCtx.account, accountJson)
        gotBaseCtx(baseCtx)
      })
    })
  }

}

ListDefinition.getProperties = function() {
  return [
    { name: 'array', default: true, writable: false, creatable: false },
    { name: 'writable', default: false, writable: false },
    { name: 'indexed', default: false, writable: false },
    { name: 'history', default: false, writable: false },
    { name: 'auditable', default: false, writable: false },
    { name: 'unique', default: false, writable: false },
    { name: 'canPush', writable: false },
    { name: 'canPull', writable: false },
    { name: 'minItems', writable: false },
    { name: 'maxShift', writable: false },
    { name: 'maxItems', writable: false },
    { name: 'writeOnCreate', default: false, readable: false, writable: false },
    { name: 'pusher', default: false, readable: false, writable: false, public: false },
    { name: 'puller', default: false, readable: false, writable: false, public: false },
    { name: 'reader', readable: false, writable: false, public: false },
    { name: 'writer', readable: false, writable: false, public: false },
    { name: 'default', readable: false, writable: false, public: false },
    {
      label: 'Grant',
      name: 'grant',
      type: 'Number',
      // description: 'Applies to expansions. The access level granted to the calling principal through expansion. Warning! This option can expose private context details. Consider using object pacls instead, and leave the grant level low.',
      readable: true,
      writable: true,
      default: acl.AccessLevels.None,
      writer: function(ac, node, value) {
        if (_.isString(value)) {
          const intValue = acl.AccessLevels[capitalize(value)]
          if (isSet(intValue)) {
            return intValue
          }
        }
        return value
      },
      validators: [{
        name: 'numberEnum',
        definition: {
          values: [acl.AccessLevels.None, acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update],
          defaultValue: acl.AccessLevels.None
        }
      }],
      export: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.export.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : rString(acl.AccessLevelsLookup[value], '').toLowerCase()
      },
      import: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.import.call(this, ac, input, resourceStream, parentPath, options)
        return value === Undefined ? value : acl.AccessLevels[capitalize(value)]
      }
    },
    {
      label: 'Default Limit',
      name: 'defaultLimit',
      type: 'Number',
      // description: 'Override the default list limits.',
      readable: true,
      writable: true,
      default: 0,
      validators: [{
        name: 'number',
        definition: {
          min: 0,
          max: config('contexts.maxLimit'),
          allowNull: false,
          allowDecimal: false
        }
      }]
    },
    {
      label: 'Roles',
      name: 'roles',
      type: 'ObjectId',
      writable: true,
      array: true,
      uniqueValues: false,
      canPush: false,
      canPull: false,
      validators: [{
        name: 'adhoc',
        definition: {
          asArray: true,
          validator: function(ac, node, values) {
            if (utils.intersectIdArrays(values, toArray(ac.org.roles).map(role => role._id)).length < values.length) {
              throw Fault.create('cortex.notFound.role', { reason: `One or more roles do not exist for ${modules.db.definitions.getInstancePath(this, node, true, true)}` })
            }
            return true
          }
        }
      }],
      writer: function(ac, node, value) {
        return uniqueIdArray(
          value.map(role => {
            if (_.isString(role)) {
              const existing = ac.org.roles.find(r => (r.code && r.code === role) || equalIds(role, r._id))
              if (existing) {
                return existing._id
              }
            }
            return role
          })
        )
      },
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              arr = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

        if (arr === Undefined) {
          return Undefined
        }

        return (await Promise.all(toArray(arr).map(async(id) => {
          return resourceStream.addMappedPrincipal(ac, id, resourcePath)
        }))).sort(utils.naturalCmp)

      },
      import: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              arr = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options),
              out = []

        if (arr === Undefined) {
          return Undefined
        }

        for (const id of toArray(arr)) {
          out.push((await resourceStream.importMappedPrincipal(ac, `role.${id}`, `${resourcePath}.roles`))._id)
        }
        return out

      }
    },
    {
      label: 'Skip ACL',
      name: 'skipAcl',
      // description: “Skip ACL checks for context access altogether and load all matching results. The Grant option still applies for instance property access.”
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Source Object',
      name: 'sourceObject',
      type: 'String',
      writable: true,
      dependencies: ['.where', '.linkedProperty', 'linkedReferences'],
      export: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              sourceObject = await PropertyDefinition.prototype.export.call(this, ac, doc, resourceStream, parentPath, options)

        if (sourceObject === Undefined) {
          return Undefined
        }
        return resourceStream.addMappedObject(ac, sourceObject, resourcePath)

      },
      import: async function(ac, doc, resourceStream, parentPath, options) {

        const resourcePath = this.getExportResourcePath(parentPath, options),
              sourceObject = await PropertyDefinition.prototype.import.call(this, ac, doc, resourceStream, parentPath, options)

        if (sourceObject === Undefined) {
          return Undefined
        }

        return (await resourceStream.importMappedObject(ac, sourceObject, resourcePath)).name

      },

      writer: function(ac, node, value) {
        value = utils.rString(value, '').toLowerCase().trim()
        value = value && singularize(value)
        if (this.sourceObject !== value) {
          this.markModified('where')
          this.markModified('linkedProperty')
          this.markModified('linkedReferences')
        }
        return value
      },
      validators: [{
        name: 'required'
      }, {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            ac.org.createObject(value, err => callback(err))
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Organization cannot be referenced in a list.',
          validator: function(ac, node, value) {
            return value !== 'org'
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          message: 'Output objects cannot be referenced.',
          validator: function(ac, node, value) {
            return !isCustomName(value, 'o_', false)
          }
        }
      }]
    },
    {
      label: 'Linked Property',
      name: 'linkedProperty',
      type: 'String',
      writable: true,
      dependencies: ['name', '.where', '.sourceObject', 'linkedReferences'],
      default: '',
      writer: function(ac, node, value) {
        this.markModified('where')
        this.markModified('linkedReferences')
        return utils.rString(value, '').trim()
      },
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 0
        }
      }, {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {
            if (value === '') {
              return callback(null, true)
            }
            ac.org.createObject(this.sourceObject, (err, object) => {
              if (!err) {
                const nodes = object.schema.node.findTypedNode(value, true) // no typed nodes are unreadable.
                if (nodes.length === 0 || nodes.filter(v => !v.readable).length) {
                  err = Fault.create('cortex.notFound.property', { path: node.fullpath, reason: `Linked property not found: ${value}` })
                } else if (nodes.filter(v => v.readAccess > acl.AccessLevels.Script).length) {
                  // don't allow nodes that would otherwise not be readable.
                  err = Fault.create('cortex.accessDenied.unspecified', { path: node.fullpath, reason: `Linked property cannot be accessed: ${value}` })
                } else if (nodes.filter(v => {
                  const typeName = v.getTypeName()
                  if (typeName === 'ObjectId') {
                    return v.sourceObject !== ac.subject.name
                  } else if (typeName === 'Reference') {
                    return ![ac.subject.name, ''].includes(v.sourceObject)
                  }
                  return true
                }).length) {
                  // only custom references/objectIds are allowed.
                  err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Linked property must reference the parent: ${value}` })
                } else if (nodes.filter(v => !v.indexed && !v.nativeIndex).length) {
                  // reference must be indexed.
                  err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Linked properties must be indexed: ${value}` })
                } else if (nodes.filter(v => v.parent.fullpath === 'properties').length) {
                  // only top-level properties are allowed.
                  err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Linked property must be a top level property of the child object: ${value}` })
                }
              }
              callback(err, !err)
            })
          }
        }
      }]
    },
    {
      label: 'Linked References',
      name: 'linkedReferences',
      type: 'Document',
      writable: true,
      dependencies: ['name', 'properties', 'sourceObject', 'linkedProperty'],
      array: true,
      canPush: true,
      canPull: true,
      mergeOverwrite: true,
      validators: [{
        name: 'adhoc',
        definition: {
          asArray: true,
          post: true,
          validator: function(ac, node, values, callback) {

            if (values.length === 0) {
              return callback(null, true)
            }

            const sources = values.map(v => v.source), targets = values.map(v => v.target)

            // duplicates pairs are not allowed
            if (sources.length !== _.uniq(sources).length || targets.length !== _.uniq(targets).length) {
              return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Duplicate sources/targets are not permitted.' }))
            }

            modules.db.definitions.generateCustomModel(modules.db.getRootDocument(this).toObject(), (err, sourceObject) => {

              if (err) {
                return callback(err)
              }
              ac.org.createObject(this.sourceObject, (err, targetObject) => {

                for (let i = 0; !err && i < sources.length; i++) {
                  const sourceNodes = sourceObject.schema.node.findTypedNode(sources[i], true),
                        targetNodes = targetObject.schema.node.findTypedNode(targets[i], true),
                        objectName = sources[i] === '_id' ? ac.subject.name : sourceNodes[0].sourceObject

                  if (sources[i] !== '_id') {
                    for (let i = 0; i < sourceNodes.length; i++) {
                      if (objectName !== sourceNodes[i].sourceObject) {
                        err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `All linked reference source objects must match "${objectName}", but encountered "${sourceNodes[i].objectName}"` })
                      }
                    }
                  } else if (this.linkedProperty) {
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: '_id cannot be used in both linkedReferences and linkedProperty.' })
                  }
                  for (let i = 0; !err && i < targetNodes.length; i++) {
                    const typeName = targetNodes[i].getTypeName()
                    let fail = false
                    if (typeName === 'ObjectId') {
                      fail = objectName !== targetNodes[i].sourceObject
                    } else if (typeName === 'Reference') {
                      fail = ![objectName, ''].includes(targetNodes[i].sourceObject)
                    }
                    if (fail) {
                      err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `All linked reference source objects must match "${objectName}", but encountered "${sourceNodes[i].objectName}"` })
                    }
                  }
                }
                callback(err)
              })
            })
          }
        }
      }],
      properties: [{
        label: 'Source Property',
        name: 'source',
        type: 'String',
        writable: true,
        dependencies: ['.source', '..where', '..sourceObject', 'properties'],
        writer: function(ac, node, value) {
          const parent = modules.db.getParentDocument(this)
          parent.markModified('where')
          return utils.rString(value, '').trim()
        },
        validators: [{
          name: 'string',
          definition: {
            allowNull: false,
            min: 1
          }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {

              if (value === '_id') {
                return callback(null, true)
              }

              modules.db.definitions.generateCustomModel(modules.db.getRootDocument(this).toObject(), (err, object) => {
                if (!err) {
                  const nodes = object.schema.node.findTypedNode(value, true) // no typed nodes are unreadable.
                  if (nodes.length === 0 || nodes.filter(v => !v.readable).length) {
                    err = Fault.create('cortex.notFound.property', { path: node.fullpath, reason: `Source property not found: ${value}` })
                  } else if (nodes.filter(v => v.readAccess > acl.AccessLevels.Script).length) {
                    // don't allow nodes that would otherwise not be readable.
                    err = Fault.create('cortex.accessDenied.unspecified', { path: node.fullpath, reason: `Source property cannot be accessed: ${value}` })
                  } else if (nodes.filter(v => v.getTypeName() !== 'Reference').length) {
                    // only references are allowed
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Source property must be a reference: ${value}` })
                  } else if (nodes.filter(v => !v.indexed).length) {
                    // reference must be indexed.
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Source properties must be indexed: ${value}` })
                  } else if (nodes.filter(v => v.parent.fullpath === 'properties').length) {
                    // only top-level properties are allowed.
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Source property must be a top level property: ${value}` })
                  }
                }
                callback(err)
              })
            }
          }
        }]

      }, {
        label: 'Target Property',
        name: 'target',
        type: 'String',
        writable: true,
        dependencies: ['.source', '..where', '..sourceObject'],
        writer: function(ac, node, value) {
          const parent = modules.db.getParentDocument(this)
          parent.markModified('where')
          return utils.rString(value, '').trim()
        },
        validators: [{
          name: 'string',
          definition: {
            allowNull: false,
            min: 1
          }
        }, {
          name: 'adhoc',
          definition: {
            validator: function(ac, node, value, callback) {
              const parent = modules.db.getParentDocument(this)
              ac.org.createObject(parent.sourceObject, (err, object) => {
                if (!err) {
                  const nodes = object.schema.node.findTypedNode(value, true) // no typed nodes are unreadable.
                  if (nodes.length === 0 || nodes.filter(v => !v.readable).length) {
                    err = Fault.create('cortex.notFound.property', { path: node.fullpath, reason: `Linked property not found: ${value}` })
                  } else if (nodes.filter(v => v.readAccess > acl.AccessLevels.Script).length) {
                    // don't allow nodes that would otherwise not be readable.
                    err = Fault.create('cortex.accessDenied.unspecified', { path: node.fullpath, reason: `Linked property cannot be accessed: ${value}` })
                  } else if (nodes.filter(v => !['Reference', 'ObjectId'].includes(v.getTypeName())).length) {
                    // only custom references are allowed.
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Only references and object ids can be linked: ${value}` })
                  } else if (nodes.filter(v => !v.indexed && !v.nativeIndex).length) {
                    // reference must be indexed.
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Linked properties must be indexed: ${value}` })
                  } else if (nodes.filter(v => v.parent.fullpath === 'properties').length) {
                    // only top-level properties are allowed.
                    err = Fault.create('cortex.invalidArgument.unspecified', { path: node.fullpath, reason: `Linked property must be a top level property of the child object: ${value}` })
                  }
                }
                callback(err, !err)
              })
            }
          }
        }]
      }]
    },
    {
      label: 'Read Through',
      name: 'readThrough',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Write Through',
      name: 'writeThrough',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Update On Write Through',
      name: 'updateOnWriteThrough',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Inherit Instance Roles',
      name: 'inheritInstanceRoles',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Hoist List Data',
      name: 'hoistList',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    {
      // If not null, and the caller had the specified grant level, bypassCreateAcl is added to create options
      // for the current level, but not applied to the principal itself.
      label: 'Implicit Create Access Level',
      name: 'implicitCreateAccessLevel',
      type: 'Number',
      readable: true,
      writable: true,
      default: null,
      validators: [{
        name: 'numberEnum',
        definition: {
          values: [null, acl.AccessLevels.None, acl.AccessLevels.Public, acl.AccessLevels.Connected, acl.AccessLevels.Read, acl.AccessLevels.Share, acl.AccessLevels.Update, acl.AccessLevels.Delete, acl.AccessLevels.Script],
          defaultValue: null
        }
      }],
      writer: function(ac, node, value) {
        if (_.isString(value)) {
          const intValue = acl.AccessLevels[capitalize(value)]
          if (isSet(intValue)) {
            return intValue
          }
        }
        return value
      },
      export: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.export.call(this, ac, input, resourceStream, parentPath, options)
        return !isSet(value) ? value : rString(acl.AccessLevelsLookup[value], '').toLowerCase()
      },
      import: async function(ac, input, resourceStream, parentPath, options) {
        const value = await PropertyDefinition.prototype.import.call(this, ac, input, resourceStream, parentPath, options)
        return !isSet(value) ? value : acl.AccessLevels[capitalize(value)]
      }
    },
    {
      label: 'Inherit Property Access',
      name: 'inheritPropertyAccess',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    new AclDefinition({
      label: 'Default Acl',
      name: 'defaultAcl',
      type: 'Document',
      readable: true,
      writable: true,
      array: true,
      maxItems: 20,
      canPush: true,
      canPull: true,
      includeId: true,
      withExpressions: true
    }),
    {
      label: 'Default Acl Override',
      name: 'defaultAclOverride',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    new AclDefinition({
      label: 'Create Acl',
      name: 'createAcl',
      type: 'Document',
      readable: true,
      writable: true,
      array: true,
      maxItems: 20,
      canPush: true,
      canPull: true,
      includeId: true,
      forCreate: true,
      withExpressions: true
    }),
    {
      label: 'Create Acl Override',
      name: 'createAclOverride',
      type: 'Boolean',
      readable: true,
      writable: true,
      default: false
    },
    properties.accessTransforms,
    {
      label: 'Where',
      name: 'where',
      type: 'String',
      writable: true,
      dependencies: ['.sourceObject', '.linkedProperty', '.linkedReferences', '.dependencies', '.variables', '.compiled', '.compiler_version'],
      default: '',
      validators: [{
        name: 'string',
        definition: {
          allowNull: false,
          min: 0,
          max: 1024
        }
      }, {
        name: 'adhoc',
        definition: {
          validator: function(ac, node, value, callback) {

            if (value === '') {
              this.dependencies = []
              this.variables = []
              this.compiled = ''
              this.compiler_version = null
              return callback(null, true)
            }

            async.waterfall([

              // get source object
              callback => {
                ac.org.createObject(this.sourceObject, (err, Source) => {
                  callback(err, Source)
                })
              },

              // get the local object
              (Source, callback) => {

                modules.db.definitions.generateCustomModel(
                  modules.db.getRootDocument(this).toObject(),
                  (err, Local) => callback(err, Source, Local)
                )
              },

              // get account object
              (Source, Local, callback) => {
                if (Source.objectName === 'Account') {
                  callback(null, Source, Local, Source)
                } else if (Local.objectName === 'Account') {
                  callback(null, Source, Local, Local)
                } else {
                  ac.org.createObject('Account', (err, Account) => {
                    callback(err, Source, Local, Account)
                  })
                }

              },

              (Source, Local, Account, callback) => {

                // pull out nodes that match paths and validate them against what is available in access, principal, org, account, and input
                const variables = []
                let precompiled = null

                try {

                  // @todo parse each branch? inverse? this will pre-query parse to extract variables

                  // make sure it pre-compiles then parse and pull out/validate nodes.
                  precompiled = Handlebars.precompile(value)

                  const parsed = Handlebars.parse(value)

                  utils.visit(parsed, {

                    fnTest: obj => {
                      return utils.isPlainObject(obj)
                    },

                    fnObj: (obj, key, parent) => {

                      if (obj.type === 'PathExpression' && obj.original) {

                        const string = obj.original,
                              parts = utils.pathParts(string),
                              prefix = parts[0],
                              suffix = parts[1]

                        switch (prefix) {
                          case 'input':
                            if (suffix === undefined) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable' })
                            }
                            if (!variables.filter(v => v.source === Local.objectName && v.name === suffix)[0]) {
                              variables.push(ListDefinition.validateInputVariable(Local, Local.objectName, suffix))
                            }
                            break
                          case 'account':
                            if (suffix === undefined) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable' })
                            }
                            if (!variables.filter(v => v.source === Account.objectName && v.name === suffix)[0]) {
                              variables.push(ListDefinition.validateInputVariable(Account, Account.objectName, suffix))
                            }
                            break
                          case 'principal':
                            if (!~['_id', 'roles', 'email', 'name.first', 'name.last'].indexOf(suffix)) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable' })
                            }
                            break
                          case 'org':
                            if (!~['_id', 'code'].indexOf(suffix)) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable' })
                            }
                            break
                          case 'access':
                            if (suffix !== undefined) {
                              throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable' })
                            }
                            break
                          default:
                            if (parent.type === 'BlockStatement') {
                              if (['if', 'else', 'hasRole'].includes(prefix)) {
                                return
                              }
                            } else if (['json', 'hasRole'].includes(prefix)) {
                              return
                            } else if (parent.type === 'MustacheStatement') {
                              if (!variables.find(v => v.source === Local.objectName && v.name === string)) {
                                variables.push(ListDefinition.validateInputVariable(Local, Local.objectName, string))
                              }
                              return
                            }
                            throw Fault.create('cortex.invalidArgument.unspecified', { reason: '"' + string + '" is not a valid template variable or template helper' })
                        }

                        return -2
                      }
                    }

                  })

                } catch (err) {
                  return callback(err)
                }

                // add read dependencies.
                this.dependencies = variables.filter(v => v.source === Local.objectName).map(v => v.name)

                // store variables.
                this.variables = variables

                // store precompiled ast.
                this.compiled = precompiled

                this.compiler_version = semver.major(Handlebars.VERSION) + '.x.x'

                callback()
              }

            ], callback)
          }
        }
      }]
    },
    {
      label: 'Compiled',
      name: 'compiled',
      type: 'String',
      readable: false,
      dependencies: ['.where']
    },
    {
      label: 'Compiled Version',
      name: 'compiler_version',
      type: 'String',
      readable: false,
      dependencies: ['.where']
    },
    {
      label: 'Variables',
      name: 'variables',
      type: 'Document',
      canPush: false,
      canPull: false,
      array: true,
      properties: [{
        label: 'Source',
        name: 'source',
        type: 'String'
      }, {
        label: 'Name',
        name: 'name',
        type: 'String'
      }, {
        label: 'Type',
        name: 'type',
        type: 'String'
      }]
    }
  ]
}

ListDefinition.validateInputVariable = function(Source, objectName, path) {

  let name = utils.normalizeObjectPath(path, true, true, true),
      localNode = Source.schema.node,
      idx = 0,
      parts = name.split('.')

  if (name !== path) {
    throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'A variable name is not in the correct format.' })
  }

  // the path must exist in the host object and must be readable of the same type.
  while (localNode) {

    localNode = localNode.findNode(parts[idx])
    if (!localNode || !localNode.readable || localNode.readAccess > acl.AccessLevels.Script) {
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'One of the path variables does not exist' })
    } else if (localNode.array && idx < parts.length - 1) {
      // can't have arrays before the last variable path.
      throw Fault.create('cortex.invalidArgument.unspecified', { reason: 'Only the last node in a variable path can be an array (' + localNode.fullpath + ')' })
    } else if (idx === parts.length - 1) {
      // last node. it can be an array, but must be a primitive value.
      break
    }
    idx++

  }

  return {
    source: objectName,
    name: name,
    type: localNode.apiType
  }

}

ListDefinition.Handlebars = Handlebars

ListDefinition.prototype.getTypeName = function() {
  return ListDefinition.typeName
}

ListDefinition.prototype.aclWrite = function(topAc, parentDocument, value, options, callback_) {

  [options, callback_] = utils.resolveOptionsCallback(options, callback_, true, false)

  if (!this.getRuntimeOption('writeThrough', parentDocument) || !this.getRuntimeOption('sourceObject', parentDocument)) {
    return PropertyDefinition.prototype.aclWrite.call(this, topAc, parentDocument, value, options, callback_)
  }

  // normalize to entries and store natural indices to return with faults.
  let index = 0

  const inserts = [],
        updates = [],
        callback = (err) => {
          topAc.popResource()
          callback_(err)
        }

  toArray(value, true).map(value => ({ value, index: index++ }))
    .forEach(entry => {
      if (isSet(entry.value)) {
        (isSet(entry.value._id) ? updates : inserts).push(entry)
      }
    })

  topAc.pushResource(this.getResourcePath(topAc, parentDocument))

  async.waterfall([

    // prep source object and get a pre-match if we need one.
    callback => {

      this._createBaseContext(topAc.principal, parentDocument, (err, baseCtx, Source) => {
        if (err) {
          return callback(err)
        }
        if (updates.length === 0) {
          return callback(null, Source, null)
        }
        this._readInputVariables(Source, topAc, topAc.subject, baseCtx, (err, entryCtx) => {
          if (err) {
            return callback(err)
          }
          this._getPreMatch(topAc, entryCtx, (err, preMatch) => {
            callback(err, Source, preMatch)
          })
        })
      })

    },

    (Source, preMatch, callback) => {

      let doSidebandUpdate = false

      // linked references are implicitly non-writable
      if (this.linkedReferences.length) {
        inserts.forEach(({ value }) => this.linkedReferences.forEach(ref => delete value[ref.target]))
        updates.forEach(({ value }) => this.linkedReferences.forEach(ref => delete value[ref.target]))
      }

      const writeErrors = []

      if (inserts.length === 0 && updates.length === 0) {
        return callback()
      }

      async.series([

        // inserts
        callback => {

          if (inserts.length === 0) {
            return callback()
          }

          this.transformAccessContext(topAc, parentDocument, { forWrite: true }, (err, ac) => {
            if (err) {
              writeErrors.push(err)
              return callback()
            }
            const writeOptions = {
              method: ac.method,
              script: ac.script,
              locale: ac.getLocale(false, false), // set locale only if explicitly set in the current context
              req: ac.req,
              grant: Math.max(this.getRuntimeOption('grant', parentDocument), ac.grant),
              roles: utils.idArrayUnion(this.roles, ac.instance_roles),
              skipAcl: this.skipAcl || ac.principal.skipAcl,
              defaultAcl: toArray(this.getRuntimeOption('defaultAcl', parentDocument)),
              defaultAclOverride: this.defaultAclOverride,
              createAcl: toArray(this.getRuntimeOption('createAcl', parentDocument)),
              createAclOverride: this.createAclOverride,
              dryRun: ac.dryRun,
              returnAcs: true,
              passive: ac.passive,
              resourcePath: ac.getResource(),
              bypassCreateAcl: isSet(this.getRuntimeOption('implicitCreateAccessLevel', parentDocument)) && ac.hasAccess(this.getRuntimeOption('implicitCreateAccessLevel', parentDocument))
            }

            if (this.linkedReferences.length) {

              writeOptions.beforeWrite = (ac, payload, callback) => {

                // write the linked reference for trigger subjects
                if (!Source.isUnmanaged) {
                  const $linked = ac.subject.$__linked || (ac.subject.$__linked = {})
                  this.linkedReferences.forEach(ref => {
                    if (ref.source === '_id') {
                      $linked[ref.target] = parentDocument
                    } else {
                      $linked[ref.target] = utils.path(parentDocument.$__linked, ref.source)
                    }
                  })
                }

                // for new items, write the references.
                let missing = []
                this.linkedReferences.forEach(ref => {
                  const _id = getIdOrNull(parentDocument[ref.source], true)
                  if (!_id) {
                    missing.push(ref.source)
                  } else {
                    const targetNode = ac.object.schema.node.findNode(ref.target)
                    if (!targetNode) {
                      missing.push(ref.source)
                    } else {
                      const targetRef = {
                        _id: getIdOrNull(parentDocument[ref.source], true)
                      }

                      if (targetNode.sourceObject === '') {
                        if (ref.source === '_id') {
                          targetRef.object = topAc.object.objectName
                        } else {
                          const sourceNode = topAc.object.findNode(ref.source)
                          if (!sourceNode || !sourceNode.sourceObject) {
                            missing.push(ref.source)
                          } else if (_.isFunction(sourceNode.sourceObject)) {
                            return callback(Fault.create('cortex.invalidArgument.unspecified', {
                              resource: ac.getResource(),
                              path: this.fqpp,
                              reason: `Invalid dynamic source object for linked reference ${sourceNode.fqpp}`
                            }))
                          } else {
                            targetRef.object = sourceNode.sourceObject
                          }
                        }
                      }
                      ac.subject[ref.target] = targetNode.getTypeName() === 'Reference' ? targetRef : targetRef._id
                    }
                  }
                })
                if (missing.length) {
                  return callback(Fault.create('cortex.invalidArgument.unspecified', {
                    resource: ac.getResource(),
                    path: this.fqpp,
                    reason: `Missing linkedReference(s): ${missing}`
                  }))
                }
                async.each(
                  this.linkedReferences.reduce((nodes, ref) => {
                    return nodes.concat(Source.schema.node.findTypedNode(ref.target, true))
                  }, []),
                  (node, callback) => node.forceImmediateIndexRebuild(ac, ac.subject, callback),
                  callback
                )

              }

            }

            Source.aclCreateMany(ac.principal, inserts.map(({ value }) => value), writeOptions, (err, results) => {

              if (err) {
                writeErrors.push(err)
                err = null
              }
              if (results) {
                if (ac.dryRun) {
                  const $inplace = topAc.subject.$__inplace || (topAc.subject.$__inplace = {})
                  let arr = utils.path($inplace, this.docpath)
                  if (!Array.isArray(arr)) {
                    utils.path($inplace, this.docpath, [])
                  }
                  arr = toArray(utils.path($inplace, this.docpath))
                  results.accessContexts.forEach(ac => arr.push(ac.subject))
                } else if (results.insertedIds.length && this.getRuntimeOption('updateOnWriteThrough', parentDocument)) {
                  doSidebandUpdate = true
                }
                if (results.writeErrors.length) {
                  writeErrors.push(...results.writeErrors.map(err => {
                    // map errors back to insert order.
                    const entry = inserts[err.index]
                    err.index = entry ? entry.index : Undefined
                    return err
                  }))
                }
              }
              callback()
            })

          })

        },

        // updates
        callback => {

          async.eachSeries(
            updates,
            ({ index, value }, callback) => {

              this.transformAccessContext(topAc, parentDocument, { forWrite: true }, (err, ac) => {
                if (err) {
                  err.index = index
                  writeErrors.push(err)
                  return callback()
                }
                const writeOptions = {
                        method: ac.method,
                        script: ac.script,
                        locale: ac.getLocale(false, false), // set locale only if explicitly set in the current context
                        req: ac.req,
                        grant: Math.max(this.getRuntimeOption('grant', parentDocument), ac.grant),
                        roles: utils.idArrayUnion(this.roles, ac.instance_roles),
                        skipAcl: this.skipAcl || ac.principal.skipAcl,
                        defaultAcl: toArray(this.getRuntimeOption('defaultAcl', parentDocument)),
                        defaultAclOverride: this.defaultAclOverride,
                        createAcl: toArray(this.getRuntimeOption('createAcl', parentDocument)),
                        createAclOverride: this.createAclOverride,
                        dryRun: ac.dryRun,
                        passive: ac.passive,
                        resourcePath: ac.getResource()
                      },
                      _id = value._id

                if (this.linkedReferences.length) {
                  writeOptions.beforeWrite = (ac, payload, callback) => {

                    // write the linked reference for trigger subjects
                    const $linked = ac.subject.$__linked || (ac.subject.$__linked = {})
                    this.linkedReferences.forEach(ref => {
                      if (ref.source === '_id') {
                        $linked[ref.target] = parentDocument
                      } else {
                        $linked[ref.target] = utils.path(parentDocument.$__linked, ref.source)
                      }
                    })
                    callback()
                  }
                }

                delete value._id
                Source.aclUpdate(ac.principal, assignId(preMatch, _id), value, writeOptions, (err, { resultAc, modified }) => {
                  if (err) {
                    err.index = index
                    writeErrors.push(err)
                    return callback()
                  }
                  if (modified.length && this.getRuntimeOption('updateOnWriteThrough', parentDocument)) {
                    doSidebandUpdate = true
                  }
                  if (ac.dryRun) {
                    const $inplace = topAc.subject.$__inplace || (topAc.subject.$__inplace = {})
                    let arr = utils.path($inplace, this.docpath)
                    if (!Array.isArray(arr)) {
                      utils.path($inplace, this.docpath, [])
                    }
                    arr = toArray(utils.path($inplace, this.docpath))
                    arr.push(resultAc.subject)
                  }
                  callback()
                })

              })
            },
            callback
          )

        }

      ], err => {

        if (err) {
          writeErrors.push(err)
        }
        if (writeErrors.length > 0) {
          err = Fault.create('cortex.error.listWriteThrough', { resource: topAc.getResource(), faults: writeErrors, path: this.fullpath })
        }
        if (doSidebandUpdate) {
          const mod = topAc.option('$readableModified') || []
          mod.push(this.fullpath)
          topAc.option('$readableModified', mod)
          return topAc.sidebandUpdate({ updated: new Date(), updater: { _id: topAc.principal._id } }, {}, sidebandErr => {
            callback(err || sidebandErr)
          })
        } else {
          callback(err)
        }
      })

    }

  ], callback)

}

ListDefinition.prototype.aclRemove = function(topAc, parentDocument, value, callback_) {

  value = String(value)
  const idx = value.indexOf('.'),
        prefix = ~idx ? value.substr(0, idx) : value,
        suffix = ~idx ? value.substr(idx + 1) : undefined,
        callback = (err) => {
          topAc.popResource()
          callback_(err)
        }

  if (!this.getRuntimeOption('writeThrough', parentDocument) || !this.getRuntimeOption('sourceObject', parentDocument) || !utils.isIdFormat(prefix)) {
    return PropertyDefinition.prototype.aclRemove.call(this, topAc, parentDocument, value, callback_)
  }

  topAc.pushResource(this.getResourcePath(topAc, parentDocument))

  this._createBaseContext(topAc.principal, parentDocument, (err, baseCtx, Source) => {
    if (err) {
      return callback(err)
    }
    this._readInputVariables(Source, topAc, topAc.subject, baseCtx, (err, entryCtx) => {
      if (err) {
        return callback(err)
      }
      this._getPreMatch(topAc, entryCtx, (err, preMatch) => {
        if (err) {
          return callback(err)
        }
        this.transformAccessContext(topAc, parentDocument, { forWrite: true }, (err, ac) => {
          if (err) {
            return callback(err)
          }
          const removeOptions = {
            method: ac.method,
            script: ac.script,
            req: ac.req,
            locale: ac.getLocale(false, false), // set locale only if explicitly set in the current context
            grant: Math.max(this.getRuntimeOption('grant', parentDocument), ac.grant),
            roles: utils.idArrayUnion(this.roles, ac.instance_roles),
            skipAcl: this.skipAcl || ac.principal.skipAcl,
            defaultAcl: toArray(this.getRuntimeOption('defaultAcl', parentDocument)),
            defaultAclOverride: this.defaultAclOverride,
            dryRun: ac.dryRun,
            passive: ac.passive,
            resourcePath: ac.getResource()
          }
          if (suffix) {
            Source.aclRemovePath(ac.principal, assignId(preMatch, prefix), suffix, removeOptions, (err, { ac, modified }) => {
              if (!err && modified.length && this.getRuntimeOption('updateOnWriteThrough', parentDocument)) {
                topAc.subject.updated = Date.now()
                topAc.subject.updater = { _id: ac.principal._id }
              }
              callback(Fault.from(err), modified)
            })
          } else {
            Source.aclDelete(ac.principal, assignId(preMatch, prefix), removeOptions, err => {
              if (!err && this.getRuntimeOption('updateOnWriteThrough', parentDocument)) {
                topAc.subject.updated = Date.now()
                topAc.subject.updater = { _id: ac.principal._id }
              }
              callback(Fault.from(err), true)
            })
          }
        })

      })
    })
  })

}

ListDefinition.prototype.apiSchema = function(options) {

  const schema = PropertyDefinition.prototype.apiSchema.call(this, options)
  if (schema) {

    if (this.grant > acl.AccessLevels.None) {
      schema.grant = this.getRuntimeOption('grant')
    }
    if (this.roles.length) {
      schema.roles = this.roles
    }
    if (this.getRuntimeOption('sourceObject')) {
      schema.sourceObject = this.getRuntimeOption('sourceObject')
    }
    if (this.readThrough) {
      schema.readThrough = this.readThrough
    }
    if (this.writeThrough) {
      schema.writeThrough = this.getRuntimeOption('writeThrough')
      schema.updateOnWriteThrough = this.getRuntimeOption('updateOnWriteThrough')
    }
    schema.defaultAcl = toArray(this.getRuntimeOption('defaultAcl')).map(entry => _.omit(entry, '_id'))
    schema.createAcl = toArray(this.getRuntimeOption('createAcl')).map(entry => _.omit(entry, '_id'))
    schema.inheritInstanceRoles = this.getRuntimeOption('inheritInstanceRoles')
    schema.inheritPropertyAccess = this.getRuntimeOption('inheritPropertyAccess')
    schema.accessTransforms = this.accessTransforms.map(entry => _.omit(entry, '_id'))

    if (this.linkedReferences.length) {
      schema.linkedReferences = this.linkedReferences.slice()
    }

  }
  return schema

}

ListDefinition.prototype.export = async function() {
  return Undefined
}

ListDefinition.prototype.import = async function() {
  return Undefined
}

module.exports = ListDefinition
