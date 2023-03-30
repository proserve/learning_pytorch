
const { ApiCursor } = require('util.cursor'),
      { tail } = module.exports,
      sys = {}

module.exports = Object.assign(
  sys,
  module.exports,
  {
    tail(...args) {
      return new ApiCursor(tail(...args))
    }
  }
)
