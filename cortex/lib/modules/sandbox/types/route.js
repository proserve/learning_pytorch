'use strict'

const BaseScriptType = require('./base'),
      util = require('util'),
      firstBy = require('thenby'),
      { findIdInArray, rNum, isCustomName, path: pathTo, matchesEnvironment, array: toArray } = require('../../../utils'),
      consts = require('../../../consts'),
      crypto = require('crypto'),
      AclDefinition = require('../../../modules/db/definitions/acl-definition'),
      { findIndex, isString, pick } = require('underscore')

function RouteScriptType() {
  BaseScriptType.call(this)
}

util.inherits(RouteScriptType, BaseScriptType)

RouteScriptType.prototype.parseResources = async function(ac, doc, { includeSelf = true } = {}) {

  const resources = await BaseScriptType.prototype.parseResources.call(this, ac, doc)

  if (includeSelf) {
    resources.push({
      metadata: {
        runtime: false,
        scriptId: doc._id,
        scriptHash: doc.compiledHash,
        resource: ac.getResource(),
        requires: doc.requires,
        roles: [],
        serviceAccounts: doc.serviceAccounts
      },
      ...pick(doc, 'active', 'type', 'label', 'name', 'principal', 'environment', 'weight', 'if'),
      configuration: pick(doc.configuration, 'authValidation', 'urlEncoded', 'plainText', 'apiKey', 'path', 'method', 'priority', 'acl', 'system')
    })
  }

  return resources
}

RouteScriptType.prototype.buildRuntime = async function(ac, runtime, scripts) {

  // look for routes and order them by script.weight.
  // if there are any with matching names, store only the one with a higher script.weight.
  for (const script of scripts) {

    const routes = toArray(script.resources).filter(doc => doc.type === 'route')

    for (const insert of routes) {

      if (insert.active && matchesEnvironment(insert.environment)) {
        const pos = findIndex(runtime.routes, v => v.name && insert.name && v.name === insert.name),
              existing = runtime.routes[pos]

        if (!existing) {
          runtime.routes.push(insert)
        } else {

          if (insert.configuration.method !== existing.configuration.method || insert.configuration.path !== existing.configuration.path) {
          // @todo issue warning?
          }

          if (rNum(insert.weight, 0) > rNum(existing.weight, 0)) {
            runtime.routes.splice(pos, 1, insert)
          }
        }
      }
    }

  }

  // routes are sorted by script#route.configuration.priority first. (higher first)
  runtime.routes.sort(

    firstBy((a, b) =>
      rNum(b.configuration.priority, 0) - rNum(a.configuration.priority, 0)
    )
      .thenBy((a, b) =>
        rNum(b.weight, 0) - rNum(a.weight, 0)
      )

  )

}

function calculateHash(orgId, path, method) {

  // sort the content array by name, then hash the content data.
  var shasum = crypto.createHash('sha1')
  shasum.update([orgId, 'Route', path, method].join('_'))
  return shasum.digest('hex')
}

RouteScriptType.prototype.getTypeProperties = function() {

  return [
    {
      label: 'Runtime Caller Auth Validation',
      name: 'authValidation',
      type: 'String',
      writable: true,
      default: 'legacy',
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['legacy', 'all', 'none']
        }
      }]
    },
    {
      label: 'Parse Url-Encoded',
      name: 'urlEncoded',
      type: 'Boolean',
      writable: true,
      default: false
    },
    {
      label: 'System Route',
      name: 'system',
      type: 'Boolean',
      creatable: true,
      default: false
    },
    {
      label: 'Parse Plain Text',
      name: 'plainText',
      type: 'Boolean',
      writable: true,
      default: false
    },
    {
      label: 'API Key',
      name: 'apiKey',
      type: 'ObjectId',
      writable: true,
      default: null,
      writer: function(ac, node, value) {

        if (typeof value === 'string') {
          if (isCustomName(value)) {
            const found = ac.org.apps.find(app => app.name === value)
            if (found) {
              return found._id
            }
          } else if (value.length === consts.API_KEY_LENGTH) {
            const found = ac.org.apps.find(app => pathTo(app.clients, '0.key') === value)
            if (found) {
              return found._id
            }
          }
        }
        return value

      },
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'An existing app',
          validator: function(ac, node, value) {
            if (value == null) {
              return true
            }
            return !!findIdInArray(ac.org.apps, '_id', value)
          }
        }
      }]
    },
    {
      // @todo path, including params?
      // @todo must be unique to org.
      label: 'Path',
      name: 'path',
      type: 'String',
      writable: true,
      nativeIndex: true,
      writer: function(ac, node, value) {
        this.scriptHash = calculateHash(ac.orgId, String(value), this.configuration.method)
        return value
      },
      validators: [{
        name: 'adhoc',
        definition: {
          message: 'A valid path',
          validator: function(ac, node, value) {

            if (!isString(value)) {
              return false
            }

            // @todo: validate the path using express.
            return true
          }
        }
      }, {
        name: 'adhoc',
        definition: {
          code: 'cortex.conflict.exists',
          message: 'A route script already exists for this path and method.',
          validator: function(ac, node, v, callback) {
            var search = { org: ac.orgId, object: 'script', reap: false, type: 'route', 'configuration.path': String(v), 'configuration.method': String(this.configuration.method), _id: { $ne: ac.subjectId } }
            ac.object.findOne(search).lean().select('_id').exec(function(err, doc) {
              callback(err, !(err || doc))
            })
          },
          skip: function(ac, node) {
            return ac.option(`skip.validator:${node.fqpp}`)
          }
        }
      }]
    },
    {
      label: 'Method',
      name: 'method',
      type: 'String',
      writable: true,
      lowercase: true,
      trim: true,
      writer: function(ac, node, value) {
        this.scriptHash = calculateHash(ac.orgId, this.configuration.path, value)
        return value
      },
      validators: [{
        name: 'stringEnum',
        definition: {
          values: ['*', 'get', 'patch', 'post', 'put', 'delete']
        }
      }, {
        name: 'adhoc',
        definition: {
          code: 'cortex.conflict.exists',
          message: 'A route script already exists for this path and method.',
          validator: function(ac, node, v, callback) {
            var search = { org: ac.orgId, object: 'script', type: 'route', 'configuration.method': String(v), 'configuration.path': String(this.configuration.path), _id: { $ne: ac.subjectId } }
            ac.object.findOne(search).lean().select('_id').exec(function(err, doc) {
              callback(err, !(err || doc))
            })
          },
          skip: function(ac, node) {
            return ac.option(`skip.validator:${node.fqpp}`)
          }
        }
      }]
    },
    {
      // ordered asc
      label: 'Priority',
      name: 'priority',
      type: 'Number',
      writable: true,
      default: 0
    },
    new AclDefinition({
      label: 'Acl',
      name: 'acl',
      type: 'Document',
      public: true,
      array: true,
      readable: true,
      writable: true,
      maxItems: 50,
      canPush: true,
      canPull: true,
      includeId: true,
      forCreate: true,
      withExpressions: true
    })
  ]

}

module.exports = RouteScriptType
