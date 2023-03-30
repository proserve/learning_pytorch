let Undefined

module.exports = function(api, { getUndefinedKey = true, extra = {} } = {}) {

  const { get = () => {}, set = () => {} } = api || {},

        accessor = function(key = Undefined, val = Undefined) {

          if (key === Undefined) {
            return getUndefinedKey ? get() : Undefined
          }
          if (val === Undefined) {
            return get(key)
          }
          if (set) {
            return set(key, val)
          }
        }

  for (const key of Object.keys(extra)) {
    accessor[key] = extra[key]
  }

  return accessor
}
