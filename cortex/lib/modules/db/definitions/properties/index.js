const props = {
  acl: require('./acl'),
  uniqueKey: require('./uniqueKey'),
  readAccess: require('./readAccess'),
  writeAccess: require('./writeAccess'),
  accessTransforms: require('./accessTransforms')
}

Object.defineProperties(
  module.exports,
  Object.entries(props).reduce((props, [key, val]) => {
    props[key] = {
      get: val.definition
    }
    return props
  }, {})
)
