'use strict'

const async = require('async'),
      server = require('./server')

let called = false,
    completed =
    false,
    instanceErr,
    instanceAc,
    objectAc

module.exports = function(ac, callback) {

  if (called) {
    async.whilst(
      () => !completed,
      callback => {
        setTimeout(callback, 10)
      },
      () => {
        callback(instanceErr, instanceAc, objectAc)
      }
    )
    return
  }
  called = true

  const acl = require('../../lib/acl'),
        modules = require('../../lib/modules/index')

  async.waterfall([

    // create a custom object extension.
    callback => {
      modules.db.models.Object.aclCreate(server.principals.admin, {
        name: 'c_thingamahoozit',
        label: 'Thing-a-Ma-Hoozit',
        defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
        createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
        shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
        properties: [{
          label: 'Name',
          name: 'c_name',
          type: 'String',
          writable: true,
          readAccess: acl.AccessLevels.Connected
        }, {
          label: 'Custom',
          name: 'c_custom',
          type: 'String',
          writable: true,
          indexed: true,
          readAccess: acl.AccessLevels.Connected
        }, {
          label: 'Read',
          name: 'c_must_have_read',
          type: 'String',
          writable: true,
          indexed: true,
          readAccess: acl.AccessLevels.Read
        }, {
          label: 'Read',
          name: 'c_must_have_read_doc',
          type: 'Document',
          writable: true,
          readAccess: acl.AccessLevels.Read,
          properties: [{
            label: 'Read',
            name: 'c_must_have_read',
            type: 'String',
            writable: true,
            indexed: true,
            readAccess: acl.AccessLevels.Read
          }]
        }, {
          label: 'Unindexed',
          name: 'c_unindexed',
          type: 'String',
          writable: true,
          indexed: false,
          readAccess: acl.AccessLevels.Read
        }]
      }, (err, { ac }) => callback(err, ac))
    },

    // reload the org so the new object is detected.
    (objectAc, callback) => {
      server.updateOrg(err => {
        callback(err, objectAc)
      })
    },

    // store in instance.
    (objectAc, callback) => {
      ac.org.createObject('c_thingamahoozit', function(err, object) {
        if (err) return callback(err)
        object.aclCreate(ac.principal, {
          c_name: 'A-Hoozit',
          c_custom: 'custom',
          c_must_have_read: 'secret sauce',
          c_must_have_read_doc: {
            c_must_have_read: 'more secrets'
          },
          c_unindexed: 'woe is me'
        }, (err, { ac }) => {
          callback(err, ac, objectAc)
        })
      })
    }

  ], (err, _ac, _oac) => {
    completed = true
    instanceErr = err
    instanceAc = _ac
    objectAc = _oac
    callback(instanceErr, instanceAc, objectAc)
  })

}
