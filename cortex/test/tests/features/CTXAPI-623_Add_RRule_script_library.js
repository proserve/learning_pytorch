'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Features - CTXAPI-623 - Add RRule script library', function() {

  it('RRule library can be user on sandbox', async function() {

    const result = await promised(null, sandboxed(function() {
      const { RRule } = require('rrule'),
            rule = new RRule({
              freq: RRule.WEEKLY,
              interval: 5,
              byweekday: [RRule.MO, RRule.FR],
              dtstart: new Date(Date.UTC(2012, 1, 1, 10, 30)),
              until: new Date(Date.UTC(2012, 12, 31))
            })
      return rule.toString()
    }))

    should.exists(result)
    should.equal(result, 'DTSTART:20120201T103000Z\nRRULE:FREQ=WEEKLY;INTERVAL=5;BYDAY=MO,FR;UNTIL=20130131T000000Z')

  })

})
