'use strict'

/* eslint-disable node/no-deprecated-api */

/* global before */
/* global org, script, ObjectID */

const consts = require('../../../../lib/consts'),
      sandboxed = require('../../../lib/sandboxed')

describe('Modules', function() {

  describe('Db', function() {

    before(sandboxed(function() {

      org.objects.object.insertOne({
        name: 'c_lite_reader',
        label: 'Raw Reader Test',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'String', name: 'c_string', type: 'String' },
          { label: 'Number', name: 'c_number', type: 'Number' },
          { label: 'Date', name: 'c_date', type: 'Date' },
          { label: 'Date Only', name: 'c_date_only', type: 'Date', dateOnly: true },
          { label: 'ObjectId', name: 'c_objectId', type: 'ObjectId' },
          { label: 'Reference', name: 'c_reference', type: 'Reference', sourceObject: 'account' },
          { label: 'File', name: 'c_file', type: 'File', processors: [{ label: 'Content', type: 'passthru', name: 'content', source: 'content', mimes: '*', required: true, passMimes: false, private: false, allowUpload: true }] },
          { label: 'Any', name: 'c_any', type: 'Any' },
          { label: 'Any Serialized', name: 'c_any_serialized', type: 'Any', serializeData: true },
          { label: 'Boolean', name: 'c_boolean', type: 'Boolean' },
          { label: 'Binary Base64', name: 'c_binary_base64', type: 'Binary', outputEncoding: 'base64' },
          { label: 'Binary Hex', name: 'c_binary_hex', type: 'Binary', outputEncoding: 'hex' },
          { label: 'Geometry', name: 'c_geometry', type: 'Geometry', geoType: 'Point' },
          { label: 'List', name: 'c_list', type: 'List', sourceObject: 'account', where: '{"email": "{{c_string}}"}' },
          {
            label: 'Document',
            name: 'c_doc',
            type: 'Document',
            properties: [
              { label: 'String', name: 'c_string', type: 'String' }
            ]
          }, {
            label: 'Document',
            name: 'c_doc_arr',
            type: 'Document',
            array: true,
            properties: [
              { label: 'String', name: 'c_string', type: 'String', array: true }
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
                { label: 'String', name: 'c_string', type: 'String' }
              ]
            }, {
              label: 'Segment B',
              name: 'c_segment_b',
              properties: [
                { label: 'String', name: 'c_string', type: 'String' }
              ]
            }, {
              label: 'Segment C - diff type same name for c_date',
              name: 'c_segment_c',
              properties: [
                { label: 'Date', name: 'c_date', type: 'String' }
              ]
            }]
          }
        ]
      }).execute()

      org.objects.c_lite_reader.insertOne({

        c_string: script.principal.email,
        c_number: 1,
        c_date: new Date(),
        c_date_only: new Date(),
        c_objectId: new ObjectID(),
        c_reference: script.principal._id,
        c_file: { content: { buffer: new Buffer('small text file') } },
        c_any: { some: { thing: 'good' } },
        c_any_serialized: { some: { thing: 'good' } },
        c_boolean: true,
        c_binary_base64: new Buffer('small text file'),
        c_binary_hex: new Buffer('small text file'),
        c_geometry: { type: 'Point', coordinates: [49, 49] },
        c_doc: {
          c_string: 'string'
        },
        c_doc_arr: [{
          c_string: 'string'
        }],
        c_set: [{
          name: 'c_segment_a',
          c_string: 'a'
        }, {
          name: 'c_segment_b',
          c_string: 'b'
        }, {
          name: 'c_segment_c',
          c_date: new Date()
        }]

      }).execute()

    }))

  })

})
