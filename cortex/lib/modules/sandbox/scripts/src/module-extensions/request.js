
const accessor = require('util.paths.accessor'),
      { memo } = module.exports

module.exports = Object.assign(
  module.exports,
  global.env.request,
  {
    getHeader(name) {
      return module.exports.headers[String(name).toLowerCase()]
    },

    /**
     * Get and set arbitrary values for the current request
     *
     * @param path dot path to value. if undefined, returns the entire memo object.
     * @param val if undefined, returns the value of the path argument. if set, sets the value at path.
     */
    memo: accessor(memo)

  }
)
