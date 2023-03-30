
const { Runtime } = require('runtime.transform')

// new-style runtime decorator for runtime
module.exports = Runtime.createDecorator()

Object.assign(module.exports, {

  // legacy form
  transform: Runtime.createDecorator()

})
