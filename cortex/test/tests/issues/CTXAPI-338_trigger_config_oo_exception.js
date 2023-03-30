'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issue - Trigger with OO as configuration', function() {

  describe('CTXAPI-338 - creat trigger with an OO as configuration', function() {

    before(sandboxed(function() {
      org.objects.objects.insertOne({
        label: 'c_ctxapi_338_report',
        name: 'c_ctxapi_338_report',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'Report Data',
          name: 'c_report',
          type: 'String'
        }]
      }).execute()

      const reportModelName = 'c_ctxapi_338_report',
            {
              oo,
              [reportModelName]: report
            } = org.objects,
            ooName = 'o_ctxapi_338',
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
    }))

    it('get document with audit.history on it', sandboxed(function() {
      require('should')
      const tryCatch = require('util.values').tryCatch
      tryCatch(function() {
        /* global org */
        org.objects.script.insertOne({
          label: 'CTXAPI-338 Trigger',
          name: 'c_ctxapi_338_trigger',
          type: 'trigger',
          script: `
              import logger from 'logger'
              logger.debug('Hi there!')
            `,
          configuration: {
            object: 'o_ctxapi_338',
            event: 'delete.before'
          }
        }).execute()
      }, function(err) {
        if (err.code !== 'kValidationError' && err.faults[0].errorCode !== 'cortex.invalidArgument.object') {
          throw new Error(`Expected kValidationError on ${err.faults[0].path}`)
        }
      })

    }))

  })

})
