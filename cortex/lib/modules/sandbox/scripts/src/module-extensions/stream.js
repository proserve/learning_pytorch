
const pStream = Symbol('stream'),
      clone = require('clone')

/**
 * Remote opaque API stream
 */
class OpaqueStream {

  constructor(remote = null) {
    this[pStream] = remote || { object: 'stream', _id: null }
  }

  getOptions() {
    const options = clone(this[pStream])
    if (!options.object) {
      options.object = 'stream'
    }
    return options

  }

}

module.exports = {

  OpaqueStream

}
