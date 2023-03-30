'use strict';var _validLocales = module.exports.validLocales;

module.exports = Object.assign(
{},
module.exports,
{
  validLocales: function validLocales() {
    try {
      require('logger').warn('locale.validLocales() is deprecated.');
    } catch (err) {
    }
    return _validLocales();
  } });