const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Features - CTXAPI-546 ICS and QRCode', function() {

  it('check ics generation', async() => {

    const result = await promised(null, sandboxed(function() {
            const ics = require('ics')
            return ics.createEvent({
              start: [2020, 10, 10, 15, 0],
              startInputType: 'utc',
              duration: { hours: 1, minutes: 30 },
              title: 'Event Title',
              description: 'This is the event description'

            })
          })),
          lines = result.split('\r\n')
    should.equal(lines[8], 'SUMMARY:Event Title')
    should.equal(lines[10], 'DTSTART:20201010T150000Z')
    should.equal(lines[11], 'DESCRIPTION:This is the event description')
    should.equal(lines[12], 'DURATION:PT1H30M')

  })

  it('check qrcode generation', async() => {
    const result = await promised(null, sandboxed(function() {
      const qrcode = require('qrcode')
      return qrcode.toDataUrl('https://www.medable.com')
    }))

    should.equal(result, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAACECAYAAABRRIOnAAAAAklEQVR4AewaftIAAAOKSURBVO3BQW7lVgADwebDv/+VO15kwZUAQbLjybAqfmHmX4eZcpgph5lymCmHmXKYKYeZcpgph5lymCmHmXKYKYeZcpgph5ny4aEk/CSVloSm0pLQVFoSmkpLQlO5Iwk/SeWJw0w5zJTDTPnwMpU3JeGOJDSVKyotCU3lTSpvSsKbDjPlMFMOM+XDN0vCHSpPqNyRhCeS0FTuSMIdKt/pMFMOM+UwUz784VSuJKGpNJWWhL/ZYaYcZsphpnz4wyXhikpLQlNpKi0JTeX/7DBTDjPlMFM+fDOV76TSkvCTVJ5Q+U0OM+UwUw4z5cPLkvCTktBUWhKaSktCU7kjCU3lShJ+s8NMOcyUw0yJX/gfScIVlZaEKyp/k8NMOcyUw0z58FASmsqVJHwnlZaEO1SuJOEOlStJaCotCXeoPHGYKYeZcpgpH16WhDep/KQk3KHSknAlCVeScIfKmw4z5TBTDjMlfuEHJaGptCTcodKS0FRaEu5QaUloKleScEWlJaGpXElCU3niMFMOM+UwUz48lIQ7VFoSrqi0JFxRaUm4onKHyh0qLQl3JOEnHWbKYaYcZsqHh1SuJOGKypUkNJUrSWgqV5LQVK4k4YpKS0JTuaJyRxLedJgph5lymCnxCw8k4QmVJ5LQVJ5IwptUriShqVxJQlN502GmHGbKYabELzyQhP+SSktCU2lJuKJyJQlNpSXhikpLwptUnjjMlMNMOcyUDy9TaUloKi0JTeVKEloSriThisodKneotCQ0lZaEKyotCW86zJTDTDnMlA//MZUrSWgqLQl3qFxJQlNpSbgjCVeS0FRaEloSmsqbDjPlMFMOM+XDQypXVJ5QuUOlJaEl4QmVloSmckcSfpPDTDnMlMNM+fBQEn6SyptUvlMSmsodKleS0FSeOMyUw0w5zJQPL1N5UxLuSEJTuZKEKyotCXeovCkJTeVNh5lymCmHmfLhmyXhDpU3JaGpXFFpSbgjCT8pCU3licNMOcyUw0z58JdTaUl4QqUloan8ZoeZcpgph5ny4Q+n0pLQVK4koanckYSWhKZyJQm/yWGmHGbKYaZ8+GYqv5nKlSQ0laZyRxKuqLQk/KTDTDnMlMNM+fCyJPykJDyRhCeScEWlqVxJQlO5koQ3HWbKYaYcZkr8wsy/DjPlMFMOM+UwUw4z5TBTDjPlMFMOM+UwUw4z5TBTDjPlMFMOM+UfNP2KG2HWAm8AAAAASUVORK5CYII=')

  })
})
