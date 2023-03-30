'use strict'

require('should')

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - errCode', function() {

  describe('CTXAPI-161 - adding errCode to faults', function() {

    it('fault sandbox generated fault', async() => {

      try {
        await promised(null, sandboxed(function() {
          /* global Fault */
          throw Fault.create('app.someError', 'my reasons are my own')
        }))
      } catch (err) {
        err.errCode.should.equal('app.someError')
        err.reason.should.equal('my reasons are my own')
      }

    })

    it('fault api generated', async() => {

      try {
        await promised(null, sandboxed(function() {
          /* global org */
          return org.objects.obviously_not_an_object.find().next()
        }))
      } catch (err) {
        err.errCode.should.equal('cortex.invalidArgument.object')
      }

    })

  })

})
