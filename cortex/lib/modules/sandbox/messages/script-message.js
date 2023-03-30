'use strict'

const utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

class ScriptMessage extends Message {

  constructor(runId, options) {
    super(runId, Codes.kScript)
    this.source = options.source
    this.format = options.format
    this.configuration = options.configuration
    this.environment = options.environment
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      source: this.source,
      format: this.format,
      configuration: this.configuration,
      environment: this.environment
    }
    return json
  }

  toFrames() {
    return [
      this.type,
      this.runId,
      utils.serializeObject(this.configuration),
      utils.serializeObject(this.environment),
      this.source,
      this.format
    ]
  }

  static fromFrames(frames) {
    return new ScriptMessage(
      frames[1],
      {
        configuration: utils.deserializeObject(frames[2]),
        environment: utils.deserializeObject(frames[3]),
        source: frames[4],
        format: frames[5]
      }
    )
  }

}

module.exports = ScriptMessage
