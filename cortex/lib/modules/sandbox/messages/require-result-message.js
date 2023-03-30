'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

function addStatusCode(err) {
  err.statusCode = err.status
  return err
}

class RequireResultMessage extends Message {

  constructor(runId, options) {

    super(runId, Codes.kRequireResult)

    this.taskId = options.taskId
    this.err = options.err ? Fault.from(options.err, false, true) : null
    this.source = options.source
    this.format = options.format
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      taskId: this.taskId,
      err: this.err ? this.err.toJSON() : null,
      source: this.source,
      format: this.format
    }
    return json
  }

  toFrames() {

    return [
      this.type,
      this.runId,
      this.taskId,
      this.err ? utils.serializeObject(addStatusCode(this.err.toJSON())) : 'null',
      this.source,
      this.format
    ]
  }

  static fromFrames(frames) {
    return new RequireResultMessage(
      frames[1],
      {
        taskId: frames[2],
        err: frames[3] ? utils.deserializeObject(frames[3]) : null,
        source: frames[4],
        format: frames[5]
      }
    )
  }

}

module.exports = RequireResultMessage
