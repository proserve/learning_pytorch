'use strict'

/* global before, after */

const server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      sandboxed = require('../../lib/sandboxed')

let defaultParserEngine

describe('Issues - CTXAPI-393 - $in not parsed when slotted index present', function() {

  before(sandboxed(function() {

    org.objects.objects.insertOne({
      label: 'c_ctxapi_393',
      name: 'c_ctxapi_393',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          name: 'c_task',
          label: 'Tasks',
          type: 'Document',
          array: true,
          uniqueKey: 'c_task_key',
          properties: [{
            name: 'c_task_key', label: 'c_task_key', uuidVersion: 4, autoGenerate: true, type: 'UUID', validators: [{ name: 'uniqueInArray' }]
          }, {
            name: 'c_string', label: 'c_string', type: 'String', indexed: true
          }]
        },
        {
          name: 'c_type',
          label: 'c_type',
          type: 'String',
          indexed: true
        }]
    }).execute()

    org.objects.c_ctxapi_393.insertMany([{
      c_task: [{
        c_string: 'testing 1'
      }, {
        c_string: 'testing 2'
      }],
      c_type: 'Document'
    }, {
      c_task: [{
        c_string: 'testing 1'
      }],
      c_type: 'Document'
    },
    {
      c_task: [{
        c_string: 'testing 3'
      }],
      c_type: 'Other'
    }]).execute()

  }))

  before(function() {
    defaultParserEngine = server.org.configuration.defaultParserEngine
  })

  after(callback => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.defaultParserEngine': defaultParserEngine
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  after(sandboxed(function() {
    org.objects.c_ctxapi_393.deleteMany({}).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_393' }).execute()
  }))

  describe('Stable parser engine', function() {
    before(callback => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.defaultParserEngine': 'stable'
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    it('run query with $in only', sandboxed(runQueryWithInOnly))

    it('run query with $in + another match condition', sandboxed(runQueryWithInPlusAnotherMatchCondition))

    it('run query with $in matching elements', sandboxed(runQueryWithInMatchingElements))
  })

  describe('Latest parser engine', function() {
    before(callback => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.defaultParserEngine': 'latest'
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    it('run query with $in only', sandboxed(runQueryWithInOnly))

    it('run query with $in + another match condition', sandboxed(runQueryWithInPlusAnotherMatchCondition))

    it('run query with $in matching elements', sandboxed(runQueryWithInMatchingElements))
  })
})

function runQueryWithInOnly() {
  require('should')
  /* global org */
  const result = org.objects.c_ctxapi_393.find({
    c_task: { $in: [] }
  }).engine('latest').toArray()

  result.length.should.equal(0)
}

function runQueryWithInPlusAnotherMatchCondition() {
  require('should')
  /* global org */
  const result = org.objects.c_ctxapi_393.find({
    c_task: { $in: [] },
    c_type: { $eq: 'Other' }
  }).engine('latest').toArray()

  result.length.should.equal(0)
}

function runQueryWithInMatchingElements() {
  require('should')
  /* global org */
  const firstItem = org.objects.c_ctxapi_393.find().toArray()[0],
        result = org.objects.c_ctxapi_393.find({
          'c_task.c_string': { $in: [firstItem.c_task[0].c_string] },
          c_type: { $eq: 'Document' }
        }).engine('latest').toArray()

  result.length.should.equal(2)
}
