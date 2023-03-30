'use strict'

const Fault = require('cortex-service/lib/fault'),
      utils = require('../../../utils'),
      Message = require('./message'),
      Codes = require('./message-consts').Codes

class ResultMessage extends Message {

  constructor(runId, options) {

    super(runId, Codes.kResult)

    this.err = options.err ? Fault.from(options.err, null, true) : null
    this.result = options.result
    this.stats = options.stats
  }

  toJSON() {
    const json = super.toJSON()
    json.payload = {
      err: this.err ? this.err.toJSON() : null,
      result: this.err ? null : this.result,
      stats: this.stats
    }
    return json
  }

  toFrames() {
    return [
      this.type,
      this.runId,
      utils.serializeObject(this.stats),
      this.err ? utils.serializeObject(this.err.toJSON()) : '',
      this.err ? '' : utils.serializeObject(this.result)
    ]
  }

  static fromFrames(frames) {
    return new ResultMessage(
      frames[1],
      {
        stats: utils.deserializeObject(frames[2]),
        err: frames[3] ? utils.deserializeObject(frames[3]) : null,
        result: frames[4] ? utils.deserializeObject(frames[4]) : null
      }
    )
  }

}

module.exports = ResultMessage
