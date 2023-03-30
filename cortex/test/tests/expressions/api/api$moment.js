const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      moment = require('moment'),
      should = require('should')

describe('Expressions - api$moment', function() {

  it('api$moment - add with object', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'add': { $object: { 'days': 1 } } }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).add({ days: 1 }).toDate())

  })

  it('api$moment - add with positional params', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'add': [1, 'days'] }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).add(1, 'days').toDate())

  })

  it('api$moment - diff', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().startOf('day').add(5, 'days').format(),
          date2 = moment().startOf('day').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'diff': [date2, 'days'] }]
            }
          )

    should(await ec.evaluate()).equal(5)

  })

  it('api$moment - endOf', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'endOf': 'day' }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).endOf('day').toDate())

  })

  it('api$moment - startOf', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'startOf': 'day' }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).startOf('day').toDate())

  })

  it('api$moment - format', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'format': 'YYYY-MM-DD' }]
            }
          )

    should(await ec.evaluate()).equal(moment(date).format('YYYY-MM-DD'))

  })

  it('api$moment - from', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'from': '$$DATE' }]
            }
          )

    should(await ec.evaluate()).equal('a few seconds ago')

  })

  it('api$moment - fromNow', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'fromNow']
            }
          )

    should(await ec.evaluate()).equal('a few seconds ago')

  })

  it('api$moment - to', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().add(5, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: ['$$DATE', { 'to': date }]
            }
          )

    should(await ec.evaluate()).equal('in 5 days')

  })

  it('api$moment - toNow', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment.utc().subtract(1, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toNow']
            }
          ),
          result = await ec.evaluate()

    should(result).equal('in a day')

  })

  it('api$moment - isAfter', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().startOf('day').add(5, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isAfter': '$$DATE' }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - isBefore', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().startOf('day').subtract(2, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isBefore': '$$DATE' }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - isBetween', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().startOf('day').add(1, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isBetween': ['$$DATE', moment().add(5, 'days').toDate()] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - isSame', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isSame': ['$$DATE', 'day'] }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - isSameOrAfter', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().add(5, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isSameOrAfter': '$$DATE' }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - isSameOrBefore', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = moment().subtract(1, 'days').toDate(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'isSameOrBefore': '$$DATE' }]
            }
          )

    should(await ec.evaluate()).equal(true)

  })

  it('api$moment - set', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'set': ['year', 2021] }]
            }
          )

    should(await ec.evaluate()).deepEqual(new Date(Date.UTC(2021, 1, 1, 0, 0, 0)))

  })

  it('api$moment - get', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2022, 1, 1, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'get': 'year' }]
            }
          )

    should(await ec.evaluate()).equal(2022)

  })

  it('api$moment - subtract with object', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'subtract': { $object: { 'days': 1 } } }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).subtract({ days: 1 }).toDate())

  })

  it('api$moment - subtract with positional params', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, { 'subtract': [1, 'days'] }]
            }
          )

    should(await ec.evaluate()).deepEqual(moment(date).subtract(1, 'days').toDate())

  })

  it('api$moment - toArray', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toArray']
            }
          )

    should(await ec.evaluate()).deepEqual(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toArray())

  })

  it('api$moment - toObject', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toObject']
            }
          )

    should(await ec.evaluate()).deepEqual(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toObject())

  })

  it('api$moment - toDate', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toDate']
            }
          )

    should(await ec.evaluate()).deepEqual(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toDate())

  })

  it('api$moment - toISOString', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toISOString']
            }
          )

    should(await ec.evaluate()).deepEqual(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toISOString())

  })

  it('api$moment - inspect', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'inspect']
            }
          )

    should(await ec.evaluate()).equal(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).inspect())

  })

  it('api$moment - toJSON', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toJSON']
            }
          )

    should(await ec.evaluate()).equal(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toJSON())

  })

  it('api$moment - toString', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'toString']
            }
          )

    should(await ec.evaluate()).equal(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).toString())

  })

  it('api$moment - unix', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'unix']
            }
          )

    should(await ec.evaluate()).equal(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).unix())

  })

  it('api$moment - valueOf', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0)),
          ec = expressions.createContext(
            ac,
            {
              $moment: [date, 'valueOf']
            }
          )

    should(await ec.evaluate()).equal(moment(new Date(Date.UTC(2020, 1, 1, 0, 0, 0, 0))).valueOf())

  })

  it('api$moment - multiple get/set', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          date = '2021-10-15T12:00:00Z',
          results = await Promise.all([
            expressions.createContext(ac, { $moment: [date, 'year'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'year': 2021 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isLeapYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'weekYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'weekYear': 2020 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isoWeekYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'isoWeekYear': 2020 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'quarters'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'quarters': 4 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'quarter'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'quarter': 4 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'month'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'month': 4 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'daysInMonth'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'weeks'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'weeks': 41 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'week'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'week': 41 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isoWeeks'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'isoWeeks': 41 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isoWeek'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'isoWeek': 41 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'weeksInYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isoWeeksInYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'date'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'date': 22 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'day'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'day': 22 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'days'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'days': 22 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'weekday'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'weekday': 5 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'dayOfYear'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'dayOfYear': 5 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'hours'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'hours': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'hour'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'hour': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'minutes'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'minutes': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'minute'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'minute': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'seconds'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'seconds': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'second'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'second': 7 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'milliseconds'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'milliseconds': 100 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'millisecond'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, { 'millisecond': 100 }] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'local'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isDST'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isLocal'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isUtcOffset'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'isUTC'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'zoneAbbr'] }).evaluate(),
            expressions.createContext(ac, { $moment: [date, 'zoneName'] }).evaluate()
          ])

    should(results).deepEqual([
      moment(date).year(),
      moment(date).year(2021).toDate(),
      false,
      moment(date).weekYear(),
      moment(date).weekYear(2020).toDate(),
      moment(date).isoWeekYear(),
      moment(date).isoWeekYear(2020).toDate(),
      moment(date).quarters(),
      moment(date).quarters(4).toDate(),
      moment(date).quarter(),
      moment(date).quarter(4).toDate(),
      moment(date).month(),
      moment(date).month(4).toDate(),
      31,
      moment(date).weeks(),
      moment(date).weeks(41).toDate(),
      moment(date).week(),
      moment(date).week(41).toDate(),
      moment(date).isoWeek(),
      moment(date).isoWeek(41).toDate(),
      moment(date).isoWeeks(),
      moment(date).isoWeeks(41).toDate(),
      52,
      52,
      moment(date).date(),
      moment(date).date(22).toDate(),
      moment(date).day(),
      moment(date).day(22).toDate(),
      moment(date).days(),
      moment(date).days(22).toDate(),
      moment(date).weekday(),
      moment(date).weekday(5).toDate(),
      moment(date).dayOfYear(),
      moment(date).dayOfYear(5).toDate(),
      moment(date).hours(),
      moment(date).hours(7).toDate(),
      moment(date).hour(),
      moment(date).hour(7).toDate(),
      moment(date).minutes(),
      moment(date).minutes(7).toDate(),
      moment(date).minute(),
      moment(date).minute(7).toDate(),
      moment(date).seconds(),
      moment(date).seconds(7).toDate(),
      moment(date).second(),
      moment(date).second(7).toDate(),
      moment(date).milliseconds(),
      moment(date).milliseconds(100).toDate(),
      moment(date).millisecond(),
      moment(date).millisecond(100).toDate(),
      moment(date).local().toDate(),
      false,
      true,
      false,
      false,
      '',
      ''
    ])

  })

  it('api$moment - init with timezone', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $moment: [{ init: ['2021-10-12T12:00:00.000Z', 'tz', 'America/Argentina/Cordoba'] }, { format: '' }]
            }
          )

    should(await ec.evaluate()).equal('2021-10-12T09:00:00-03:00')

  })

  it('api$moment - init as utc', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $object: {
                utc: { $moment: [{ init: ['2021-10-12 09:00:00', 'utc'] }, { format: '' }] },
                converted: { $moment: ['2021-10-12T09:00:00-03:00', 'utc', { format: '' }] }
              }
            }
          )

    should(await ec.evaluate()).deepEqual({
      converted: '2021-10-12T12:00:00Z',
      utc: '2021-10-12T09:00:00Z'
    })

  })
})
