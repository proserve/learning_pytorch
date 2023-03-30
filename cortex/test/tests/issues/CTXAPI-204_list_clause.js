'use strict'

/* global before, after */

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-204 - list - clause', function() {

    before(sandboxed(function() {

      /* global org, script */

      const Objects = org.objects.objects

      Objects.insertOne({
        label: 'CTXAPI-204 Site',
        name: 'c_ctxapi_204_site',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public'
      }).execute()

      Objects.insertOne({
        label: 'CTXAPI-204 Study',
        name: 'c_ctxapi_204_study',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public'
      }).execute()

      // add properties
      {
        const properties = [{
          label: 'CTXAPI-204 Sites',
          name: 'c_ctxapi_204_sites',
          type: 'ObjectId',
          array: true,
          indexed: true
        }]
        if (Objects.find({ name: 'account' }).hasNext()) {
          Objects.updateOne({ name: 'account' }, { $push: { properties } }).execute()
        } else {
          Objects.insertOne({ name: 'account', label: 'Account', properties }).execute()
        }
      }

      Objects.updateOne({ name: 'c_ctxapi_204_site' }, { $push: { properties: [{
        label: 'Study',
        name: 'c_study',
        type: 'Reference',
        expandable: true,
        indexed: true,
        sourceObject: 'c_ctxapi_204_study'
      }] } }
      ).execute()

      Objects.updateOne({ name: 'c_ctxapi_204_study' }, { $push: { properties: [{
        label: 'Sites',
        name: 'c_sites_1',
        type: 'List',
        readThrough: true,
        writeThrough: true,
        inheritInstanceRoles: true,
        inheritPropertyAccess: true,
        sourceObject: 'c_ctxapi_204_site',
        where: `
                {{#if account.c_ctxapi_204_sites}}    
                  {"c_study": "{{input._id}}", "_id": {"$in": {{{json account.c_ctxapi_204_sites}}} } }
                {{else}}
                  {"c_study": "{{input._id}}"}
                {{/if}}
              `
      }, {
        label: 'Sites',
        name: 'c_sites_2',
        type: 'List',
        readThrough: true,
        writeThrough: true,
        inheritInstanceRoles: true,
        inheritPropertyAccess: true,
        sourceObject: 'c_ctxapi_204_site',
        where: `               
               {"c_study": "{{input._id}}", "_id": {"$in": {{{json account.c_ctxapi_204_sites}}} } }                
              `
      }, {
        label: 'Sites',
        name: 'c_sites_3',
        type: 'List',
        readThrough: true,
        writeThrough: true,
        inheritInstanceRoles: true,
        inheritPropertyAccess: true,
        sourceObject: 'c_ctxapi_204_site',
        where: `               
               {"c_study": "{{input._id}}"}           
              `
      }] } }
      ).execute()

      {
        const study = org.objects.c_ctxapi_204_studies.insertOne({}).execute(),
              { insertedIds } = org.objects.c_ctxapi_204_sites.insertMany([{
                c_study: study
              }, {
                c_study: study
              }]).execute()

        org.objects.account.updateOne({ _id: script.principal._id }, { $push: { c_ctxapi_204_sites: [insertedIds[0]._id] } }).execute()
      }

    }))

    after(sandboxed(function() {

      const Objects = org.objects.objects
      Objects.updateOne({ name: 'account' }, {
        $pull: {
          properties: ['c_ctxapi_204_sites']
        }
      }).execute()

      Objects.updateOne({ name: 'c_ctxapi_204_site' }, {
        $pull: {
          properties: ['c_study']
        }
      }).execute()

      Objects.updateOne({ name: 'c_ctxapi_204_study' }, {
        $pull: {
          properties: ['c_sites_1', 'c_sites_2', 'c_sites_3']
        }
      }).execute()

      Objects.deleteMany({ name: { $in: ['c_ctxapi_204_site', 'c_ctxapi_204_study'] } }).execute()

    }))

    it('reading and writing through references and lists', sandboxed(function() {

      require('should')

      const siteString = script.principal.read('c_ctxapi_204_sites')[0].toString(),
            studyId = org.objects.c_ctxapi_204_studies.find().next()._id,
            result = org.objects.c_ctxapi_204_studies.find({ _id: studyId }).paths('c_sites_1', 'c_sites_2', 'c_sites_3').next()

      result.c_sites_1.data.length.should.equal(1)
      result.c_sites_1.data[0]._id.toString().should.equal(siteString)
      result.c_sites_2.data.length.should.equal(1)
      result.c_sites_2.data[0]._id.toString().should.equal(siteString)
      result.c_sites_3.data.length.should.equal(2)

    }))

  })

})
