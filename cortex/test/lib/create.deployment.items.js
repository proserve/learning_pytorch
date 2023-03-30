'use strict'

const async = require('async'),
      _ = require('underscore'),
      server = require('./server')

module.exports = function(newOrg, callback) {

  if (_.isFunction(newOrg)) {
    callback = newOrg
    newOrg = server
  } else {
    newOrg = newOrg || server
  }

  const acl = require('../../lib/acl'),
        modules = require('../../lib/modules/index'),
        utils = require('../../lib/utils'),
        Script = modules.db.models.Script,
        textFilePointer = new modules.storage.FilePointer(null, { path: `${__dirname}/../files/plain.txt`, mime: 'text/plain' }, new acl.AccessContext(newOrg.principals.admin))

  let roleId = null

  async.waterfall([

    // create a test template
    callback => {

      newOrg.sessions.admin
        .post(newOrg.makeEndpoint('/templates/email'))
        .set(newOrg.getSessionHeaders())
        .send({ name: 'c_dep_test', summary: 'c_dep_test', label: 'deployment_test', partial: false })
        .done(() => {
          callback()
        })
    },

    // add some template content
    callback => {

      newOrg.sessions.admin
        .put(newOrg.makeEndpoint('/templates/en_US/email/c_dep_test?activate=false&edit=0'))
        .set(newOrg.getSessionHeaders())
        .send([{ 'name': 'subject', 'data': 'Subject' }, { 'name': 'plain', 'data': 'Body {{{var}}}' }, { 'name': 'html', 'data': 'Body {{var}}' }])
        .done(() => {
          callback()
        })
    },

    // create a custom notification
    callback => {

      newOrg.sessions.admin
        .post(newOrg.makeEndpoint('/orgs/' + newOrg.org._id + '/configuration/notifications'))
        .set(newOrg.getSessionHeaders())
        .send({ label: 'dep_test', name: 'dep_test', endpoints: [{ eid: '456e64706f696e7420456d6c', state: 'Enabled', template: 'c_dep_test' }], duplicates: false, persists: false })
        .done(() => {
          callback()
        })

    },

    // create custom number
    callback => {

      newOrg.sessions.admin
        .post(newOrg.makeEndpoint('/orgs/' + newOrg.org._id + '/configuration/sms/numbers'))
        .set(newOrg.getSessionHeaders())
        .send([{ 'name': 'custom_twilio', 'provider': 'twilio', 'number': '+16508611234', 'accountSid': '12345', 'authToken': '12345', 'isDefault': true }])
        .done(() => {
          callback()
        })

    },

    callback => {

      let newRole = { 'code': 'c_simple_access', 'name': 'SimpleAccess', 'scope': ['object.read', 'object.update', 'view.execute'] }

      newOrg.sessions.admin
        .post(newOrg.makeEndpoint('/orgs/' + newOrg.org._id + '/roles'))
        .set(newOrg.getSessionHeaders())
        .send(newRole)
        .done(function(err, result) {
          if (!err && result && result.data && !_.isEmpty(result.data)) {
            roleId = utils.createId(result.data[result.data.length - 1]._id)
          }
          callback(err)
        })

    },

    // re-read the org
    callback => {

      newOrg.updateOrg(err => {

        if (!err) {

          // update the limit so we can blow it up
          newOrg.org.configuration.scripting.maxNotifications = 10

          // enable custom notifications
          newOrg.org.configuration.scripting.enableCustomSms = true
        }
        callback(err)
      })

    },

    // create a custom object extension.

    callback => {

      newOrg.updateOrg(err => {

        if (!err) {

          // update the limit so we can blow it up
          newOrg.org.configuration.scripting.maxNotifications = 10

          // enable custom notifications
          newOrg.org.configuration.scripting.enableCustomSms = true
        }
        callback(err)
      })

    },
    callback => {

      modules.db.models.Object.aclCreate(newOrg.principals.admin, {
        name: 'c_first_deployment_object',
        label: 'First Deployment object',
        defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }, { type: acl.AccessTargets.OrgRole, target: roleId, allow: acl.AccessLevels.Read }],
        createAcl: [{ type: acl.AccessTargets.OrgRole, target: roleId }],
        shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
        properties: [
          { label: 'String', name: 'c_string', type: 'String' },
          { label: 'Number', name: 'c_number', type: 'Number' },
          { label: 'Date', name: 'c_date', type: 'Date' }
        ]
      }, (err) => {
        callback(err)
      })
    },

    callback => {

      modules.db.models.Object.aclCreate(newOrg.principals.admin, {
        name: 'c_second_deployment_object',
        label: 'Second Deployment object',
        defaultAcl: [{ type: acl.AccessPrincipals.Owner, allow: acl.AccessLevels.Delete }],
        createAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
        shareChain: [acl.AccessLevels.Update, acl.AccessLevels.Share, acl.AccessLevels.Connected],
        properties: [
          { label: 'String', name: 'c_string', type: 'String' },
          { label: 'Number', name: 'c_number', type: 'Number' },
          { label: 'Date', name: 'c_date', type: 'Date' },
          { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
          { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
          { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
          { label: 'Any', name: 'c_any', type: 'Any' },
          { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
          { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' },
          { label: 'List', name: 'c_list', type: 'List', sourceObject: 'account', where: '{"email": "{{c_string}}"}' },
          {
            label: 'Document',
            name: 'c_doc',
            type: 'Document',
            properties: [
              { label: 'String', name: 'c_string', type: 'String' },
              { label: 'Number', name: 'c_number', type: 'Number' },
              { label: 'Date', name: 'c_date', type: 'Date' },
              { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
              { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
              { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
              { label: 'Any', name: 'c_any', type: 'Any' },
              { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
              { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' }
            ]
          }, {
            label: 'Document',
            name: 'c_doc_arr',
            type: 'Document',
            array: true,
            properties: [
              { label: 'String', name: 'c_string', type: 'String', array: true },
              { label: 'Number', name: 'c_number', type: 'Number', array: true },
              { label: 'Date', name: 'c_date', type: 'Date', array: true },
              { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId', array: true },
              { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
              { label: 'File', name: 'c_file', type: 'File', array: true, processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
              { label: 'Any', name: 'c_any', type: 'Any' },
              { label: 'Boolean', name: 'c_boolean', type: 'Boolean', array: true },
              { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'MultiPoint' }
            ]
          }, {
            label: 'Set',
            name: 'c_set',
            type: 'Set',
            minItems: 0,
            documents: [{
              label: 'Segment A',
              name: 'c_segment_a',
              properties: [
                { label: 'String', name: 'c_string', type: 'String' },
                { label: 'Number', name: 'c_number', type: 'Number' },
                { label: 'Date', name: 'c_date', type: 'Date' },
                { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
                { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                { label: 'Any', name: 'c_any', type: 'Any' },
                { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
                { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' }
              ]
            }, {
              label: 'Segment B',
              name: 'c_segment_b',
              properties: [
                { label: 'String', name: 'c_string', type: 'String' },
                { label: 'Number', name: 'c_number', type: 'Number' },
                { label: 'Date', name: 'c_date', type: 'Date' },
                { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
                { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                { label: 'Any', name: 'c_any', type: 'Any' },
                { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
                { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' }
              ]
            }, {
              label: 'Segment C - diff type same name for c_date',
              name: 'c_segment_c',
              properties: [
                { label: 'Date', name: 'c_date', type: 'String' }
              ]
            }]
          }

        ],
        feedDefinition: [{
          label: 'Post Type A',
          postType: 'c_post_type_a',
          notifications: true,
          trackViews: true,
          body: [{
            label: 'Segment A',
            name: 'c_segment_a',
            properties: [
              { label: 'String', name: 'c_string', type: 'String' },
              { label: 'Number', name: 'c_number', type: 'Number' },
              { label: 'Date', name: 'c_date', type: 'Date' },
              { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
              { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
              { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
              { label: 'Any', name: 'c_any', type: 'Any' },
              { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
              { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' },
              {
                label: 'Document',
                name: 'c_doc',
                type: 'Document',
                properties: [
                  { label: 'String', name: 'c_string', type: 'String' },
                  { label: 'Number', name: 'c_number', type: 'Number' },
                  { label: 'Date', name: 'c_date', type: 'Date' },
                  { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
                  { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                  { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                  { label: 'Any', name: 'c_any', type: 'Any' },
                  { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
                  { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' }
                ]
              }, {
                label: 'Document',
                name: 'c_doc_arr',
                type: 'Document',
                array: true,
                properties: [
                  { label: 'String', name: 'c_string', type: 'String', array: true },
                  { label: 'Number', name: 'c_number', type: 'Number', array: true },
                  { label: 'Date', name: 'c_date', type: 'Date', array: true },
                  { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId', array: true },
                  { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                  { label: 'File', name: 'c_file', type: 'File', array: true, processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                  { label: 'Any', name: 'c_any', type: 'Any' },
                  { label: 'Boolean', name: 'c_boolean', type: 'Boolean', array: true },
                  { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'MultiPoint' }
                ]
              }

            ]
          }],
          comments: [{
            label: 'Comment Segment A',
            name: 'c_comment_segment_a',
            properties: [
              { label: 'String', name: 'c_string', type: 'String' },
              { label: 'Number', name: 'c_number', type: 'Number' },
              { label: 'Date', name: 'c_date', type: 'Date' },
              { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
              { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
              { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
              { label: 'Any', name: 'c_any', type: 'Any' },
              { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
              { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' },
              {
                label: 'Document',
                name: 'c_doc',
                type: 'Document',
                properties: [
                  { label: 'String', name: 'c_string', type: 'String' },
                  { label: 'Number', name: 'c_number', type: 'Number' },
                  { label: 'Date', name: 'c_date', type: 'Date' },
                  { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
                  { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                  { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                  { label: 'Any', name: 'c_any', type: 'Any' },
                  { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
                  { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' }
                ]
              }, {
                label: 'Document',
                name: 'c_doc_arr',
                type: 'Document',
                array: true,
                properties: [
                  { label: 'String', name: 'c_string', type: 'String', array: true },
                  { label: 'Number', name: 'c_number', type: 'Number', array: true },
                  { label: 'Date', name: 'c_date', type: 'Date', array: true },
                  { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId', array: true },
                  { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
                  { label: 'File', name: 'c_file', type: 'File', array: true, processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
                  { label: 'Any', name: 'c_any', type: 'Any' },
                  { label: 'Boolean', name: 'c_boolean', type: 'Boolean', array: true },
                  { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'MultiPoint' }
                ]
              }
            ]
          }]
        }]
      }, (err, { ac }) => {
        callback(err, ac)
      })
    },
    (objectAc, callback) => {
      // create a view that requires a connection to another account
      modules.db.models.view.aclCreate(
        newOrg.principals.admin,
        {
          label: 'View Deployables',
          name: 'c_view_deployables',
          sourceObject: 'c_second_deployment_object',
          principal: newOrg.principals.provider._id,
          acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
          objectAcl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier, allow: acl.AccessLevels.Connected }]
        },
        err => {
          callback(err, objectAc)
        }
      )
    },
    // store in instance.
    (objectAc, callback) => {
      newOrg.org.createObject('c_second_deployment_object', function(err, object) {
        if (err) return callback(err)

        object.aclCreate(newOrg.principals.admin, {
          c_any: { this: 'value', can: ['be', 'anything'] },
          c_boolean: true,
          c_date: new Date(),
          c_doc: {
            c_any: { this: 'value', can: ['be', 'anything'] },
            c_boolean: true,
            c_date: new Date(),
            c_file: { content: textFilePointer },
            c_geometry: {
              type: 'Point',
              coordinates: [49, 49]
            },
            c_number: 1,
            c_objectId: utils.createId(),
            c_reference: newOrg.principals.admin._id,
            c_string: newOrg.principals.admin.email
          },
          c_doc_arr: [{
            c_any: { this: 'value', can: ['be', 'anything'] },
            c_boolean: [true, false],
            c_date: [new Date(), new Date()],
            c_file: [{ content: textFilePointer }, { content: textFilePointer }],
            c_geometry: {
              type: 'MultiPoint',
              coordinates: [[49, 49], [-49, -49]]
            },
            c_number: [1, 2, 3, 4],
            c_objectId: [utils.createId(), utils.createId()],
            c_reference: newOrg.principals.admin._id,
            c_string: [newOrg.principals.admin.email, newOrg.principals.patient.email]
          }, {
            c_any: { this: 'value', can: ['be', 'anything'] },
            c_boolean: [true, false],
            c_date: [new Date(), new Date()],
            c_file: [{ content: textFilePointer }, { content: textFilePointer }],
            c_geometry: {
              type: 'MultiPoint',
              coordinates: [[49, 49], [-49, -49]]
            },
            c_number: [1, 2, 3, 4],
            c_objectId: [utils.createId(), utils.createId()],
            c_reference: newOrg.principals.admin._id,
            c_string: [newOrg.principals.admin.email, newOrg.principals.patient.email]
          }],
          c_file: { content: textFilePointer },
          c_geometry: {
            type: 'Point',
            coordinates: [49, 49]
          },
          c_number: 1,
          c_objectId: utils.createId(),
          c_reference: newOrg.principals.admin._id,
          c_set: [{
            name: 'c_segment_a',
            c_any: { this: 'value', can: ['be', 'anything'] },
            c_boolean: true,
            c_date: new Date(),
            c_file: { content: textFilePointer },
            c_geometry: {
              type: 'Point',
              coordinates: [49, 49]
            },
            c_number: 1,
            c_objectId: utils.createId(),
            c_reference: newOrg.principals.admin._id,
            c_string: newOrg.principals.admin.email
          }, {
            name: 'c_segment_b',
            c_any: { this: 'value', can: ['be', 'anything'] },
            c_boolean: true,
            c_date: new Date(),
            c_file: { content: textFilePointer },
            c_geometry: {
              type: 'Point',
              coordinates: [49, 49]
            },
            c_number: 1,
            c_objectId: utils.createId(),
            c_reference: newOrg.principals.admin._id,
            c_string: newOrg.principals.admin.email
          }, {
            name: 'c_segment_c',
            c_date: 'This is a string, not a date!'
          }],
          c_string: newOrg.principals.admin.email
        }, (err) => {
          callback(err)
        })
      })
    },
    // create route that runs as the provider principal.
    callback => {
      Script.aclCreate(newOrg.principals.admin, {
        label: 'DS Run and provider',
        name: 'c_ds_run_and_provider',
        type: 'route',
        script: 'return script.principal._id',
        principal: newOrg.principals.provider._id,
        configuration: {
          acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgProviderRole }],
          method: 'get',
          path: '/deploy/run_as_provider_principal'
        }
      }, (err) => {
        callback(err)
      })
    },

    // create route that accepts urlEncoded
    callback => {
      Script.aclCreate(newOrg.principals.admin, {
        label: 'Deploy urlEncoded Test',
        name: 'c_deploy_urlencoded_test',
        type: 'route',
        script: 'return require("request").body',
        configuration: {
          acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
          method: 'post',
          path: '/deploy/encoding/urlEncoded',
          urlEncoded: true
        }
      }, (err) => {
        callback(err)
      })
    },

    // create route that accepts plainText
    callback => {
      Script.aclCreate(newOrg.principals.admin, {
        label: 'deploy plainText Test',
        name: 'c_deploy_plaintext_test',
        type: 'route',
        script: 'return require("request").body',
        configuration: {
          acl: [{ type: acl.AccessTargets.Account, target: acl.PublicIdentifier }],
          method: 'post',
          path: '/deploy/encoding/plainText',
          plainText: true
        }
      }, (err) => {
        callback(err)
      })
    },

    // create an app pinned route we can call without an api key (and anonymously)
    callback => {
      Script.aclCreate(newOrg.principals.admin, {
        label: 'Deploy Pinned Route',
        name: 'c_deploy_pinned_route',
        type: 'route',
        script: 'return require("request").client.key',
        configuration: {
          acl: [{ type: acl.AccessTargets.Account, target: acl.AnonymousIdentifier }],
          method: 'get',
          path: '/deploy/app_pinned',
          apiKey: newOrg.org.apps[0]._id
        }
      }, (err) => {
        callback(err)
      })
    }

  ], (err) => {
    callback(err)
  })

}
