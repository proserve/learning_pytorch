'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      consts = require('../../../consts'),
      later = require('later'),
      moment = require('moment'),
      modules = require('../../../modules')

function StatsPeriodLogins() {
  Worker.call(this)
}

util.inherits(StatsPeriodLogins, Worker)

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
StatsPeriodLogins.prototype._process = function(message, payload, options, callback) {

  const arr = later.schedule(later.parse.cron(message.parent.schedule)).prev(2),
        Statistic = modules.db.models.Stat,
        starting = arr[1],
        ending = arr[0],
        stats = {} // grouped by org

  ending.setMilliseconds(-1)

  async.map([{ name: 'active', starting: moment(starting).utc().subtract(30, 'days').startOf('day').toDate() }, { name: 'today', starting: starting }], function(entry, callback) {

    const pipeline = [{
      $match: {
        reap: false,
        object: 'account',
        'stats.lastLogin.time': {
          $gte: entry.starting
        }
      }
    }, {
      $group: {
        _id: '$org',
        count: { $sum: 1 }
      }
    }]

    modules.db.models.Account.collection.aggregate(pipeline, { cursor: {} }).toArray(function(err, results) {

      if (!err) {
        results.forEach(function(result, i, a) {

          let stat = stats[result._id]
          if (!stat) {
            stat = stats[result._id] = new Statistic()
            stat.org = result._id // grouped by org
            stat.starting = starting
            stat.ending = ending
            stat.code = consts.stats.sources.logins
            stat.today = 0
            stat.active = 0

          }
          stat[entry.name] = result.count
        })
      }

      callback(err)

    })

  }, function(err) {

    if (err) {
      return callback(err)
    }

    let stat,
        bulk = Statistic.collection.initializeUnorderedBulkOp(), has = false

    for (let i in stats) {
      if (stats.hasOwnProperty(i)) {
        stat = stats[i].toObject({ depopulate: 1 })
        delete stat._id
        has = true

        bulk.find({ org: stat.org, starting: stat.starting, ending: stat.ending, code: stat.code }).upsert().replaceOne(stat)
      }
    }

    if (has) {
      bulk.execute(callback)
    } else {
      callback()
    }

  })

}

module.exports = StatsPeriodLogins
