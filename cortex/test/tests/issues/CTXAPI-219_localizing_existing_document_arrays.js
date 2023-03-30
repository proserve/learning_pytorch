'use strict'

/* global before, after */

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-219 - Cannot update existing document arrays after enabling localization.', function() {

  before(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects

    Objects.insertOne({
      label: 'CTXAPI-219',
      name: 'c_ctxapi_219',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      uniqueKey: 'c_key',
      properties: [
        { name: 'c_key', label: 'c_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', indexed: true, unique: true },
        {
          name: 'c_loc_document',
          label: 'c_loc_document',
          type: 'Document',
          array: true,
          uniqueKey: 'c_key',
          properties: [
            {
              name: 'c_key',
              label: 'c_key',
              type: 'UUID',
              autoGenerate: true,
              uuidVersion: 4,
              writable: true,
              validators: [{ name: 'uniqueInArray' }],
              optional: false
            },
            {
              label: 'Loc String',
              name: 'c_loc_string',
              type: 'String',
              indexed: true
            },
            {
              label: 'Non Loc String',
              name: 'c_non_loc_string',
              type: 'String'
            }
          ]
        }
      ]
    }).execute()

  }))

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_219' }).execute()

  }))

  it('Insert an instance with a required localized property.', sandboxed(function() {

    /* global org */

    const { Objects, c_ctxapi_219: Model } = org.objects,

          insertedInstance = Model.insertOne({
            c_loc_document: [
              {
                c_loc_string: 'item one loc',
                c_non_loc_string: 'item one non loc'
              },
              {
                c_loc_string: 'item two loc',
                c_non_loc_string: 'item two non loc'
              },
              {
                c_loc_string: 'item three loc',
                c_non_loc_string: 'item three non loc'
              }
            ]
          }).lean(false).execute()

    Objects.updateOne(
      {
        name: 'c_ctxapi_219'
      },
      {
        $set: {
          properties: {
            name: 'c_loc_document',
            properties: {
              name: 'c_loc_string',
              localization: {
                enabled: true
              }
            }
          }
        }
      }
    ).execute()

    let localizedInstance = Model.find({ _id: insertedInstance._id }).include('locales').next(),
        instanceUpdatePath = `c_loc_document/${localizedInstance.c_loc_document[1]._id}` // item two loc

    Model.updateOne({ _id: localizedInstance._id }, { $set: { c_loc_string: 'Second Item, new String to localize' } }).pathPrefix(instanceUpdatePath).execute()
    Model.updateOne({ _id: localizedInstance._id }, { $set: { c_non_loc_string: 'Second Item, new non loc String' } }).pathPrefix(instanceUpdatePath).execute()

  }))

})
