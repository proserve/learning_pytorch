
const { statics, classes } = module.exports,
      symLocales = Symbol('locales'),
      symOptions = Symbol('options')

module.exports = {

}

for (const [key, value] of Object.entries(statics)) {
  module.exports[key] = value
}

for (const [key, cls] of Object.entries(classes)) {

  // eslint-disable-next-line no-new-func
  const Cls = Function('constructor', `
        return function ${key}(locales, options) {                   
            constructor.call(this, locales, options)            
        }`)(function constructor(locales = null, options = {}) {
    if (locales === null) {
      locales = [script.locale]
    }
    this[symLocales] = locales
    this[symOptions] = options
  })

  for (const [name, value] of Object.entries(cls.statics)) {
    Cls[name] = function(...params) {
      return value(params)
    }
  }

  for (const [name, value] of Object.entries(cls.methods)) {
    Cls.prototype[name] = function(...params) {
      return value([this[symLocales], this[symOptions]].concat(params))
    }
  }

  module.exports[key] = Cls
}
