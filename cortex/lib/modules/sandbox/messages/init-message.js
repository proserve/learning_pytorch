'use strict'

const utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

class InitMessage extends Message {

  constructor(config) {
    super(null, Codes.kInit)
    this.config = config
  }

  toJSON() {
    const json = super.toJSON()
    json.config = this.config
    return json
  }

  toFrames() {
    return [
      this.type,
      utils.serializeObject(this.config)
    ]
  }

  static fromFrames(frames) {
    return new InitMessage(
      utils.deserializeObject(frames[1])
    )
  }

}

module.exports = InitMessage
