'use strict'

const Message = require('./message'),
      Codes = require('./message-consts').Codes

class HeartbeatMessage extends Message {

  constructor(runId) {
    super(runId, Codes.kHeartbeat)
  }

  toFrames() {
    return [
      this.type,
      this.runId
    ]
  }

  static fromFrames(frames) {
    return new HeartbeatMessage(
      frames[1]
    )
  }

}

module.exports = HeartbeatMessage
