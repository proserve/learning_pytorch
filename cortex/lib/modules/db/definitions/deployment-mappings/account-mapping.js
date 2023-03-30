'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      consts = require('../../../../consts'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules')

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.account
  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback()
  }

  rollback(ac, backup, data, callback) {
    callback()
  }

  createBackup(ac, callback) {
    callback()
  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback()
  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.name.first = doc.name.first
    mapping.name.last = doc.name.last
    mapping.email = doc.email
    mapping.mobile = doc.mobile
    mapping.roles = doc.roles.filter(role => utils.inIdArray([acl.OrgAdminRole, acl.OrgDeveloperRole], role))
  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const searchRoles = [acl.OrgAdminRole, acl.OrgDeveloperRole],
          where = {
            $or: [{
              mobile: { $in: filteredMappings.map(mapping => mapping.source.mobile) }
            }, {
              email: { $in: filteredMappings.map(mapping => mapping.source.email) }
            }, {
              roles: { $in: searchRoles }
            }].concat(filteredMappings.map(mapping => ({
              'name.first': mapping.source.name.first,
              'name.last': mapping.source.name.last
            })))
          },
          paths = ['name', 'email', 'mobile', 'roles'],
          addTarget = (mapping, match, type) => {
            if (!utils.findIdInArray(mapping.targets, '_id', match._id)) {
              mapping.targets.push(utils.extend({ matchType: type }, match))
            }
          }

    modules.db.models.Account.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, where: where, paths: paths, skipAcl: true, json: true, grant: acl.AccessLevels.System }, (err, docs) => {
      if (!err) {
        filteredMappings.forEach(mapping => {
          mapping.targets.splice(0)
          docs.data.filter(doc => doc.email === mapping.source.email).forEach(match => {
            addTarget(mapping, match, 'Email')
          })
          docs.data.filter(doc => doc.mobile === mapping.source.mobile).forEach(match => {
            addTarget(mapping, match, 'Mobile')
          })
          docs.data.filter(doc => utils.inIdArray(mapping.source.roles, acl.OrgAdminRole) && utils.inIdArray(doc.roles, acl.OrgAdminRole)).forEach(match => {
            addTarget(mapping, match, 'Matching Administrator Role')
          })
          docs.data.filter(doc => utils.inIdArray(mapping.source.roles, acl.OrgDeveloperRole) && utils.inIdArray(doc.roles, acl.OrgDeveloperRole)).forEach(match => {
            addTarget(mapping, match, 'Matching Developer Role')
          })
          docs.data.filter(doc => utils.inIdArray(doc.roles, acl.OrgAdminRole)).forEach(match => {
            addTarget(mapping, match, 'Administrator Role')
          })
          docs.data.filter(doc => utils.inIdArray(doc.roles, acl.OrgDeveloperRole)).forEach(match => {
            addTarget(mapping, match, 'Developer Role')
          })
        })
      }
      callback(err)
    })

  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback() // account do not actually get deployed
  }

  getSourceMappingDocs(ac, configuration, callback) {

    const paths = [
      'name',
      'email',
      'mobile',
      'roles'
    ]
    this.getSelectedDocsForObject(ac, 'Account', configuration, { paths: paths }, (err, docs) => {
      callback(err, docs)
    })
  }

  // ----------------------------------------------------------------------------------

  static getProperties() {
    return [{
      label: 'Name',
      name: 'name',
      type: 'Document',
      properties: [{
        label: 'First',
        name: 'first',
        type: 'String'
      }, {
        label: 'Last',
        name: 'last',
        type: 'String'
      }]
    }, {
      label: 'Email',
      name: 'email',
      type: 'String'
    }, {
      label: 'Mobile',
      name: 'mobile',
      type: 'String'
    }, {
      label: 'Dev Roles',
      name: 'roles',
      type: 'ObjectId',
      array: true
    }]
  }

}

module.exports = Mapping
