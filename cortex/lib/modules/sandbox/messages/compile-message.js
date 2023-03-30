'use strict'

const Message = require('./message'),
      Codes = require('./message-consts').Codes

class CompileMessage extends Message {

  constructor(runId, options) {
    super(runId, Codes.kCompile)
    this.scriptType = options.scriptType
    this.filename = options.filename
    this.source = options.source
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      scriptType: this.scriptType,
      filename: this.filename,
      source: this.source
    }
    return json
  }

  toFrames() {
    return [
      this.type,
      this.runId,
      this.scriptType,
      this.filename,
      this.source
    ]
  }

  static fromFrames(frames) {
    return new CompileMessage(
      frames[1],
      {
        scriptType: frames[1],
        filename: frames[2],
        source: frames[3]
      }
    )
  }

}

module.exports = CompileMessage
