'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

function addStatusCode(err) {
  err.statusCode = err.status
  return err
}

class TaskResultMessage extends Message {

  constructor(runId, options) {

    super(runId, Codes.kTaskResult)

    this.taskId = options.taskId
    this.kind = options.kind
    this.command = options.command
    this.err = options.err ? Fault.from(options.err, false, true) : null
    this.result = options.result
    this.raw = options.raw
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      taskId: this.taskId,
      kind: this.kind,
      command: this.command,
      err: this.err ? this.err.toJSON() : null,
      result: this.err ? null : this.result
    }
    return json
  }

  toFrames() {

    return [
      this.type,
      this.runId,
      this.taskId,
      this.kind,
      this.command,
      this.err ? utils.serializeObject(addStatusCode(this.err.toJSON())) : 'null',
      this.err ? 'null' : this.raw ? this.result : utils.serializeObject(this.result)
    ]
  }

  static fromFrames(frames) {
    return new TaskResultMessage(
      frames[1],
      {
        taskId: frames[2],
        kind: frames[3],
        command: frames[4],
        err: frames[5] ? utils.deserializeObject(frames[5]) : null,
        result: frames[6] ? utils.deserializeObject(frames[6]) : null
      }
    )
  }

}

module.exports = TaskResultMessage
