'use strict'

const utils = require('../../../utils')

class Message {

  constructor(runId, type) {
    this.runId = runId ? utils.rString(String(runId), utils.createId().id) : utils.createId().id
    this.type = type
  }

  send(connection) {
    if (connection) {
      connection.send(this)
    }
  }

  toJSON() {
    return {
      runId: this.runId,
      type: this.type
    }
  }

  toFrames() {
    return [
      this.type,
      this.runId
    ]
  }

}

module.exports = Message
