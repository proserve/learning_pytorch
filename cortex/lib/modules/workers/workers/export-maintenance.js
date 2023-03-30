'use strict'

const Worker = require('../worker'),
      { db: { sequencedUpdate, models: { Export, Message } }, workers } = require('../../../modules'),
      { toJSON, timestampToId, escapeRegex, promised } = require('../../../utils'),
      { messages: { states: { pending, processing } } } = require('../../../consts'),
      logger = require('cortex-service/lib/logger')

if (!RegExp.escape) {
  RegExp.escape = function(s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  }
}

module.exports = class ExportMaintenanceWorker extends Worker {

  // look for exports created in the last 24 hours, that started more than 10 minutes ago, are running, and have no matching worker message.

  _process(message, payload, options, callback) {

    Promise.resolve(null)
      .then(async() => {

        const now = Date.now(),
              twentyFourHoursAgo = new Date(now - 86400000),
              tenMinutesAgo = new Date(now - 600000),
              cursor = Export.collection
                .find({
                  reap: false,
                  object: 'export',
                  _id: { $gte: timestampToId(twentyFourHoursAgo) },
                  started: { $lte: tenMinutesAgo },
                  state: 'running'
                })
                .project({
                  _id: 1,
                  org: 1,
                  started: 1,
                  sequence: 1
                })

        while (await cursor.hasNext()) {

          const doc = await cursor.next(),
                count = await Message.collection
                  .find({
                    worker: 'exporter',
                    state: { $in: [pending, processing] },
                    org: doc.org,
                    payload: new RegExp(escapeRegex(`"export":"^i${doc._id}"`)) // @hack tricky, looking up serialized export in payload.
                  })
                  .project('_id')
                  .hint('idxWork')
                  .count()

          // if found assume it's being handled.
          if (count > 0) {
            return
          }

          try {

            // restart export if it's in the same state.
            const result = await promised(
              null,
              sequencedUpdate,
              Export,
              {
                _id: doc._id,
                state: 'running',
                started: doc.started
              },
              {
                $set: {
                  state: 'pending'
                },
                $unset: {
                  started: 1
                }
              },
              options
            )

            // requeue export.
            if (result) {

              workers.send('work', 'exporter', {
                org: doc.org,
                export: doc._id
              },
              {
                reqId: message.reqId,
                orgId: doc.org
              })

              Export.logEvent(
                doc._id,
                'queued',
                {
                  state: 'running',
                  started: doc.started,
                  stalled: true,
                  message: message._id
                }
              )

            }

          } catch (err) {

            logger.error('export-maintenance', toJSON(err, { stack: true }))

          }

        }

      })
      .then(() => callback())
      .catch(err => {
        logger.error('export-maintenance', toJSON(err, { stack: true }))
        callback(err)
      })

  }

}
