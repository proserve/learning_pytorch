'use strict'

const utils = require('../../utils'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      EventEmitter = require('events').EventEmitter,
      _ = require('underscore')

function WorkerMessage(queue, worker, doc) {

  EventEmitter.call(this)

  this._expires = (doc.timeout === null || doc.timeout === undefined) ? null : (new Date().getTime()) + doc.timeout
  this._doc = doc
  this._handled = false
  this._cancelled = false
  this.queue = queue
  this.worker = worker
  this._req = {
    _id: (this._doc && this._doc.reqId) || utils.createId()
  }

  if (config('__is_mocha_test__')) {
    this.testId = require('../../../test/lib/server').__mocha_test_uuid__
    require('../../../test/lib/server').events.emit('worker.start', this)
  }

}

util.inherits(WorkerMessage, EventEmitter)

// noinspection JSValidateJSDoc,JSCommentMatchesSignature
/**
 * call this when done processing the message. if a reply was requested, the result (or fault) will be placed on the queue.
 * if there was a fault, the local queue will fire an error event so the local node can trap errors.
 *
 * note: this can only be called once; once called
 *
 * @param err
 * @param result
 * @param callback a callback that is fired when the message reply or state has been set ( callback(err) )
 */
WorkerMessage.prototype.done = function(err, result, callback) {

  if (!this.handled) {
    this.setHandled()
    if (this.queue) {

      if (config('__is_mocha_test__')) {
        require('../../../test/lib/server').events.emit('worker.done', this, err, result)
      }

      var queue = this.queue; this.queue = null
      queue.processed(this, err, result, callback)

    } else if (_.isFunction(callback)) {

      setImmediate(callback)
    }
  }

}

WorkerMessage.prototype.cancel = function() {
  this._cancelled = true
  this.emit('cancel')
}

/**
 * @api protected
 */
WorkerMessage.prototype.setHandled = function() {
  this._handled = true
}

Object.defineProperties(WorkerMessage.prototype, {
  cancelled: {
    get: function() {
      return this._cancelled
    }
  },
  handled: {
    get: function() {
      return this._handled
    }
  },
  _id: {
    get: function() {
      return this._doc._id
    }
  },
  req: {
    get: function() {
      return this._req
    }
  },
  org: {
    get: function() {
      return this.__org || this._doc.org
    },
    set: function(org) {
      this.__org = org
    }
  },
  queueName: {
    get: function() {
      return this._doc.queue
    }
  },
  force: {
    get: function() {
      return this._doc.force
    }
  },
  reqId: {
    get: function() {
      return this._req._id
    }
  },
  payload: {
    get: function() {
      return this._doc.payload
    },
    set: function(payload) {
      this._doc.payload = payload
    }
  },
  options: {
    get: function() {
      return this._doc.opts
    }
  },
  started: {
    get: function() {
      return this._doc.started
    }
  },
  priority: {
    get: function() {
      return this._doc.priority
    }
  },
  trigger: {
    get: function() {
      return this._doc.trigger
    }
  },
  state: {
    get: function() {
      return this._doc.state
    }
  },
  triesLeft: {
    get: function() {
      return this._doc.triesLeft
    }
  },
  target: {
    get: function() {
      return this._doc.target
    }
  },
  expires: {
    get: function() {
      return this._expires == null ? null : Math.max(0, this._expires - (new Date().getTime()))
    }
  },
  scheduled: {
    get: function() {
      return !!this._doc.schedule
    }
  },
  name: {
    get: function() {
      return this._doc.name || (this._doc.parent || {}).name
    }
  },
  sequence: {
    get: function() {
      return this._doc.sequence
    }
  },
  schedule: {
    get: function() {
      return this._doc.schedule
    }
  },
  parent: {
    get: function() {
      return this._doc.parent
    }
  },
  __mocha_test_uuid__: {
    get: function() {
      return (this._doc.parent || {}).__mocha_test_uuid__
    }
  },
  mochaCurrentTestUuid: {
    get: function() {
      return (this._doc.parent || {}).mochaCurrentTestUuid
    }
  }
})

module.exports = WorkerMessage
