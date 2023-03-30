
const RuntimeOperation = require('./runtime-operation')

module.exports = class extends RuntimeOperation {

  constructor(req, options) {

    options = options || {}

    super(
      req.ac,
      'import',
      options
    )

  }

}
