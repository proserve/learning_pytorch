'use strict'

const modules = require('../../modules')

module.exports = function(orgId, callback) {

  modules.db.models.template.installOrgTemplates(orgId, { overwrite: true }, function(err) {
    callback(err)
  })
}
