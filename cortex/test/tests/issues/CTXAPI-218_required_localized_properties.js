'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-218 - Required & localized property cannot be inserted', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects

    Objects.insertOne({
      label: 'CTXAPI-218',
      name: 'c_ctxapi_218',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        {
          label: 'c_string',
          name: 'c_string',
          type: 'String',
          indexed: true,
          validators: [{
            name: 'required'
          }, {
            name: 'string',
            definition: {
              min: 2,
              max: 3
            }
          }],
          localization: {
            enabled: true
          }
        },
        { name: 'c_key', label: 'Key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_218' }).execute()

  }))

  it('Insert an instance with a required localized property.', sandboxed(function() {

    /* global org */

    const { c_ctxapi_218: Model } = org.objects

    Model.insertOne({ c_string: 'foo' }).lean(false).execute()

  }))

  it('Trigger required validator.', sandboxed(function() {

    /* global org */

    const { c_ctxapi_218: Model } = org.objects

    try {
      Model.insertOne().lean(false).execute()
    } catch (err) {
      if (err.code === 'kValidationError' && err.faults[0].errCode === 'cortex.invalidArgument.required') {
        return
      }
      throw err
    }
    throw new Error('should have thrown validation error')

  }))

  it('Trigger other validators.', sandboxed(function() {

    /* global org */

    const { c_ctxapi_218: Model } = org.objects

    try {
      Model.insertOne({ c_string: 'too long' }).lean(false).execute()
    } catch (err) {
      if (err.code === 'kValidationError' && err.faults[0].code === 'kInvalidString') {
        return
      } throw err
    }
    throw new Error('should have thrown validation error')

  }))

})
