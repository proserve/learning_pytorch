const levels = {
        error: 0, warn: 1, info: 2, debug: 3, trace: 4
      },
      keys = Object.keys(levels),
      logger = module.exports

let level = 'trace'

module.exports = {}
Object.defineProperties(module.exports, {

  level: {
    get: () => level,
    set: (l) => {
      if (keys.includes(l)) {
        level = l
      }
    }
  }

})

for (const l of keys) {
  module.exports[l] = (...args) => {
    if (levels[l] <= levels[level]) {
      return logger[l](...args)
    }
  }
}
