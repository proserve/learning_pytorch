/* global script */

const { decorate } = require('decorator-utils')

function handleDescriptor(target, key, descriptor, [account, options]) {

  const fn = descriptor.value

  if (typeof fn !== 'function') {

    throw new SyntaxError('@as can only be used on class functions')
  }

  function wrapAs() {
    const callAs = () => fn.apply(this, arguments)
    return script.as(account, options, callAs)
  }

  return {
    ...descriptor,
    value: wrapAs
  }

}

module.exports = function as(...args) {
  return decorate(handleDescriptor, args)
}
