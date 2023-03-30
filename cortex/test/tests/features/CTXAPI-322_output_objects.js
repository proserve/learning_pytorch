'use strict'

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      should = require('should'),
      { promised, sleep, isSet } = require('../../../lib/utils'),
      modules = require('../../../lib/modules'),
      cleanInstances = function() {
        org.objects.c_ctxapi_322_patient.deleteMany().execute()
        org.objects.c_ctxapi_322_child.deleteMany().execute()
        org.objects.c_ctxapi_322_report.deleteMany().execute()
        org.objects.oo.deleteMany().execute()
      },
      _ = require('lodash')

describe('CTXAPI-322 - Output Objects', function() {

  before(sandboxed(function() {

    /* global org */

    org.objects.objects.insertOne({
      label: 'CTXAPI-322 Names',
      name: 'c_ctxapi_322_child',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        name: 'c_name',
        label: 'c_name',
        type: 'String',
        indexed: true
      }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-322',
      name: 'c_ctxapi_322_patient',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        { name: 'c_name', label: 'Name', type: 'String', indexed: true },
        { name: 'c_height', label: 'Height', type: 'Number', indexed: true },
        { name: 'c_weight', label: 'Weight', type: 'Number', indexed: true },
        {
          name: 'c_list',
          label: 'c_list',
          type: 'List',
          readThrough: true,
          writeThrough: true,
          sourceObject: 'c_ctxapi_322_child'
        }, {
          name: 'c_ref',
          label: 'c_ref',
          type: 'Reference',
          expandable: true,
          writeThrough: true,
          sourceObject: 'c_ctxapi_322_child'
        },
        {
          name: 'c_docs',
          label: 'Document Array',
          type: 'Document',
          array: true,
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String'
          }]
        }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'c_ctxapi_322_report',
      name: 'c_ctxapi_322_report',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [{
        label: 'Report Data',
        name: 'c_report',
        type: 'String'
      }]
    }).execute()
  }))

  after(sandboxed(function() {
    const should = require('should')
    org.objects.objects.deleteOne({ name: 'c_ctxapi_322_patient' }).execute().should.equal(true)
    org.objects.objects.deleteOne({ name: 'c_ctxapi_322_child' }).execute().should.equal(true)
    org.objects.objects.deleteOne({ name: 'c_ctxapi_322_report' }).execute().should.equal(true)

    should.equal(org.objects.objects.find({ name: 'c_ctxapi_322_patient' }).count(), 0)
    should.equal(org.objects.objects.find({ name: 'c_ctxapi_322_child' }).count(), 0)
    should.equal(org.objects.objects.find({ name: 'c_ctxapi_322_report' }).count(), 0)
  }))

  describe('Cascade Delete', function() {

    afterEach(sandboxed(cleanInstances))

    it('should delete the output object with cascadeDelete = true', async() => {

      let done = false,
          err = null,
          result

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                console.log('Message Worker: ', message.worker)
                if (message.worker === 'cascade-deleter') {
                  done = true
                }
                err = e
              }
            }

      server.events.on('worker.done', handler)

      // Create the output object and the report
      result = await promised(null, sandboxed(function() {
        let ooDefinition, ooListData, reportInstance
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          expiresAt: Date.now() + (1000 * 60),
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()

        oo.updateOne({ name: ooName }, {
          $push: [{
            c_string: 'Cascade Delete Test'
          }]
        })
          .pathPrefix('list')
          .execute()

        ooDefinition = oo.find({ name: ooName }).next()
        ooListData = oo.find().prefix(`${ooDefinition._id}/list`).next()
        reportInstance = report.find().next()

        return { reportInstance, ooDefinition, ooListData }
      }))

      should.exist(result)

      result.ooDefinition.cascadeDelete.should.equal(true)
      result.ooDefinition.label.should.equal('o_ctxapi_322')
      result.ooDefinition.listOptions.implicitCreateAccessLevel.should.equal(7)
      result.ooDefinition.listOptions.writeThrough.should.equal(true)
      result.ooDefinition.listOptions.updateOnWriteThrough.should.equal(false)
      result.ooDefinition.listOptions.grant.should.equal(6)
      result.ooListData.c_string.should.equal('Cascade Delete Test')
      result.reportInstance.c_report.should.equal('o_ctxapi_322')

      // Delete the report (context)
      result = await promised(null, sandboxed(function() {
        return org.objects.c_ctxapi_322_report.deleteMany().execute()
      }))

      result.should.equal(1)

      // Wait for the cascade deleter to be done
      while (1) {
        if (err || done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      // Check the oo has been cleaned successfully
      await promised(null, sandboxed(function() {
        require('should')
        org.objects.oo.find({ name: 'o_ctxapi_322' }).count().should.equal(0)
        org.objects.oo.find().count().should.equal(0)
      }))
    })

    it('should set cascadeDelete to true by default', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const reportModelName = 'c_ctxapi_322_report',
                {
                  oo,
                  [reportModelName]: report
                } = org.objects,
                ooName = 'o_ctxapi_322',
                reportId = report.insertOne({ c_report: ooName }).execute()

          oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              _id: reportId,
              object: reportModelName
            },
            // Not setting the cascadeDelete on purpose
            // cascadeDelete: false,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()

          return oo.find({ name: ooName }).next()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(error)
      should.exist(result)
      should.equal(result.object, 'oo')
      should.equal(result.label, 'o_ctxapi_322')
      should.equal(result.name, 'o_ctxapi_322')
      should.equal(result.cascadeDelete, true)
    })

    it('should be able to delete an output object with cascadeDelete = false', sandboxed(function() {

      const reportModelName = 'c_ctxapi_322_report',
            debug = require('debug'),
            {
              oo,
              [reportModelName]: report
            } = org.objects,
            ooName = 'o_ctxapi_322',
            reportId = report.insertOne({ c_report: ooName }).execute()

      require('should')
      let ooConfig

      oo.insertOne({
        label: ooName,
        name: ooName,
        context: {
          _id: reportId,
          object: reportModelName
        },
        cascadeDelete: false,
        expiresAt: Date.now() + (1000 * 60 * 60 * 24),
        listOptions: {
          implicitCreateAccessLevel: 'delete',
          writeThrough: true,
          updateOnWriteThrough: false,
          grant: 'update'
        },
        properties: [{
          label: 'String',
          name: 'c_string',
          type: 'String',
          indexed: true,
          writable: true
        }]
      }).bypassCreateAcl(true).execute()

      report.deleteMany().execute()
      debug.sleep(800)

      oo.find({ name: ooName }).count().should.equal(1)
      ooConfig = oo.find({ name: ooName }).next()
      ooConfig.cascadeDelete.should.equal(false)
      ooConfig.label.should.equal(ooName)

      oo.deleteOne({ name: ooName }).execute().should.equal(true)
      oo.find({ name: ooName }).count().should.equal(0)
    }))
  })

  describe('TTL Configuration', function() {

    afterEach(sandboxed(cleanInstances))

    it('should remove the object after reaching TTL', async() => {

      let done = false,
          err = null,
          result

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                if (message.worker === 'instance-reaper') {
                  done = true
                }
                err = e
              }
            }

      server.events.on('worker.done', handler)

      // Create the output object and the report
      result = await promised(null, sandboxed(function() {
        let ooDefinition, ooListData, reportInstance
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          // The expiration time is set to 50 milliseconds in the future
          expiresAt: Date.now() + 50,
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()

        oo.updateOne({ name: ooName }, {
          $push: [{
            c_string: 'TTL Test'
          }]
        })
          .pathPrefix('list')
          .execute()

        ooDefinition = oo.find({ name: ooName }).next()
        ooListData = oo.find().prefix(`${ooDefinition._id}/list`).next()
        reportInstance = report.find().next()

        return { reportInstance, ooDefinition, ooListData }
      }))

      should.exist(result)

      result.ooDefinition.cascadeDelete.should.equal(true)
      result.ooDefinition.label.should.equal('o_ctxapi_322')
      result.ooDefinition.listOptions.implicitCreateAccessLevel.should.equal(7)
      result.ooDefinition.listOptions.writeThrough.should.equal(true)
      result.ooDefinition.listOptions.updateOnWriteThrough.should.equal(false)
      result.ooDefinition.listOptions.grant.should.equal(6)
      result.ooListData.c_string.should.equal('TTL Test')
      result.reportInstance.c_report.should.equal('o_ctxapi_322')

      // Call the reaper
      modules.workers.runNow('instance-reaper')

      // Wait for the reaper to be done
      while (1) {
        if (err || done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await promised(null, sandboxed(function() {
        return org.objects.oo.find({ name: 'o_ctxapi_322' }).count()
      }))

      result.should.equal(0)
    })

    it('should be able to change the TTL after creation', sandboxed(function() {
      const reportModelName = 'c_ctxapi_322_report',
            {
              oo,
              [reportModelName]: report
            } = org.objects,
            ooName = 'o_ctxapi_322',
            reportId = report.insertOne({ c_report: ooName }).execute(),
            should = require('should')

      let ooConfig, newerTTL

      oo.insertOne({
        label: ooName,
        name: ooName,
        context: {
          _id: reportId,
          object: reportModelName
        },
        cascadeDelete: true,
        expiresAt: Date.now() + (1000 * 60 * 10),
        listOptions: {
          implicitCreateAccessLevel: 'delete',
          writeThrough: true,
          updateOnWriteThrough: false,
          grant: 'update'
        },
        properties: [{
          label: 'String',
          name: 'c_string',
          type: 'String',
          indexed: true,
          writable: true
        }]
      }).bypassCreateAcl(true).execute()

      newerTTL = Date.now() + (1000 * 60 * 20)
      oo.updateOne({ name: ooName }, {
        $set: {
          expiresAt: newerTTL
        }
      }).execute()

      ooConfig = oo.find({ name: ooName }).next()
      should.equal(ooConfig.expiresAt.toString(), new Date(newerTTL).toString())
    }))

    it('should not remove the oo with null TTL', async() => {

      let done = false,
          err = null,
          result

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                if (message.worker === 'instance-reaper') {
                  done = true
                }
                err = e
              }
            }

      server.events.on('worker.done', handler)

      // Create the output object and the report
      result = await promised(null, sandboxed(function() {
        let ooDefinition, ooListData, reportInstance
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          // The expiration time is set to null
          expiresAt: null,
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()

        oo.updateOne({ name: ooName }, {
          $push: [{
            c_string: 'TTL Test'
          }]
        })
          .pathPrefix('list')
          .execute()

        ooDefinition = oo.find({ name: ooName }).next()
        ooListData = oo.find().prefix(`${ooDefinition._id}/list`).next()
        reportInstance = report.find().next()

        return { reportInstance, ooDefinition, ooListData }
      }))

      should.exist(result)

      result.ooDefinition.cascadeDelete.should.equal(true)
      result.ooDefinition.label.should.equal('o_ctxapi_322')
      result.ooDefinition.listOptions.implicitCreateAccessLevel.should.equal(7)
      result.ooDefinition.listOptions.writeThrough.should.equal(true)
      result.ooDefinition.listOptions.updateOnWriteThrough.should.equal(false)
      result.ooDefinition.listOptions.grant.should.equal(6)
      result.ooListData.c_string.should.equal('TTL Test')
      result.reportInstance.c_report.should.equal('o_ctxapi_322')

      // Call the reaper
      modules.workers.runNow('instance-reaper')

      // Wait for the reaper to be done
      while (1) {
        if (err || done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await promised(null, sandboxed(function() {
        return org.objects.oo.find({ name: 'o_ctxapi_322' }).count()
      }))

      result.should.equal(1)
    })

    it('should not remove the oo with undefined TTL', async() => {

      let done = false,
          err = null,
          result

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                if (message.worker === 'instance-reaper') {
                  done = true
                }
                err = e
              }
            }

      server.events.on('worker.done', handler)

      // Create the output object and the report
      result = await promised(null, sandboxed(function() {
        let ooDefinition, ooListData, reportInstance
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          // The expiration time is set to undefined
          expiresAt: undefined,
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()

        oo.updateOne({ name: ooName }, {
          $push: [{
            c_string: 'TTL Test'
          }]
        })
          .pathPrefix('list')
          .execute()

        ooDefinition = oo.find({ name: ooName }).next()
        ooListData = oo.find().prefix(`${ooDefinition._id}/list`).next()
        reportInstance = report.find().next()

        return { reportInstance, ooDefinition, ooListData }
      }))

      should.exist(result)

      result.ooDefinition.cascadeDelete.should.equal(true)
      result.ooDefinition.label.should.equal('o_ctxapi_322')
      result.ooDefinition.listOptions.implicitCreateAccessLevel.should.equal(7)
      result.ooDefinition.listOptions.writeThrough.should.equal(true)
      result.ooDefinition.listOptions.updateOnWriteThrough.should.equal(false)
      result.ooDefinition.listOptions.grant.should.equal(6)
      result.ooListData.c_string.should.equal('TTL Test')
      result.reportInstance.c_report.should.equal('o_ctxapi_322')

      // Call the reaper
      modules.workers.runNow('instance-reaper')

      // Wait for the reaper to be done
      while (1) {
        if (err || done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await promised(null, sandboxed(function() {
        return org.objects.oo.find({ name: 'o_ctxapi_322' }).count()
      }))

      result.should.equal(1)
    })

    it('should not remove the oo with no TTL', async() => {

      let done = false,
          err = null,
          result

      const testId = server.mochaCurrentTestUuid,
            handler = (message, e) => {
              if (message.mochaCurrentTestUuid === testId) {
                if (message.worker === 'instance-reaper') {
                  done = true
                }
                err = e
              }
            }

      server.events.on('worker.done', handler)

      // Create the output object and the report
      result = await promised(null, sandboxed(function() {
        let ooDefinition, ooListData, reportInstance
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          // The expiration time is not set on purpose
          // expiresAt: undefined,
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()

        oo.updateOne({ name: ooName }, {
          $push: [{
            c_string: 'TTL Test'
          }]
        })
          .pathPrefix('list')
          .execute()

        ooDefinition = oo.find({ name: ooName }).next()
        ooListData = oo.find().prefix(`${ooDefinition._id}/list`).next()
        reportInstance = report.find().next()

        return { reportInstance, ooDefinition, ooListData }
      }))

      should.exist(result)

      result.ooDefinition.cascadeDelete.should.equal(true)
      result.ooDefinition.label.should.equal('o_ctxapi_322')
      result.ooDefinition.listOptions.implicitCreateAccessLevel.should.equal(7)
      result.ooDefinition.listOptions.writeThrough.should.equal(true)
      result.ooDefinition.listOptions.updateOnWriteThrough.should.equal(false)
      result.ooDefinition.listOptions.grant.should.equal(6)
      result.ooListData.c_string.should.equal('TTL Test')
      result.reportInstance.c_report.should.equal('o_ctxapi_322')

      // Call the reaper
      modules.workers.runNow('instance-reaper')

      // Wait for the reaper to be done
      while (1) {
        if (err || done) {
          break
        }
        await sleep(250)
      }

      server.events.removeListener('worker.done', handler)

      if (err) {
        throw err
      }

      result = await promised(null, sandboxed(function() {
        return org.objects.oo.find({ name: 'o_ctxapi_322' }).count()
      }))

      result.should.equal(1)
    })

  })

  describe('Context (parent) configuration', function() {

    afterEach(sandboxed(cleanInstances))

    it('should not create an oo using a standard object as context', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const { oo } = org.objects,
                ooName = 'o_ctxapi_322'

          return oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              // Set an account instance as context object
              _id: script.principal._id,
              object: 'account'
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'validation')
      should.equal(error.faults[0].errCode, 'cortex.invalidArgument.customName')
      should.equal(error.faults[0].statusCode, 400)
      should.equal(error.faults[0].message, 'Invalid custom/namespaced value.')
      should.equal(error.faults[0].path, 'oo.context.object')
      should.equal(error.faults[0].resource, 'oo.name(o_ctxapi_322).context.object')
    })

    it('should not create an oo using a non existing object as context', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const { oo } = org.objects,
                ooName = 'o_ctxapi_322'

          return oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              _id: script.principal._id,
              object: 'c_does_not_exist'
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'error')
      should.equal(error.faults[0].errCode, 'cortex.invalidArgument.object')
      should.equal(error.faults[0].statusCode, 400)
      should.equal(error.faults[0].message, 'Invalid or unknown object.')
      should.equal(error.faults[0].path, 'c_does_not_exist')
      should.equal(error.faults[0].resource, 'oo.name(o_ctxapi_322).context._id')
    })

    it('should not create an oo using a non existing instance as context', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const { oo } = org.objects,
                ooName = 'o_ctxapi_322'

          return oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              // Use another _id so the instance won't exist on c_ctxapi_322_report
              _id: script.principal._id,
              object: 'c_ctxapi_322_report'
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'db')
      should.equal(error.faults[0].errCode, 'cortex.notFound.instance')
      should.equal(error.faults[0].statusCode, 404)
      should.equal(error.faults[0].message, 'Instance not found.')
      should.equal(error.faults[0].path, 'c_ctxapi_322_report')
      should.equal(error.faults[0].resource, 'oo.name(o_ctxapi_322).context._id')
    })

    it('should not create an oo using another output object as context', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const { oo } = org.objects,
                ooName = 'o_ctxapi_322',
                reportId = org.objects.c_ctxapi_322_report.insertOne({
                  c_report: 'o_ctxapi_322'
                }).execute()

          let ooId

          ooId = oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              _id: reportId,
              object: 'c_ctxapi_322_report'
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()

          return oo.insertOne({
            label: 'Another oo',
            name: 'o_ctxapi_322_new',
            context: {
              _id: ooId,
              object: 'oo'
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'validation')
      should.equal(error.faults[0].errCode, 'cortex.invalidArgument.customName')
      should.equal(error.faults[0].statusCode, 400)
      should.equal(error.faults[0].message, 'Invalid custom/namespaced value.')
      should.equal(error.faults[0].path, 'oo.context.object')
      should.equal(error.faults[0].resource, 'oo.name(o_ctxapi_322_new).context.object')
    })

    it('should not create an output object without context', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const { oo } = org.objects,
                ooName = 'o_ctxapi_322'

          return oo.insertOne({
            label: ooName,
            name: ooName,
            cascadeDelete: true,
            // We're not setting the context
            // context: {},
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'validation')
      should.equal(error.faults[0].errCode, 'cortex.invalidArgument.required')
      should.equal(error.faults[0].statusCode, 400)
      should.equal(error.faults[0].reason, 'Required property')
      should.equal(error.faults[0].path, 'oo.context._id')
      should.equal(error.faults[0].resource, 'oo.name(o_ctxapi_322).context._id')
    })
  })

  describe('Output Objects immutability', function() {
    afterEach(sandboxed(cleanInstances))

    it('should not write the output object after creation', async() => {

      let error, Undefined

      await promised(null, sandboxed(function() {
        const reportModelName = 'c_ctxapi_322_report',
              {
                oo,
                [reportModelName]: report
              } = org.objects,
              ooName = 'o_ctxapi_322',
              reportId = report.insertOne({ c_report: ooName }).execute()

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          expiresAt: Date.now() + (1000 * 60 * 10),
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [{
            label: 'String',
            name: 'c_string',
            type: 'String',
            indexed: true,
            writable: true
          }]
        }).bypassCreateAcl(true).execute()
      }))

      try {
        await promised(null, sandboxed(function() {
          return org.objects.oo.updateOne({ name: 'o_ctxapi_322' }, {
            $set: {
              cascadeDelete: false
            }
          }).execute()
        }))
        error = Undefined
      } catch (e) {
        error = e
      }

      checkCreatableOnlyError(error, 'cascadeDelete')

      try {
        await promised(null, sandboxed(function() {
          return org.objects.oo.updateOne({ name: 'o_ctxapi_322' }, {
            $set: {
              name: 'o_new_name'
            }
          }).execute()
        }))
        error = Undefined
      } catch (e) {
        error = e
      }

      checkCreatableOnlyError(error, 'name')

      try {
        await promised(null, sandboxed(function() {
          /* global script */
          let accountId = script.principal._id

          return org.objects.oo.updateOne({ name: 'o_ctxapi_322' }, {
            $set: {
              context: {
                _id: accountId,
                object: 'account'
              }
            }
          }).execute()
        }))
        error = Undefined
      } catch (e) {
        error = e
      }

      checkCreatableOnlyError(error, 'context')

      try {
        await promised(null, sandboxed(function() {
          return org.objects.oo.updateOne({ name: 'o_ctxapi_322' }, {
            $set: {
              listOptions: {
                implicitCreateAccessLevel: 'update',
                writeThrough: false,
                updateOnWriteThrough: true,
                grant: 'delete'
              }
            }
          }).execute()
        }))
        error = Undefined
      } catch (e) {
        error = e
      }

      checkCreatableOnlyError(error, 'listOptions')

      try {
        await promised(null, sandboxed(function() {
          return org.objects.oo.updateOne({ name: 'o_ctxapi_322' }, {
            $push: {
              properties: [{
                label: 'Number',
                name: 'c_number',
                type: 'Number',
                indexed: true,
                writable: true
              }]
            }
          }).execute()
        }))
        error = Undefined
      } catch (e) {
        error = e
      }

      checkCreatableOnlyErrorCommonAttributes(error)
      should.equal(error.faults[0].path, 'oo.properties[]')
      should.equal(/oo.name\(o_ctxapi_322\).properties\[]._id\(\w*\)/.test(error.faults[0].resource), true)
    })
  })

  describe('Usage of output objects as references', function() {

    after(sandboxed(cleanInstances))

    it('should not use an output object as a source object for a reference', async() => {
      let error, result
      try {
        result = await promised(null, sandboxed(function() {
          const reportModelName = 'c_ctxapi_322_report',
                {
                  oo,
                  [reportModelName]: report,
                  objects: objectsModel
                } = org.objects,
                ooName = 'o_ctxapi_322',
                reportId = report.insertOne({ c_report: ooName }).execute()

          oo.insertOne({
            label: ooName,
            name: ooName,
            context: {
              _id: reportId,
              object: reportModelName
            },
            cascadeDelete: true,
            expiresAt: Date.now() + (1000 * 60 * 15),
            listOptions: {
              implicitCreateAccessLevel: 'delete',
              writeThrough: true,
              updateOnWriteThrough: false,
              grant: 'update'
            },
            properties: [{
              label: 'String',
              name: 'c_string',
              type: 'String',
              indexed: true,
              writable: true
            }]
          }).bypassCreateAcl(true).execute()

          return objectsModel.insertOne({
            label: 'CTXAPI-322 OO reference',
            name: 'c_ctxapi_322_oo_reference',
            defaultAcl: 'owner.delete',
            createAcl: 'account.public',
            properties: [{
              label: 'OO Ref',
              name: 'c_oo_ref',
              type: 'Reference',
              expandable: true,
              indexed: true,
              sourceObject: 'oo'
            }, {
              label: 'OO Instance Ref',
              name: 'c_oo_instance_ref',
              type: 'Reference',
              expandable: true,
              indexed: true,
              sourceObject: ooName
            }]
          }).execute()
        }))
      } catch (e) {
        error = e
      }

      should.not.exist(result)
      should.exist(error)
      should.equal(error.name, 'error')
      should.equal(error.errCode, 'cortex.invalidArgument.validation')
      should.equal(error.statusCode, 400)
      should.equal(error.reason, 'Validation error.')
      should.equal(error.faults.length, 1)
      should.equal(error.faults[0].name, 'error')
      should.equal(error.faults[0].errCode, 'cortex.invalidArgument.unspecified')
      should.equal(error.faults[0].statusCode, 400)
      should.equal(error.faults[0].message, 'Invalid Argument.')
      should.equal(error.faults[0].reason, 'Output objects cannot be referenced')
      should.equal(error.faults[0].path, 'object.properties[]#Reference.sourceObject')
      should.equal(error.faults[0].resource, 'object.name(c_ctxapi_322_oo_reference).properties.sourceObject')
    })
  })

  describe('Output Objects on transforms as ephemeral input stage for the next operation', function() {

    beforeEach(sandboxed(function() {

      require('should')
      let children = org.objects.c_ctxapi_322_child.insertMany([
        { c_name: 'John' },
        { c_name: 'John Paul' },
        { c_name: 'Jimmy' },
        { c_name: 'Robert' }
      ]).execute()

      children.insertedCount.should.equal(4)

      org.objects.c_ctxapi_322_patient.insertMany([{
        c_name: 'Patient 1',
        c_height: 1.70,
        c_weight: 70,
        c_ref: children.insertedIds[0]._id
      }, {
        c_name: 'Patient 2',
        c_height: 1.88,
        c_weight: 80,
        c_ref: children.insertedIds[1]._id
      }, {
        c_name: 'Patient 3',
        c_height: 1.75,
        c_weight: 75,
        c_ref: children.insertedIds[2]._id
      }, {
        c_name: 'Patient 4',
        c_height: 1.99,
        c_weight: 120,
        c_ref: children.insertedIds[3]._id
      }]).execute()

      org.objects.c_ctxapi_322_patient.find().count().should.equal(4)
    }))

    afterEach(sandboxed(cleanInstances))

    it('should read data from patient, accumulate it on oo, and make a simple report', async() => {

      const should = require('should')
      let result

      result = await promised(null, sandboxed(function() {
        const reportModelName = 'c_ctxapi_322_report',
              ooName = 'o_ctxapi_322',
              {
                [reportModelName]: report,
                oo,
                bulk,
                c_ctxapi_322_patient: patient
              } = org.objects,
              total = patient.find().count(),
              reportId = report.insertOne({ c_report: ooName }).execute()

        let memo

        oo.insertOne({
          label: ooName,
          name: ooName,

          context: {
            _id: reportId,
            object: reportModelName
          },

          cascadeDelete: true,
          expiresAt: Date.now() + (1000 * 60 * 15),
          listOptions: {
            implicitCreateAccessLevel: 'delete',

            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },

          properties: [{
            label: 'Height',
            name: 'c_height',
            type: 'Number',
            indexed: true,
            writable: true
          }, {
            label: 'Weight',
            name: 'c_weight',
            type: 'Number',
            indexed: true,
            writable: true
          }]

        }).bypassCreateAcl(true).execute()

        memo = {
          count: 0,
          piAccumulator: 0,
          heightAccumulator: 0,
          weightAccumulator: 0,
          total,
          ooName,
          reportModelName,
          reportId
        }

        script.exit(
          bulk()
            .add(
              patient.aggregate()
                .project({
                  c_height: 1,
                  c_weight: 1
                })
                .transform({
                  memo,
                  autoPrefix: true,
                  script: `
            each(object, memo) {
              org.objects.OOs
                .updateOne(
                  {
                    name: memo.ooName
                  },
                  {
                    $push: [{
                      c_height: object.c_height,
                      c_weight: object.c_weight
                    }]
                  }
                )
                .pathPrefix('list')
                .execute()

              memo.count += 1

              return {
                object: 'progress',
                percent: memo.count / memo.total
              }
            }
          `
                }),
              {
                wrap: false
              }
            )

            .add(

              oo.find()
                .prefix(`${ooName}/list`)
                .transform(`
            each(object, memo) {
              memo.piAccumulator += object.c_weight / Math.pow(object.c_height, 3)
              memo.weightAccumulator += object.c_weight
              memo.heightAccumulator += object.c_height
            }
        `),
              {
                wrap: false
              }
            )
            .add(
              oo.find()
                .prefix(`${ooName}/list`)
                .transform(`
            each(object, memo) {
              return undefined
            }
  
            after(memo, { cursor }) {
              org.objects[memo.reportModelName].deleteOne({_id: memo.reportId}).execute()

              let averagePonderalIndex = memo.piAccumulator / memo.count,
                averageHeight = memo.heightAccumulator / memo.count,
                averageWeight = memo.weightAccumulator / memo.count
            
              cursor.push({
                object: 'report-totals',
                averagePonderalIndex,
                averageHeight,
                averageWeight,
                ...memo
              })
            }
        `),
              {
                wrap: false
              }
            ).toArray()
        )
      }))

      should.exist(result)
      should.equal(result.length, 5)

      should.equal(result[0].object, 'progress')
      should.equal(result[0].percent, 0.25)
      should.equal(result[1].object, 'progress')
      should.equal(result[1].percent, 0.5)
      should.equal(result[2].object, 'progress')
      should.equal(result[2].percent, 0.75)
      should.equal(result[3].object, 'progress')
      should.equal(result[3].percent, 1)

      should.equal(result[4].object, 'report-totals')
      should.equal(result[4].averagePonderalIndex, 13.877268283795441)
      should.equal(result[4].averageHeight, 1.83)
      should.equal(result[4].averageWeight, 86.25)
      should.equal(result[4].count, 4)
      should.equal(result[4].piAccumulator, 55.509073135181765)
      should.equal(result[4].heightAccumulator, 7.32)
      should.equal(result[4].weightAccumulator, 345)
      should.equal(result[4].total, 4)
      should.equal(result[4].ooName, 'o_ctxapi_322')
      should.equal(result[4].reportModelName, 'c_ctxapi_322_report')

    })

    it('should read data from child through a reference, write it on oo, and read the result from the cursor', sandboxed(function() {
      const reportModelName = 'c_ctxapi_322_report',
            ooName = 'o_ctxapi_322',
            {
              [reportModelName]: report,
              oo,
              bulk,
              c_ctxapi_322_patient: patient
            } = org.objects,
            reportId = report.insertOne({ c_report: ooName }).execute(),
            should = require('should')

      let memo, cursor, result

      oo.insertOne({
        label: ooName,
        name: ooName,

        context: {
          _id: reportId,
          object: reportModelName
        },

        cascadeDelete: true,
        expiresAt: Date.now() + (1000 * 60 * 15),
        listOptions: {
          implicitCreateAccessLevel: 'delete',

          writeThrough: true,
          updateOnWriteThrough: false,
          grant: 'update'
        },

        properties: [{
          label: 'Ref Name',
          name: 'c_ref_name',
          type: 'String',
          indexed: true,
          writable: true
        }, {
          label: 'Height',
          name: 'c_height',
          type: 'Number',
          indexed: true,
          writable: true
        }, {
          label: 'Weight',
          name: 'c_weight',
          type: 'Number',
          indexed: true,
          writable: true
        }]

      }).bypassCreateAcl(true).execute()

      memo = {
        count: 0,
        ooName,
        reportModelName,
        reportId
      }

      cursor = bulk()
        .add(
          patient.aggregate()
            .project({
              c_height: 1,
              c_weight: 1,
              c_ref: {
                $expand: [
                  'c_name'
                ]
              }
            })
            .transform({
              memo,
              autoPrefix: true,
              script: `
          each(object, memo) {
            org.objects.OOs
              .updateOne(
                {
                  name: memo.ooName
                },
                {
                  $push: [{
                    c_ref_name: object.c_ref.c_name,
                    c_height: object.c_height,
                    c_weight: object.c_weight
                  }]
                }
              )
              .pathPrefix('list')
              .execute()

            return undefined
          }
        `
            }),
          {
            wrap: false
          }
        )
        .add(
          oo.find()
            .prefix(`${ooName}/list`)
            .transform(`
          after(memo, { cursor }) {
            org.objects[memo.reportModelName].deleteOne({_id: memo.reportId}).execute()
          }
      `),
          {
            wrap: false
          }
        )

      should.equal(cursor.hasNext(), true)
      result = cursor.next()

      should.equal(result.c_ref_name, 'John')
      should.equal(result.c_height, 1.7)
      should.equal(result.c_weight, 70)

      should.equal(cursor.hasNext(), true)
      result = cursor.next()

      should.equal(result.c_ref_name, 'John Paul')
      should.equal(result.c_height, 1.88)
      should.equal(result.c_weight, 80)

      should.equal(cursor.hasNext(), true)
      result = cursor.next()

      should.equal(result.c_ref_name, 'Jimmy')
      should.equal(result.c_height, 1.75)
      should.equal(result.c_weight, 75)

      should.equal(cursor.hasNext(), true)
      result = cursor.next()

      should.equal(result.c_ref_name, 'Robert')
      should.equal(result.c_height, 1.99)
      should.equal(result.c_weight, 120)

      should.equal(cursor.hasNext(), false)
    }))

    it('should generate a report reading through list references', async() => {
      let result, dumpArray, readArray, groupArray, resultArray, header

      await promised(null, sandboxed(cleanInstances))

      result = await promised(null, sandboxed(function() {
        const {
          c_ctxapi_322_patient: patient,
          c_ctxapi_322_child: child
        } = org.objects

        let index = 0,
            childData = [],
            patientData = []

        while (index < 10) {
          childData[index] = { c_name: 'child' + index }
          patientData[index] = { c_name: 'patient' + index }
          index += 1
        }

        return {
          child: child.insertMany(childData).execute(),
          patient: patient.insertMany(patientData).execute()
        }

      }))

      should.exist(result)
      should.equal(result.child.insertedCount, 10)
      should.equal(result.patient.insertedCount, 10)

      result = await promised(null, sandboxed(function() {
        const ooName = 'o_ctxapi_322',
              reportModelName = 'c_ctxapi_322_report',
              {
                [reportModelName]: report,
                bulk,
                oo,
                c_ctxapi_322_patient: patient
              } = org.objects,
              reportId = report.insertOne({ c_report: ooName }).execute()

        let memo

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          expiresAt: Date.now() + (1000 * 60 * 15),
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [
            {
              label: 'Object Type',
              name: 'c_type',
              type: 'String',
              indexed: true,
              writable: true
            },
            {
              label: 'Object',
              name: 'c_object',
              type: 'Any',
              writable: true
            },
            {
              label: 'Path',
              name: 'c_path',
              type: 'String',
              writable: true
            },
            {
              label: 'Description',
              name: 'c_description',
              type: 'String',
              writable: true
            }
          ]
        }).bypassCreateAcl(true).execute()

        memo = {
          ooName,
          reportModelName,
          reportId
        }

        return bulk()
          .add(
            patient.aggregate()
              .transform(
                {
                  autoPrefix: true,
                  memo,
                  script: `
                    each(object, memo) {

                      org.objects.OOs
                        .updateOne(
                          {
                            name: memo.ooName
                          },
                          {
                            $push: [{
                              c_type: object.object,
                              c_object: object,
                              c_path: object._id
                            }]
                          }
                        )
                        .pathPrefix('list')
                        .execute()

                      return {
                        type: 'dump',
                        patient: object.c_name
                      }
                    }
                  `
                }
              ),
            {
              wrap: false
            }
          )
          .add(
            oo
              .aggregate()
              .prefix(`${ooName}/list`)
              .transform(
                {
                  memo,
                  autoPrefix: true,
                  script: `
                    each(object, memo) {

                      if(object.c_type === 'c_ctxapi_322_patient') {
                        const children = org.objects.c_ctxapi_322_patient.aggregate().prefix(object.c_path + '/c_list') || []
                        org.objects.OOs
                          .updateOne(
                            {
                              name: memo.ooName
                            },
                            {
                              $push: children.map(child => {
                                return {
                                  c_type: 'c_ctxapi_322_child',
                                  c_object: child,
                                  c_description: child.c_name,
                                  c_path: object.c_path + '/c_list/' + child._id
                                }
                              })
                            }
                          )
                          .pathPrefix('list')
                          .execute()
                      }

                      return {
                        type: 'read',
                        patient: object.c_object.c_name
                      }
                    }
                  `
                }),
            {
              wrap: false
            }
          )
          .add(
            oo
              .aggregate([
                { $match: { c_type: 'c_ctxapi_322_child' } },
                {
                  $project: {
                    c_description: 1
                  }
                },
                {
                  '$group': {
                    _id: 'c_description',
                    count: {
                      $count: 'c_description'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ])
              .prefix(`${ooName}/list`)
              .transform(
                {
                  memo,
                  autoPrefix: true,
                  script: `

                    each(object, memo) {
                      org.objects.OOs
                            .updateOne(
                              {
                                name: memo.ooName
                              },
                              {
                                $push: [{ c_object: object, c_type: 'result' }]
                              }
                            )
                            .pathPrefix('list')
                            .execute()
                      return {
                        type: 'group',
                        data: object
                      }
                    }
                `
                }),
            {
              wrap: false
            }
          )
          .add(
            oo
              .aggregate()
              .prefix(`${ooName}/list`)
              .transform(
                {
                  memo,
                  autoPrefix: true,
                  script: `
                    beforeAll(memo, {cursor}) {
                      cursor.push({
                        type: 'result',
                        data: {
                          key: 'header',
                          value: ['Child','Count']
                        }
                      })
                    }
      
                    each(object, memo, {cursor}) {
                      if(object.c_type === 'result') {
                        cursor.push({
                          type: 'result',
                          data: {
                            key: 'row',
                            value: [object.c_object._id, object.c_object.count]
                          }
                        })
                      }
                    }
                `
                }),
            {
              wrap: false
            }
          )
          .toArray()
      }))

      should.exist(result)
      should.equal(result.length, 41)

      dumpArray = _.slice(result, 0, 10)
      checkResultsArrayValues(dumpArray, 'dump', (elem, i) => {
        should.equal(elem.patient, 'patient' + i)
      })

      readArray = _.slice(result, 10, 20)
      checkResultsArrayValues(readArray, 'read', (elem, i) => {
        should.equal(elem.patient, 'patient' + i)
      })

      groupArray = _.slice(result, 20, 30)
      checkResultsArrayValues(groupArray, 'group', (elem, i) => {
        should.exist(elem.data)
        should.equal(elem.data._id, 'child' + i)
        should.equal(elem.data.count, 10)
      })

      header = result[30]
      should.equal(header.type, 'result')
      should.exist(header.data)
      should.equal(header.data.key, 'header')
      should.equal(header.data.value.length, 2)
      should.equal(header.data.value[0], 'Child')
      should.equal(header.data.value[1], 'Count')

      resultArray = _.slice(result, 31, 41)
      checkResultsArrayValues(resultArray, 'result', (elem, i) => {
        should.exist(elem.data)
        should.equal(elem.data.key, 'row')
        should.equal(elem.data.value.length, 2)
        should.equal(elem.data.value[0], 'child' + i)
        should.equal(elem.data.value[1], 10)
      })
    })

    it('should generate a report reading through list references using headless cursor', async() => {
      let result, op
      const lockName = 'c_ctxapi_322_lock',
            cancelledCacheKey = 'c_ctxapi_322_cancelled_key',
            completedCacheKey = 'c_ctxapi_322_completed_key'

      await promised(null, sandboxed(cleanInstances))

      result = await promised(null, sandboxed(function() {
        const {
          c_ctxapi_322_patient: patient,
          c_ctxapi_322_child: child
        } = org.objects

        let index = 0,
            childData = [],
            patientData = []

        while (index < 10) {
          childData[index] = { c_name: 'child' + index }
          patientData[index] = { c_name: 'patient' + index }
          index += 1
        }

        return {
          child: child.insertMany(childData).execute(),
          patient: patient.insertMany(patientData).execute()
        }

      }))

      should.exist(result)
      should.equal(result.child.insertedCount, 10)
      should.equal(result.patient.insertedCount, 10)

      op = await promised(null, sandboxed(function() {
        const ooName = 'o_ctxapi_322',
              reportModelName = 'c_ctxapi_322_report',
              { arguments: { lockName, cancelledCacheKey, completedCacheKey } } = script,
              {
                [reportModelName]: report,
                bulk,
                oo,
                c_ctxapi_322_patient: patient
              } = org.objects,
              reportId = report.insertOne({ c_report: ooName }).execute()

        let memo

        oo.insertOne({
          label: ooName,
          name: ooName,
          context: {
            _id: reportId,
            object: reportModelName
          },
          cascadeDelete: true,
          expiresAt: Date.now() + (1000 * 60 * 15),
          listOptions: {
            implicitCreateAccessLevel: 'delete',
            writeThrough: true,
            updateOnWriteThrough: false,
            grant: 'update'
          },
          properties: [
            {
              label: 'Object Type',
              name: 'c_type',
              type: 'String',
              indexed: true,
              writable: true
            },
            {
              label: 'Object',
              name: 'c_object',
              type: 'Any',
              writable: true
            },
            {
              label: 'Path',
              name: 'c_path',
              type: 'String',
              writable: true
            },
            {
              label: 'Description',
              name: 'c_description',
              type: 'String',
              writable: true
            }
          ]
        }).bypassCreateAcl(true).execute()

        memo = {
          ooName,
          reportModelName,
          reportId
        }

        return bulk()
          .add(
            patient.aggregate()
              .transform(
                {
                  autoPrefix: true,
                  memo,
                  script: `
                    each(object, memo) {

                      require('debug').sleep(50)
                      org.objects.OOs
                        .updateOne(
                          {
                            name: memo.ooName
                          },
                          {
                            $push: [{
                              c_type: object.object,
                              c_object: object,
                              c_path: object._id
                            }]
                          }
                        )
                        .pathPrefix('list')
                        .execute()

                      return undefined
                    }
                  `
                }
              ),
            {
              wrap: false
            }
          )
          .add(
            oo
              .aggregate()
              .prefix(`${ooName}/list`)
              .transform(
                {
                  memo,
                  autoPrefix: true,
                  script: `
                    each(object, memo) {

                      if(object.c_type === 'c_ctxapi_322_patient') {
                        const children = org.objects.c_ctxapi_322_patient.aggregate().prefix(object.c_path + '/c_list') || []
                        org.objects.OOs
                          .updateOne(
                            {
                              name: memo.ooName
                            },
                            {
                              $push: children.map(child => {
                                return {
                                  c_type: 'c_ctxapi_322_child',
                                  c_object: child,
                                  c_description: child.c_name,
                                  c_path: object.c_path + '/c_list/' + child._id
                                }
                              })
                            }
                          )
                          .pathPrefix('list')
                          .execute()
                      }

                      return undefined
                    }
                  `
                }),
            {
              wrap: false
            }
          )
          .add(
            oo
              .aggregate([
                { $match: { c_type: 'c_ctxapi_322_child' } },
                {
                  $project: {
                    c_description: 1
                  }
                },
                {
                  '$group': {
                    _id: 'c_description',
                    count: {
                      $count: 'c_description'
                    }
                  }
                },
                {
                  $sort: {
                    _id: 1
                  }
                }
              ])
              .prefix(`${ooName}/list`)
              .transform(
                {
                  memo,
                  autoPrefix: true,
                  script: `

                    each(object, memo) {
                      org.objects.OOs
                            .updateOne(
                              {
                                name: memo.ooName
                              },
                              {
                                $push: [{ c_object: object, c_type: 'result' }]
                              }
                            )
                            .pathPrefix('list')
                            .execute()
                      return undefined
                    }
                `
                }),
            {
              wrap: false
            }
          )
          .async({
            lock: {
              name: lockName,
              restart: false,
              onSignal: `
                  if (script.arguments.signal === 'cancel') {
                    require('cache').set('${cancelledCacheKey}', true)
                  }
              `
            },
            onComplete: `
                require('cache').set('${completedCacheKey}', true)
            `
          }).next()
      }, {
        runtimeArguments: {
          lockName,
          cancelledCacheKey,
          completedCacheKey
        }
      }))

      should.exist(op)
      op = modules.runtime.db.findOne({ uuid: op.uuid }).export()
      op.type.should.equal('db.bulk')
      op.object.should.equal('operation')
      op.cancelled.should.equal(false)
      op.async.should.equal(true)
      op.state.should.equal('started')
      should.not.exist(op.stopped)
      should.not.exist(op.err)
      should.exist(op.lock)
      should.exist(op.lock._id)
      op.lock.name.should.equal(lockName)

      while (1) {
        const cached = await promised(modules.cache, 'get', server.org, completedCacheKey)
        if (isSet(cached)) {
          cached.should.equal(true)
          break
        }
        await sleep(10)
      }

      result = await promised(null, sandboxed(function() {
        return org.objects.oos
          .find({ c_type: 'result' })
          .pathPrefix('o_ctxapi_322/list')
          .toArray()
      }))

      should.exist(result)
      result.length.should.equal(10)
      for (let i = 0; i < 10; i++) {
        result[i].c_type.should.equal('result')
        should.exist(result[i].c_object)
        result[i].c_object._id.should.equal('child' + i)
        result[i].c_object.count.should.equal(10)
      }
    })
  })
})

function checkCreatableOnlyError(error, propName) {
  checkCreatableOnlyErrorCommonAttributes(error)
  should.equal(error.faults[0].path, `oo.${propName}`)
  should.equal(error.faults[0].resource, `oo.name(o_ctxapi_322).${propName}`)
}

function checkCreatableOnlyErrorCommonAttributes(error) {
  should.exist(error)
  should.equal(error.errCode, 'cortex.invalidArgument.validation')
  should.equal(error.statusCode, 400)
  should.equal(error.faults.length, 1)
  should.equal(error.faults[0].name, 'validation')
  should.equal(error.faults[0].errCode, 'cortex.invalidArgument.creatableOnly')
  should.equal(error.faults[0].statusCode, 400)
  should.equal(error.faults[0].message, 'Property is only writable on creation.')
}

function checkResultsArrayValues(array, type, validator) {
  should.equal(array.length, 10)
  for (let i = 0; i < array.length; i++) {
    should.equal(array[i].type, type)
    validator(array[i], i)
  }
}
