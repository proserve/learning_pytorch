/* global script, Fault */

const { decorate } = require('decorator-utils'),
      ids = Symbol('util.id')

function handleDescriptor(target, key, descriptor, [...options]) {

  const fn = descriptor.value,
        pairs = []

  if (typeof fn !== 'function') {
    throw new SyntaxError('@acl can only be used on class functions')
  }

  for (let i = 0; i < options.length; i += 2) {
    pairs.push([options[i], options[i + 1]])
  }

  return {
    ...descriptor,
    value(...args) {
      if (!pairs.some(([type, option]) => {
        switch (type) {
          case 'role':
            if ((Array.isArray(option) ? option : [option]).some(
              (role) => script.principal.hasRole(role)
            )
            ) {
              return true
            }
            break
          case 'account':
            if ((Array.isArray(option) ? option : [option]).some(
              (account) => script.principal.email.toLowerCase() === String(account).toLowerCase() || ids.equalIds(script.principal._id, account)
            )
            ) {
              return true
            }
            break
          case 'assert':
            if (typeof option !== 'function') {
              throw new SyntaxError('@acl assert requires a function')
            }
            if (option.call(this, script.principal, ...args)) {
              return true
            }
            break
          default:
            throw Fault.create('script.invalidArgument.acl', { reason: `Unsupported or missing decorator acl type argument (${type})` })
        }

      })) {
        throw Fault.create('script.accessDenied.acl')
      }
      return fn.call(this, ...args)
    }
  }

}

module.exports = function as(...args) {
  return decorate(handleDescriptor, args)
}
