'use strict'

const utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

class TaskMessage extends Message {

  constructor(runId, options) {

    super(runId, Codes.kTask)

    this.taskId = options.taskId ? utils.rString(String(options.taskId), utils.createId().toString()) : utils.createId().toString()
    this.kind = options.kind
    this.command = options.command
    this.payload = options.payload
    this.trace = options.trace
    this.stats = options.stats
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      taskId: this.taskId,
      kind: this.kind,
      command: this.command,
      payload: this.payload,
      trace: this.trace,
      stats: this.stats
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
      utils.serializeObject(utils.array(this.payload, !!this.payload)),
      utils.serializeObject(this.trace || null),
      this.stats || null
    ]
  }

  static fromFrames(frames) {
    return new TaskMessage(
      frames[1],
      {
        taskId: frames[2],
        kind: frames[3],
        command: frames[4],
        payload: utils.deserializeObject(frames[5]),
        trace: utils.deserializeObject(frames[6]),
        stats: utils.deserializeObject(frames[7])
      }
    )
  }

}

module.exports = TaskMessage
