const { decorate } = require('decorator-utils')

function handleDescriptor(target, key, descriptor) {
  return descriptor
}

module.exports = function env(...args) {
  return decorate(handleDescriptor, args)
}
