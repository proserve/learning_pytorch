const { decorate } = require('decorator-utils')

function handleDescriptor(target, key, descriptor) {
  return descriptor
}

module.exports = {

  expression: function expression(...args) {
    return decorate(handleDescriptor, args)
  },

  pipeline: function pipeline(...args) {
    return decorate(handleDescriptor, args)
  },

  action: function operator(...args) {
    return decorate(handleDescriptor, args)
  }

}
