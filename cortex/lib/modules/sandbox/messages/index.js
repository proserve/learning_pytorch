'use strict'

const utils = require('../../../utils'),
      msgConsts = require('./message-consts')

class Messages {

  constructor() {

    this.Heartbeat = require('./heartbeat-message')
    this.Init = require('./init-message')
    this.Result = require('./result-message')
    this.Script = require('./script-message')
    this.Compile = require('./compile-message')
    this.Task = require('./task-message')
    this.TaskResult = require('./task-result-message')
    this.RequireResult = require('./require-result-message')
    this.Ready = require('./ready-message')

    const Codes = this.Codes = msgConsts.Codes

    this.Classes = {
      [Codes.kInit]: this.Init,
      [Codes.kReady]: this.Ready,
      [Codes.kHeartbeat]: this.Heartbeat,
      [Codes.kScript]: this.Script,
      [Codes.kCompile]: this.Compile,
      [Codes.kResult]: this.Result,
      [Codes.kTask]: this.Task,
      [Codes.kTaskResult]: this.TaskResult,
      [Codes.kRequireResult]: this.RequireResult
    }

  }

  parse(data) {
    const runId = (data && data.runId) ? data.runId : null,
          type = data ? data.type : null,
          payload = data ? data.payload : null,
          Cls = this.Classes[type]
    try {
      return new Cls(runId, payload)
    } catch (e) {}
    return null

  }

  parseFrames(frames) {
    frames = utils.array(frames)
    const Cls = this.Classes[frames[0]]
    return Cls.fromFrames(frames)

  }

}

module.exports = new Messages()
