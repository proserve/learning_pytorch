/* global script */

import { Emitter } from 'events'

const pExited = Symbol('exited')

class Process extends Emitter {

  constructor() {
    super()
    this[pExited] = false
  }

  exit(result = undefined) {
    if (!this[pExited]) {
      this[pExited] = true
      this.emit('exit')
      script.exit(result)
    }
  }

  get exited() {
    return this[pExited]
  }

}

module.exports = new Process()
