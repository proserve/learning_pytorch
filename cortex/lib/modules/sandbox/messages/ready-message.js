'use strict'

const utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

class ReadyMessage extends Message {

  constructor(runId, options) {

    super(null, Codes.kReady)
    this.version = utils.rString(options.version, '1.0.0')
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      version: this.version
    }
    return json
  }

  toFrames() {
    return [
      this.type,
      this.version
    ]
  }

  static fromFrames(frames) {
    return new ReadyMessage(
      null,
      {
        version: utils.rString(frames[1], '1.0.0')
      }
    )
  }

}

module.exports = ReadyMessage
