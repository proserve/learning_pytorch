'use strict'

/* global org */

const sandboxed = require('../../lib/sandboxed'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Features - Adding audit script interface', function() {

  before(sandboxed(function() {
    org.objects.objects.insertOne({
      label: 'CTXAPI-289',
      name: 'c_ctxapi_289',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        { label: 'name', name: 'c_name', type: 'String', indexed: true }
      ]
    }).execute()
  }))

  after(sandboxed(function() {
    org.objects.objects.deleteMany({ name: 'c_ctxapi_289' }).execute()
  }))

  it('audit log with existing user action (create)', function(done) {
    sandboxed(function() {
      const audit = require('audit'),
            _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute()

      return audit.record('c_ctxapi_289', _id, 'create', { metadata: { message: 'record created' } })
    })((err, _id) => {
      should.equal(err, null)
      modules.db.models.Audit.collection.countDocuments({ _id }, (err, doc) => {
        should.equal(doc, 1)
        done(err)
      })

    })
  })

  it('audit log with Access user action and account object', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      /* global script */
      const audit = require('audit')

      let auditEntryId

      auditEntryId = audit.record('account', script.principal._id, 'access', { metadata: { message: 'Accessed my account' } })

      return {
        auditEntry: org.objects.audit.find({ _id: auditEntryId }).skipAcl().grant(8).next(),
        scriptPrincipalId: script.principal._id
      }
    }))

    should.exist(result.auditEntry)
    should.equal(result.auditEntry.object, 'audit')
    should.equal(result.auditEntry.cat, 'user')
    should.equal(result.auditEntry.sub, 'access')
    should.exist(result.auditEntry.metadata)
    should.equal(result.auditEntry.metadata.message, 'Accessed my account')
    should.exist(result.auditEntry.context)
    should.equal(result.auditEntry.context.object, 'account')
    should.equal(result.auditEntry.context._id.toString(), result.scriptPrincipalId.toString())
  })

  it('audit log with Read user action and custom object', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const audit = require('audit'),
            _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute()

      let auditEntryId

      auditEntryId = audit.record('c_ctxapi_289', _id, 'read', { metadata: { message: 'Read custom object' } })

      return {
        auditEntry: org.objects.audit.find({ _id: auditEntryId }).skipAcl().grant(8).next(),
        customInstanceId: _id
      }
    }))

    should.exist(result.auditEntry)
    should.equal(result.auditEntry.object, 'audit')
    should.equal(result.auditEntry.cat, 'user')
    should.equal(result.auditEntry.sub, 'read')
    should.exist(result.auditEntry.metadata)
    should.equal(result.auditEntry.metadata.message, 'Read custom object')
    should.exist(result.auditEntry.context)
    should.equal(result.auditEntry.context.object, 'c_ctxapi_289')
    should.equal(result.auditEntry.context._id.toString(), result.customInstanceId.toString())
  })

  it('audit log with Update user action and custom object', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const audit = require('audit'),
            _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute()

      let auditEntryId

      auditEntryId = audit.record('c_ctxapi_289', _id, 'update', { metadata: { message: 'Update custom object' } })

      return {
        auditEntry: org.objects.audit.find({ _id: auditEntryId }).skipAcl().grant(8).next(),
        customInstanceId: _id
      }
    }))

    should.exist(result.auditEntry)
    should.equal(result.auditEntry.object, 'audit')
    should.equal(result.auditEntry.cat, 'user')
    should.equal(result.auditEntry.sub, 'update')
    should.exist(result.auditEntry.metadata)
    should.equal(result.auditEntry.metadata.message, 'Update custom object')
    should.exist(result.auditEntry.context)
    should.equal(result.auditEntry.context.object, 'c_ctxapi_289')
    should.equal(result.auditEntry.context._id.toString(), result.customInstanceId.toString())
  })

  it('audit log with Delete user action and custom object', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const audit = require('audit'),
            _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute()

      let auditEntryId

      auditEntryId = audit.record('c_ctxapi_289', _id, 'delete', { metadata: { message: 'Delete custom object' } })

      return {
        auditEntry: org.objects.audit.find({ _id: auditEntryId }).skipAcl().grant(8).next(),
        customInstanceId: _id
      }
    }))

    should.exist(result.auditEntry)
    should.equal(result.auditEntry.object, 'audit')
    should.equal(result.auditEntry.cat, 'user')
    should.equal(result.auditEntry.sub, 'delete')
    should.exist(result.auditEntry.metadata)
    should.equal(result.auditEntry.metadata.message, 'Delete custom object')
    should.exist(result.auditEntry.context)
    should.equal(result.auditEntry.context.object, 'c_ctxapi_289')
    should.equal(result.auditEntry.context._id.toString(), result.customInstanceId.toString())
  })

  it('audit log with Transfer user action and custom object', async function() {
    let result

    result = await promised(null, sandboxed(function() {
      const audit = require('audit'),
            _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute()

      let auditEntryId

      auditEntryId = audit.record('c_ctxapi_289', _id, 'transfer', { metadata: { message: 'Transfer custom object' } })

      return {
        auditEntry: org.objects.audit.find({ _id: auditEntryId }).skipAcl().grant(8).next(),
        customInstanceId: _id
      }
    }))

    should.exist(result.auditEntry)
    should.equal(result.auditEntry.object, 'audit')
    should.equal(result.auditEntry.cat, 'user')
    should.equal(result.auditEntry.sub, 'transfer')
    should.exist(result.auditEntry.metadata)
    should.equal(result.auditEntry.metadata.message, 'Transfer custom object')
    should.exist(result.auditEntry.context)
    should.equal(result.auditEntry.context.object, 'c_ctxapi_289')
    should.equal(result.auditEntry.context._id.toString(), result.customInstanceId.toString())
  })

  it('audit log with non existing user action', sandboxed(function() {
    const audit = require('audit'),
          tryCatch = require('util.values').tryCatch,
          _id = org.objects.c_ctxapi_289.insertOne({ c_name: 'John Smith' }).execute(),
          should = require('should')

    let error

    tryCatch(function() {
      audit.record('c_ctxapi_289', _id, 'execute', { metadata: { message: 'record executed' } })
    }, function(err) {
      error = err
    })

    should.exist(error)
    should.equal(error.code, 'kInvalidArgument')
    should.equal(error.errCode, 'cortex.invalidArgument.unspecified')
  }))

  it('audit log with non id format', sandboxed(function() {
    const audit = require('audit'),
          should = require('should'),
          tryCatch = require('util.values').tryCatch
    tryCatch(function() {
      audit.record('c_ctxapi_289', 'my_id', 'create', { metadata: { message: 'record create' } })
    }, function(err) {
      should.exist(err)
      if (err.code !== 'kInvalidArgument' && err.errCode !== 'cortex.invalidArgument.unspecified') {
        throw new Error('Invalid error returned')
      }
    })
  }))

  it('audit log with non existing object', sandboxed(function() {
    require('should')
    const audit = require('audit'),
          should = require('should'),
          tryCatch = require('util.values').tryCatch
    tryCatch(function() {
      audit.record('c_ctxapi_289_not_existing', '5dc2c3a4073f4bb300e889c8', 'create', { metadata: { message: 'record executed' } })
    }, function(err) {
      should.exist(err)
      if (err.code !== 'kInvalidObject' && err.errCode !== 'cortex.invalidArgument.object') {
        throw new Error('Invalid object or non existing object')
      }
    })
  }))
})
