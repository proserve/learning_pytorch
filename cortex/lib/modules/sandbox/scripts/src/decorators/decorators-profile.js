const profiler = require('util.profiler'),
      { decorate } = require('decorator-utils')

function handleDescriptor(target, key, descriptor, [prefix = null]) {
  if (!profiler.enabled) {
    return descriptor
  }

  const fn = descriptor.value

  if (prefix === null) {
    prefix = `${target.constructor.name}.${key}`
  }

  if (typeof fn !== 'function') {
    throw new SyntaxError(`@profile can only be used on functions, not: ${fn}`)
  }

  return {
    ...descriptor,
    value(...args) {
      return profiler.profile(prefix, () => fn.call(this, ...args))
    }
  }
}

module.exports = function profile(...args) {
  return decorate(handleDescriptor, args)
}
