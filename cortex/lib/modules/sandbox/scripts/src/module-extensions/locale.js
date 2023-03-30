const { validLocales } = module.exports

module.exports = Object.assign(
  {},
  module.exports,
  {
    validLocales() {
      try {
        require('logger').warn('locale.validLocales() is deprecated.')
      } catch (err) {
      }
      return validLocales()
    }
  }
)
