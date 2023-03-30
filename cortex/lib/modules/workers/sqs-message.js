'use strict'

const modules = require('../../modules'),
      WorkerMessage = require('./worker-message'),
      util = require('util'),
      utils = require('../../utils'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config')

/**
 * @param queue
 * @param queueOptions
 * @param event
 * @constructor
 */
function SqsMessage(queue, queueOptions, event) {

  this.event = event

  // map aws generated events to a worker.
  let worker
  for (let name in modules.workers.workerProtos) {
    if (modules.workers.workerProtos.hasOwnProperty(name)) {
      const mapper = modules.workers.workerProtos[name].sqsMapper
      if (mapper) {
        worker = mapper(event)
        if (worker) {
          break
        }
      }
    }
  }
  if (!worker) {
    worker = '__unknown__'
  }

  const doc = {
    payload: event.data
  }

  WorkerMessage.call(this, queue, worker, doc)

}

util.inherits(SqsMessage, WorkerMessage)

SqsMessage.prototype.changeMessageVisibility = function(secs, callback) {
  logger.debug('[worker] SqsMessage.changeMessageVisibility', { worker: this.worker, org: this.org, _id: this._id })
  this.event.changeMessageVisibility(secs, callback)
}

Object.defineProperties(SqsMessage.prototype, {
  org: {
    get: function() {
      if (this.__org === undefined) {
        if (this._doc.org) {
          this.__org = this._doc.org
        } else {
          this.__org = utils.getIdOrNull((utils.path(this._doc.payload, config('isChina') ? 'events.0.oss.object.key' : 'Records.0.s3.object.key') || '').split('/', 1)[0])
        }
      }
      return this.__org
    },
    set: function(org) {
      this.__org = org
    }
  }
})

module.exports = SqsMessage
