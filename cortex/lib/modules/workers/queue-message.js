'use strict'

const WorkerMessage = require('./worker-message'),
      util = require('util'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore')

/**
 * @param queue
 * @param doc
 * @constructor
 */

function QueueMessage(queue, doc) {

  WorkerMessage.call(this, queue, doc.worker, doc)

}

util.inherits(QueueMessage, WorkerMessage)

QueueMessage.prototype.changeMessageVisibility = function(secs, callback) {
  logger.debug(`[worker] QueueMessage.changeMessageVisibility: ${this.name || this.worker}`, { name: this.name, worker: this.worker, org: String(this.org), _id: String(this._id) })
  this.queue.changeMessageVisibility(this, secs, (err, doc) => {
    if (_.isFunction(callback)) {
      callback(err, doc)
    }
  })
}

module.exports = QueueMessage
