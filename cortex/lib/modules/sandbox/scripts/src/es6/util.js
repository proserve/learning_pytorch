
module.exports = Object.freeze(['cursor', 'json', 'id', 'ip', 'hex', 'paths.to', 'deep-extend', 'deep-equals', 'object', 'values', 'profiler', 'paths.accessor'].reduce((object, path) => {
  const parts = path.split('.')
  for (let i = 0, curr = object; i < parts.length; i++) {
    const part = parts[i]
    if (i === parts.length - 1) {
      Object.defineProperty(curr, part, {
        get() {
          return require(`util.${path}`)
        }
      })
    } else {
      if (!curr[part]) {
        Object.defineProperty(curr, part, {
          value: {}
        })
      }
      curr = curr[part]
    }
  }
  return object
}, {}))
