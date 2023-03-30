'use strict'

const async = require('async'),
      _ = require('underscore'),
      server = require('./server'),
      acl = require('../../lib/acl'),
      consts = require('../../lib/consts'),
      modules = require('../../lib/modules/index'),
      utils = require('../../lib/utils'),
      timeoutMs = 120000

let promise = false

module.exports = function(ac) {

  if (!promise) {
    promise = new Promise((resolve, reject) => {

      const callback = (err, instanceAc, objectAc, postAc, commentAc) => {
              if (err) {
                reject(err)
              } else {
                resolve({ instanceAc, objectAc, postAc, commentAc })
              }
            },
            textFilePointer = new modules.storage.FilePointer(null, { path: `${__dirname}/../files/plain.txt`, mime: 'text/plain' }, ac)

      async.waterfall([

        // create a custom object extension.
        callback => {

          modules.db.models.Object.aclCreate(server.principals.admin, {
            name: 'c_postable',
            label: 'Postable',
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
              }, {
                label: 'Segment C - diff type same name for c_date',
                name: 'c_segment_c',
                properties: [
                  { label: 'Date', name: 'c_date', type: 'String' }
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
              }, {
                label: 'Comment Segment B',
                name: 'c_comment_segment_b',
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
              }, {
                label: 'Segment C - diff type same name for c_date',
                name: 'c_comment_segment_c',
                properties: [
                  { label: 'Date', name: 'c_date', type: 'String' }
                ]
              }]
            }]
          }, {
            skipValidation: true
          }, (err, { ac }) => {
            callback(err, ac)
          })
        },

        // reload the org so the new object is detected.
        (objectAc, callback) => {
          server.updateOrg(err => {
            callback(err, objectAc)
          })
        },

        // store in instance.
        (objectAc, callback) => {
          ac.org.createObject('c_postable', function(err, object) {
            if (err) return callback(err)

            object.aclCreate(
              ac.principal,
              {
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
                  c_reference: server.principals.admin._id,
                  c_string: server.principals.admin.email
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
                  c_reference: server.principals.admin._id,
                  c_string: [server.principals.admin.email, server.principals.unverified.email]
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
                  c_reference: server.principals.admin._id,
                  c_string: [server.principals.admin.email, server.principals.unverified.email]
                }],
                c_file: { content: textFilePointer },
                c_geometry: {
                  type: 'Point',
                  coordinates: [49, 49]
                },
                c_number: 1,
                c_objectId: utils.createId(),
                c_reference: server.principals.admin._id,
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
                  c_reference: server.principals.admin._id,
                  c_string: server.principals.admin.email
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
                  c_reference: server.principals.admin._id,
                  c_string: server.principals.admin.email
                }, {
                  name: 'c_segment_c',
                  c_date: 'This is a string, not a date!'
                }],
                c_string: server.principals.admin.email
              },
              {
                skipValidation: true
              },
              (err, { ac }) => {
                callback(err, ac, objectAc)
              })
          })
        },

        // create a post.
        (instanceAc, objectAc, callback) => {

          const payload = {
            body: [{
              name: 'c_segment_a',
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
                c_reference: server.principals.admin._id,
                c_string: server.principals.admin.email
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
              }],
              c_file: { content: textFilePointer },
              c_geometry: {
                type: 'Point',
                coordinates: [49, 49]
              },
              c_number: 1,
              c_objectId: utils.createId(),
              c_reference: server.principals.admin._id,
              c_string: server.principals.admin.email
            }, {
              name: 'c_segment_b',
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
                c_reference: server.principals.admin._id,
                c_string: server.principals.admin.email
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
              }],
              c_file: { content: textFilePointer },
              c_geometry: {
                type: 'Point',
                coordinates: [49, 49]
              },
              c_number: 1,
              c_objectId: utils.createId(),
              c_reference: server.principals.admin._id,
              c_string: server.principals.admin.email
            }, {
              name: 'c_segment_c',
              c_date: 'This is a string, not a date!'
            }]
          }

          modules.db.models.Post.postCreate(instanceAc.principal, instanceAc.object, instanceAc.subjectId, 'c_post_type_a', payload, { skipValidation: true }, (err, postAc) => {
            callback(err, instanceAc, objectAc, postAc)
          })

        },

        // create a comment
        (instanceAc, objectAc, postAc, callback) => {

          const payload = {
            body: [{
              name: 'c_comment_segment_a',
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
                c_reference: server.principals.admin._id,
                c_string: server.principals.admin.email
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
              }],
              c_file: { content: textFilePointer },
              c_geometry: {
                type: 'Point',
                coordinates: [49, 49]
              },
              c_number: 1,
              c_objectId: utils.createId(),
              c_reference: server.principals.admin._id,
              c_string: server.principals.admin.email
            }, {
              name: 'c_comment_segment_b',
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
                c_reference: server.principals.admin._id,
                c_string: server.principals.admin.email
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
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
                c_reference: server.principals.admin._id,
                c_string: [server.principals.admin.email, server.principals.unverified.email]
              }],
              c_file: { content: textFilePointer },
              c_geometry: {
                type: 'Point',
                coordinates: [49, 49]
              },
              c_number: 1,
              c_objectId: utils.createId(),
              c_reference: server.principals.admin._id,
              c_string: server.principals.admin.email
            }, {
              name: 'c_comment_segment_c',
              c_date: 'This is a string, not a date!'
            }]
          }

          modules.db.models.Comment.commentCreate(postAc, payload, { skipValidation: true }, (err, commentAc) => {
            callback(err, instanceAc, objectAc, postAc, commentAc)
          })

        },

        (instanceAc, objectAc, postAc, commentAc, callback) => {
          server.updateOrg(err => callback(err, instanceAc, objectAc, postAc, commentAc))
        },

        // now, allow the media update to upload but set a sane timeout in case things aren't working
        (instanceAc, objectAc, postAc, commentAc, callback) => {

          async.race(
            [
              callback => {
                const timeout = setTimeout(() => {
                  callback(new Error('timed out waiting for postable media to process.'))
                }, timeoutMs)
                timeout.unref()
              },

              callback => {

                let remaining = -1

                // keep polling for media updates.
                async.during(

                  async() => {
                    await utils.sleep(250)
                    return remaining !== 0
                  },

                  callback => {

                    function check(err, doc, callback) {
                      let remaining = 0
                      if (!err) {
                        remaining = doc.facets.length - _.filter(doc.facets, facet => facet.state === consts.media.states.ready).length
                        if (_.some(doc.facets, facet => facet.state === consts.media.states.error)) {
                          err = new Error('Some facets had processing errors')
                        }
                      }
                      callback(err, remaining)
                    }

                    async.parallel({

                      context: callback => {
                        instanceAc.object.findOne({ _id: instanceAc.subjectId }).select('facets').lean().exec((err, doc) => {
                          check(err, doc, callback)
                        })
                      },

                      post: callback => {
                        postAc.post.constructor.findOne({ _id: postAc.post._id }).select().lean().exec((err, doc) => {
                          check(err, doc, callback)
                        })
                      },

                      comment: callback => {
                        commentAc.comment.constructor.findOne({ _id: commentAc.comment._id }).select().lean().exec((err, doc) => {
                          check(err, doc, callback)
                        })
                      }

                    }, (err, result) => {
                      if (!err) {
                        remaining = result.context + result.post + result.comment
                      }
                      callback(err)
                    })

                  },

                  callback

                )

              }
            ],
            err => {
              callback(err, instanceAc, objectAc, postAc, commentAc)
            }
          )

        }

      ], (err, instanceAc, objectAc, postAc, commentAc) => {

        callback(err, instanceAc, objectAc, postAc, commentAc)

      })

    })
  }

  return promise

}
