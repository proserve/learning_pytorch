'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Validators', function() {

  describe('writeOnce', function() {

    it('should create test object', sandboxed(function() {

      /* global org, consts */

      org.objects.object.insertOne({
        label: 'Test',
        name: 'c_validators_write_once',
        defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
        createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
        properties: [
          { label: 'Prop', name: 'c_withDefault', type: 'String', defaultValue: { type: 'static', value: 'Ok' }, validators: [{ name: 'writeOnce' }] },
          { label: 'Prop', name: 'c_withoutDefault', type: 'String', validators: [{ name: 'writeOnce' }] },
          { label: 'Prop', name: 'c_createOnly', type: 'String', creatable: true, validators: [{ name: 'writeOnce' }] },
          { label: 'Docs',
            name: 'c_docs',
            type: 'Document',
            array: true,
            properties: [
              { label: 'Prop', name: 'c_withDefault', type: 'String', defaultValue: { type: 'static', value: 'Ok' }, validators: [{ name: 'writeOnce' }] },
              { label: 'Prop', name: 'c_withoutDefault', type: 'String', validators: [{ name: 'writeOnce' }] },
              { label: 'Prop', name: 'c_createOnly', type: 'String', creatable: true, validators: [{ name: 'writeOnce' }] }
            ]
          }
        ],
        objectTypes: [
          { label: 'One',
            name: 'c_one',
            properties: [
              { label: 'Prop', name: 'c_typed', type: 'String', validators: [{ name: 'writeOnce' }] }
            ]
          }
        ]
      }).execute()

    }))

    it('should fail to create a test object with the validator in an array property.', sandboxed(function() {

      /* global org, consts */

      const pathTo = require('util.paths.to')

      try {
        org.objects.object.insertOne({
          label: 'Test',
          name: 'c_validators_writeOnce_Array',
          properties: [
            { label: 'Prop', name: 'c_prop_array', type: 'String', array: true, validators: [{ name: 'writeOnce' }] }
          ]
        }).execute()
      } catch (err) {
        if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
            pathTo(err, 'faults.0.code') === 'kInvalidArgument' &&
            pathTo(err, 'faults.0.path') === 'object.properties[]#String.validators[].name'
        ) {
          return true
        }
        throw err
      }
      throw new TypeError('Expected to fail with a validation error')

    }))

    it('should fail to create a test object with the validator in an unsupported property type.', sandboxed(function() {

      const pathTo = require('util.paths.to')

      try {
        org.objects.object.insertOne({
          label: 'Test',
          name: 'c_validators_writeOnce_Reference',
          properties: [
            { label: 'Prop', name: 'c_prop_array', type: 'Reference', sourceObject: 'account', validators: [{ name: 'writeOnce' }] }
          ]
        }).execute()
      } catch (err) {
        if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
          pathTo(err, 'faults.0.code') === 'kInvalidArgument' &&
          pathTo(err, 'faults.0.path') === 'object.properties[]#Reference.validators[].name'
        ) {
          return true
        }
        throw err
      }
      throw new TypeError('Expected to fail with a validation error')

    }))

    it('should succeed at various insert and update test cases.', sandboxed(function() {

      /* global org, consts */

      const pathTo = require('util.paths.to'),
            tryCatch = require('util.values').tryCatch,
            Model = org.objects.c_validators_write_once

      function expectWriteOnceError(err, path, code = 'cortex.accessDenied.writeOnce') {
        if (pathTo(err, 'errCode') === 'cortex.invalidArgument.validation' &&
          pathTo(err, 'faults.0.errCode') === code &&
          pathTo(err, 'faults.0.path') === path
        ) {
          return true
        }
        throw err
      }

      tryCatch(
        () => {
          let _id = Model.insertOne({ type: 'c_one' }).execute()
          Model.updateOne({ _id }, { $set: { c_withoutDefault: 'foo' } }).execute()
        },
        (err) => { if (err) throw err }
      )

      tryCatch(
        () => {
          let _id = Model.insertOne({ type: 'c_one' }).execute()
          Model.updateOne({ _id }, { $set: { c_createOnly: 'foo' } }).execute()
        },
        (err) => expectWriteOnceError(err, 'c_validators_write_once.c_createOnly', 'cortex.invalidArgument.creatableOnly')
      )

      tryCatch(
        () => {
          let _id = Model.insertOne({ type: 'c_one' }).execute()
          Model.updateOne({ _id }, { $set: { c_withoutDefault: 'foo' } }).execute()
          Model.updateOne({ _id }, { $set: { c_withoutDefault: 'bar' } }).execute()
        },
        (err) => expectWriteOnceError(err, 'c_validators_write_once.c_withoutDefault')
      )

      tryCatch(
        () => {
          let _id = Model.insertOne({ type: 'c_one' }).execute()
          Model.updateOne({ _id }, { $set: { c_withDefault: 'foo' } }).execute()
        },
        (err) => expectWriteOnceError(err, 'c_validators_write_once.c_withDefault')
      )

      tryCatch(
        () => {
          let doc = Model.insertOne({ type: 'c_one', c_docs: { c_withoutDefault: 'foo' } }).lean(false).execute()
          Model.updateOne({ _id: doc._id }, { $set: { c_docs: [{ _id: doc.c_docs[0]._id, c_withDefault: 'bat' }] } }).execute()
        },
        (err) => expectWriteOnceError(err, 'c_validators_write_once.c_docs[].c_withDefault')
      )

      tryCatch(
        () => {
          let doc = Model.insertOne({ type: 'c_one', c_docs: { c_withoutDefault: 'foo' } }).lean(false).execute()
          Model.updateOne({ _id: doc._id }, { $set: { c_docs: [{ _id: doc.c_docs[0]._id, c_withoutDefault: 'bat' }] } }).execute()
        },
        (err) => expectWriteOnceError(err, 'c_validators_write_once.c_docs[].c_withoutDefault')
      )

      tryCatch(
        () => {
          let doc = Model.insertOne({ type: 'c_one', c_docs: { c_withDefault: 'foo' } }).lean(false).execute()
          Model.updateOne({ _id: doc._id }, { $set: { c_docs: [{ _id: doc.c_docs[0]._id, c_withoutDefault: 'bat' }] } }).execute()
        },
        (err) => { if (err) throw err }
      )

    }))

  })

})
