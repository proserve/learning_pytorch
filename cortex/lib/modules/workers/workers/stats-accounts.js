'use strict'

const Worker = require('../worker'),
      util = require('util'),
      consts = require('../../../consts'),
      later = require('later'),
      modules = require('../../../modules')

function StatsAccountsWorker() {
  Worker.call(this)
}

util.inherits(StatsAccountsWorker, Worker)

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
StatsAccountsWorker.prototype._process = function(message, payload, options, callback) {

  const arr = later.schedule(later.parse.cron(message.parent.schedule)).prev(2),
        Statistic = modules.db.models.Stat,
        starting = arr[1],
        ending = arr[0],
        // count the total number of users and the number of users created in the last period.
        pipeline = [{
          $match: {
            reap: false,
            object: 'account'
          }
        }, {
          $group: {
            _id: {
              org: '$org',
              name: { $cond: [{ $gte: ['$created', starting] }, 'today', 'total'] }
            },
            count: { $sum: 1 }
          }
        }]

  ending.setMilliseconds(-1)

  modules.db.models.Account.collection.aggregate(pipeline, { cursor: {} }).toArray(function(err, results) {

    if (err) {
      return callback(err)
    }

    var stats = {}

    results.forEach(function(result, i, a) {
      var stat = stats[result._id.org]
      if (!stat) {
        stat = stats[result._id.org] = new Statistic()
        stat.org = result._id.org
        stat.starting = starting
        stat.ending = ending
        stat.code = consts.stats.sources.accounts
        stat.today = 0
        stat.total = 0

      }
      stat[result._id.name] = result.count
    })

    if (results.length === 0) {
      return callback()
    }

    let stat,
        bulk = Statistic.collection.initializeUnorderedBulkOp()

    for (let i in stats) {
      if (stats.hasOwnProperty(i)) {

        stat = stats[i].toObject({ depopulate: 1 })
        stat.total += stat.today // add today to total

        delete stat._id
        bulk.find({ org: stat.org, starting: stat.starting, ending: stat.ending, code: stat.code }).upsert().replaceOne(stat)
      }
    }

    bulk.execute(callback)

  })

}

module.exports = StatsAccountsWorker
