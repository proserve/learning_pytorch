'use strict'

const Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      consts = require('../consts'),
      acl = require('../acl'),
      modules = require('./'),
      builtInViews = {

        'number-of-user-accounts': {
          name: 'c_number-of-user-accounts',
          label: 'Number of accounts',
          sourceObject: consts.NativeIds.account,
          skip: {
            settable: false
          },
          limit: {
            settable: false
          },
          principal: acl.PublicIdentifier,
          acl: [{
            target: acl.OrgDeveloperRole,
            type: acl.AccessTargets.OrgRole,
            allow: acl.AccessLevels.Public
          }, {
            target: acl.OrgSupportRole,
            type: acl.AccessTargets.OrgRole,
            allow: acl.AccessLevels.Public
          }],
          objectAcl: [{
            target: acl.PublicIdentifier,
            type: acl.AccessTargets.Account,
            allow: acl.AccessLevels.Read
          }],
          query: [{
            name: 'where',
            value: JSON.stringify({
              $and: [{
                created: {
                  $gte: '{{createdOnOrAfter}}'
                }
              }, {
                created: {
                  $lte: '{{createdOnOrBefore}}'
                }
              }]
            }),
            settable: false
          }, {
            name: 'group',
            value: JSON.stringify({
              _id: null,
              count: { '$count': '_id' }
            }),
            settable: false
          }]
        },

        'number-of-logins-since': function(principal, callback) {

          const data = {
            name: 'c_number-of-logins-since',
            label: 'Logins Since Period Start',
            sourceObject: consts.NativeIds.account,
            skip: {
              settable: true
            },
            limit: {
              settable: true
            },
            principal: null,
            acl: [{
              target: acl.OrgDeveloperRole,
              type: acl.AccessTargets.OrgRole,
              allow: acl.AccessLevels.Public
            }, {
              target: acl.OrgSupportRole,
              type: acl.AccessTargets.OrgRole,
              allow: acl.AccessLevels.Public
            }],
            query: [{
              name: 'where',
              value: JSON.stringify({
                'stats.lastLogin.time': {
                  $gte: '{{since}}'
                }
              }),
              settable: false
            }, {
              name: 'group',
              value: JSON.stringify({
                _id: null,
                count: { '$count': '_id' }
              }),
              settable: false
            }]
          }

          modules.db.models.view.generate(principal, data, function(err, view) {
            if (!err) {
              view.objectAcl = [{
                target: acl.PublicIdentifier,
                type: acl.AccessTargets.Account,
                allow: acl.AccessLevels.System
              }]
            }
            callback(err, view)
          })

        }

      }

class ViewsModule {

  constructor() {
    return ViewsModule
  }

  static runView(principal, name, options, callback) {

    const viewData = builtInViews[(String(name) || '').toLowerCase()]
    if (!viewData) {
      return callback(Fault.create('cortex.notFound.view', { path: name }))
    }

    if (_.isFunction(viewData)) {
      viewData(principal, function(err, view) {
        if (err) {
          return callback(err)
        }
        modules.db.models.view.viewRun(principal, view, options, function(err, docs) {
          callback(err, docs)
        })
      })
    } else {
      modules.db.models.view.generate(principal, viewData, function(err, view) {
        if (err) {
          return callback(err)
        }
        modules.db.models.view.viewRun(principal, view, options, function(err, docs) {
          callback(err, docs)
        })
      })
    }

  }

}

module.exports = ViewsModule
