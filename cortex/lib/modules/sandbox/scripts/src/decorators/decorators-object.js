
const { decorate } = require('decorator-utils'),
      ObjectRuntime = require('runtime.object').Runtime,
      { isFunction } = require('util.values')

function object(...args) {

  const Class = args[0]

  if (Class && args.length === 1 && isFunction(Class)) {
    ObjectRuntime.initialize(Class, Class.name.toLowerCase(), {})
  } else {
    return decorate(
      (Class, [name, options], descriptor) => {

        if (descriptor) {
          throw new TypeError('@object can only be used on class declarations')
        }

        if (typeof name === 'object') {
          options = name
          name = Class.name.toLowerCase()
        } else if (typeof name !== 'string') {
          name = Class.name.toLowerCase()
        }

        ObjectRuntime.initialize(
          Class,
          name || Class.name.toLowerCase(),
          options
        )

      },

      args
    )
  }
}

module.exports = object
