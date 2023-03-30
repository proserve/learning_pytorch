'use strict'

/* global consts */

const sandboxed = require('../../lib/sandboxed'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_318_ref.deleteMany({}).execute()
        org.objects.c_ctxapi_318.deleteMany({}).execute()
        should.equal(org.objects.c_ctxapi_318.find().count(), 0)
        should.equal(org.objects.c_ctxapi_318_ref.find().count(), 0)
      }

describe('Features - add support for $expand in $addFields', function() {

  describe('CTXAPI-318 - querying with $addFields + $expand', function() {

    after(sandboxed(cleanInstances))

    before(sandboxed(function() {
      /* global consts */
      const refId = org.objects.objects.insertOne({
              label: 'CTXAPI-318_Ref',
              name: 'c_ctxapi_318_ref',
              defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
              createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
              properties: [
                {
                  label: 'name',
                  name: 'c_name',
                  type: 'String',
                  indexed: true
                }
              ]
            }).execute(),
            parentId = org.objects.objects.insertOne({
              label: 'CTXAPI-318',
              name: 'c_ctxapi_318',
              defaultAcl: [{ type: consts.accessPrincipals.owner, allow: consts.accessLevels.delete }],
              createAcl: [{ type: consts.accessTargets.account, target: consts.principals.public }],
              properties: [
                { label: 'name', name: 'c_name', type: 'String', indexed: true }
              ]
            }).execute()

      org.objects.objects.updateOne({ _id: refId }, {
        $push: {
          properties: [{
            label: 'Parent',
            name: 'c_parent',
            type: 'Reference',
            indexed: true,
            expandable: true,
            sourceObject: 'c_ctxapi_318'
          }]
        }
      }).execute()

      org.objects.objects.updateOne({ _id: parentId }, {
        $push: {
          properties: [{
            label: 'Reference',
            name: 'c_reference',
            type: 'List',
            sourceObject: 'c_ctxapi_318_ref',
            linkedProperty: 'c_parent',
            readThrough: true,
            writeThrough: true,
            updateOnWriteThrough: true
          }]
        }
      }).execute()

      org.objects.c_ctxapi_318.insertOne({
        c_name: 'John Doe',
        c_reference: [
          { c_name: 'reference 1' },
          { c_name: 'reference 2' }
        ]
      }).execute()

      org.objects.c_ctxapi_318.insertOne({
        c_name: 'Jane Fonda',
        c_reference: [
          { c_name: 'reference 3' },
          { c_name: 'reference 4' },
          { c_name: 'reference 5' },
          { c_name: 'reference 6' }
        ]
      }).execute()

    }))

    it('expand c_reference into $addFields operator', sandboxed(function() {
      require('should')
      /* global org */
      const items = org.objects.c_ctxapi_318.aggregate([
        { $project: { c_name: 1, c_reference: 1 } },
        {
          $addFields: {
            c_name: { $concat: [{ $literal: 'Name:' }, 'c_name'] },
            c_reference: {
              $expand: {
                pipeline: [
                  { $project: { c_name: 1 } }
                ]
              }
            }
          }
        }
      ]).toArray()
      items.length.should.equal(2)
      items[0].c_reference.data.length.should.equal(2)
      items[0].c_name.should.equal('Name:John Doe')
      items[0].c_reference.data[0].c_name.should.equal('reference 1')
      items[0].c_reference.data[1].c_name.should.equal('reference 2')
      items[1].c_reference.data.length.should.equal(4)
      items[1].c_name.should.equal('Name:Jane Fonda')
      items[1].c_reference.data[0].c_name.should.equal('reference 3')
      items[1].c_reference.data[1].c_name.should.equal('reference 4')
      items[1].c_reference.data[2].c_name.should.equal('reference 5')
      items[1].c_reference.data[3].c_name.should.equal('reference 6')

    }))

    it('expand c_parent into $addFields operator', sandboxed(function() {
      require('should')
      /* global org */
      const items = org.objects.c_ctxapi_318_ref.aggregate([
        { $project: { c_name: 1, c_parent: 1 } },
        { $addFields: {
          c_name: 'c_name',
          c_parent: {
            $expand: ['c_name']
          }
        } }
      ]).toArray()
      items.length.should.equal(6)
      items[0].c_parent.c_name.should.equal('John Doe')
      items[1].c_parent.c_name.should.equal('John Doe')
      items[2].c_parent.c_name.should.equal('Jane Fonda')
      items[3].c_parent.c_name.should.equal('Jane Fonda')
      items[4].c_parent.c_name.should.equal('Jane Fonda')
      items[5].c_parent.c_name.should.equal('Jane Fonda')

    }))
  })
})
