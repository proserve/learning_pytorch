'use strict'

const acl = require('../../../acl'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      consts = require('../../../consts'),
      modules = require('../../../modules'),
      Fault = require('cortex-service/lib/fault'),
      local = {
        _definitions: null
      }
Object.defineProperty(local, 'definitions', { get: function() { return (this._definitions || (this._definitions = require('./index'))) } })

// @todo some mappings, like account, have no requirement for versioning because they have no data.
// @todo when deploying apps, how do we ensure keys are not re-used across orgs.

class BaseDefinition {

  static getProperties() {
    return [
      {
        label: '_id',
        name: '_id',
        type: 'ObjectId',
        auto: false
      },
      {
        label: 'Type',
        name: 'type',
        type: 'String',
        creatable: true
      },
      {
        label: 'Explicitly Selected',
        name: 'selected',
        type: 'Boolean',
        default: false
      },
      {
        label: 'Dependencies',
        name: 'dependencies',
        type: 'Document',
        array: true,
        maxItems: -1,
        properties: [{
          label: '_id',
          name: '_id',
          type: 'ObjectId',
          auto: false
        }, {
          label: 'Type',
          name: 'type',
          type: 'String'
        }]
      },
      // mapping properties for each type are added to source and target sets.
      {
        label: 'Source',
        name: 'source',
        type: 'Document',
        properties: []
      },
      // mapping payload for deployment
      {
        label: 'Payload',
        name: 'payload',
        type: 'Any',
        serializeData: false,
        readable: false
      },
      // target mappings are ordered
      {
        label: 'Targets',
        name: 'targets',
        type: 'Document',
        array: true,
        properties: [{
          label: 'Identifier',
          name: '_id',
          type: 'ObjectId'
        }, {
          label: 'Match Type',
          name: 'matchType',
          type: 'String'
        }]
      },
      // selected target (which must come from a target mapping or be emptyId)
      {
        label: 'Target',
        name: 'target',
        type: 'ObjectId',
        dependencies: ['.targets', 'stage'],
        writable: true,
        validators: [{
          name: 'adhoc',
          definition: {
            message: 'The deployment is in the wrong stage.',
            validator: function(ac, node, value) {
              return ~['Target Mappings', 'Deployment'].indexOf(modules.db.getRootDocument(this).stage)
            }
          }
        }, {
          name: 'adhoc',
          definition: {
            message: 'The target must exist as an available target mapping',
            validator: function(ac, node, value) {
              return ~utils.findIdPos(this.targets, '_id', value) || (utils.equalIds(consts.emptyId, value) && this.targets.length === 0)
            }
          }
        }]
      }
    ]
  }

  addStubMapping(ac, type, mappings, doc, selected) {

    if (_.isString(type)) {
      type = modules.db.definitions.mappingDefinitions[type]
    }
    mappings.push({
      _id: doc._id,
      type: type.mappingTypeName,
      selected: selected,
      dependencies: type.getDependencies(ac, doc)
    })
    return mappings[mappings.length - 1]
  }

  getDependencies(ac, doc) {
    return []
  }

  _addAclDependencies(entries, dependencies) {

    utils.array(entries).forEach(doc => {
      let principal = doc.target
      if (utils.couldBeId(principal)) {
        if (doc.type === acl.AccessTargets.Account) {
          if (!acl.isBuiltInPrincipal(principal)) {
            dependencies[principal] = consts.deployment.mapping.types.account
          }
        } else if (doc.type === acl.AccessTargets.OrgRole) {
          if (!acl.isBuiltInPrincipal(principal)) {
            dependencies[principal] = consts.deployment.mapping.types.role
          }
        }
      }
      principal = doc.allow
      if (utils.couldBeId(principal)) {
        if (doc.type === acl.AccessTargets.Account) {
          if (!acl.isBuiltInPrincipal(principal)) {
            dependencies[principal] = consts.deployment.mapping.types.account
          }
        } else if (doc.type === acl.AccessTargets.OrgRole) {
          if (!acl.isBuiltInPrincipal(principal)) {
            dependencies[principal] = consts.deployment.mapping.types.role
          }
        }
      }
    })

  }

  _addRoleDependencies(entries, dependencies) {

    utils.array(entries).forEach(roleId => {
      if (utils.couldBeId(roleId)) {
        if (!acl.isBuiltInRole(roleId)) {
          dependencies[roleId] = consts.deployment.mapping.types.role
        }
      }
    })

  }

  shouldRemap(ac, deploymentObject, mappingConfig, modified) {

    const paths = ['configuration.' + this.mappingTypeName + '.ids', 'configuration.' + this.mappingTypeName + '.select']

    return _.intersection(paths, modified).length > 0

  }

  createBackup(ac, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  rollback(ac, backup, data, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  updateMapping(ac, mappings, mapping, doc, callback) {
    throw Fault.create('cortex.error.pureVirtual')
  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  getSourceMappingDocs(ac, configuration, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  };

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback(Fault.create('cortex.error.pureVirtual'))
  }

  findMapping(sourceId, mappings, types) {
    types = utils.array(types, true)
    return _.find(mappings, mapping => utils.equalIds(sourceId, mapping._id) && ~types.indexOf(mapping.type))
  }

  mapAclToTarget(org, mappings, sourceAcl, forCreate) {

    return utils.array(sourceAcl).map(doc => {

      const out = { type: doc.type }
      let principal

      if (!forCreate) {
        if (utils.couldBeId(doc.allow)) {
          // roles have a did once they have been deployed. the mapping doesn't necessarily have a target for it's role (could have been create new).
          principal = utils.path(_.find(org.roles, role => utils.inIdArray(role.did, doc.allow)), '_id')
          if (principal) {
            out.allow = principal
          } else {
            return null
          }
        } else {
          out.allow = doc.allow
        }
      }

      if (utils.couldBeId(doc.target)) {
        principal = doc.target
        if (doc.type === acl.AccessTargets.Account) {
          if (!acl.isBuiltInPrincipal(doc.target)) {
            // mappings for accounts should always exist.
            principal = utils.path(this.findMapping(doc.target, mappings, consts.deployment.mapping.types.account), 'target')
          }
        } else if (doc.type === acl.AccessTargets.OrgRole) {
          if (!acl.isBuiltInPrincipal(doc.target)) {
            // roles have a did once they have been deployed. the mapping doesn't necessarily have a target for it's role (could have been create new).
            principal = utils.path(_.find(org.roles, role => utils.inIdArray(role.did, doc.target)), '_id')
          }
        } else {
          principal = null
        }

        if (principal) {
          out.target = principal
        } else {
          return null
        }
      } else if (utils.isInt(doc.target)) {
        out.target = doc.target
      }
      return out

    }).filter(doc => !!doc)
  }

  mapRolesToTarget(org, mappings, sourceRoles) {

    // roles have a did once they have been deployed. the mapping doesn't necessarily have a target for it's role (could have been create new).
    return utils.array(sourceRoles).map(sourceRoleId => {
      if (acl.isBuiltInRole(sourceRoleId)) {
        return sourceRoleId
      } else {
        return utils.path(_.find(org.roles, role => utils.inIdArray(role.did, sourceRoleId)), '_id')
      }
    }).filter(doc => !!doc)
  }

  getSelectedDocsForObject(ac, modelName, configuration, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

    const Model = modules.db.models[modelName],
          idField = options.idField || '_id'

    let find = utils.extend(options.find, { org: ac.orgId })

    if (!options.notReapable) {
      find.reap = false
    }

    if (!options.inCustomCollection) {
      find.object = Model.objectName
    }

    switch (configuration.select) {

      case consts.deployment.selections.all:
        break

      case consts.deployment.selections.include:
        if (configuration.ids.length) {
          find[idField] = { $in: configuration.ids }
        } else {
          find = null
        }
        break

      case consts.deployment.selections.exclude:
        if (configuration.ids.length) {
          find[idField] = { $nin: configuration.ids }
        }
        break

      case consts.deployment.selections.none:
      default:
        find = null
        break

    }

    if (find) {
      const paths = _.uniq(['_id', 'acl', 'sequence', 'creator', 'owner', 'updater', idField].concat(utils.array(options.paths))).join(' ')
      Model.find(find).lean().select(paths).exec((err, docs) => {

        if (!err && idField !== '_id') {
          docs.forEach(doc => {
            doc._id = doc[idField]
          })
        }

        callback(err, docs)
      })
      return
    }
    callback(null, [])

  }

}

module.exports = BaseDefinition
