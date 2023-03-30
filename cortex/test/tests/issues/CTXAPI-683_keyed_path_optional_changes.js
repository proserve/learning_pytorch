'use strict'

const server = require('../../lib/server'),
      { promised } = require('../../../lib/utils'),
      sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-683 Any properties are not selected if keys contains dots.', function() {

  before(async() => {

    await sandboxed(function() {

      const {
        org: { objects: { Objects } }
      } = global

      Objects.insertOne({
        name: 'ctxapi__683',
        label: 'ctxapi__683',
        createAcl: 'account.public',
        defaultAcl: 'owner.delete',
        properties: [{
          label: 'c_any',
          name: 'c_any',
          type: 'Any',
          optional: true,
          serializeData: true
        }]
      }).execute()

    })()

  })

  it('path should be selected by cortex', async() => {

    const { org, principals: { admin } } = server,
          object = await org.createObject('ctxapi__683'),
          writeOptions = {
            method: 'put',
            beforeWrite: (ac, payload, callback) => {

              const { subject } = ac
              subject.isSelected('c_any').should.be.true()
              callback()

            }
          },
          payload = {
            c_any: {
              'odd.key.with.dots': {
                foo: 'bar'
              }
            }
          },
          _id = await sandboxed(function() {

            const { ctxapi__683: Model } = org.objects
            return Model.insertOne({ c_any: {} }).execute()

          })()

    await promised(object, 'aclUpdate', admin, _id, payload, writeOptions)

  })

  it('update should succeed in sandbox', async() =>

    sandboxed(function() {
      /* global org */

      const { ctxapi__683: Model } = org.objects,
            _id = Model.insertOne({ c_any: {} }).execute()

      Model.updateOne(
        { _id },
        { $set: {
          c_any: {
            'odd.key.with.dots': {
              foo: 'bar'
            }
          }
        }
        }).execute()

    })()

  )

})
