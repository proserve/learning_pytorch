'use strict';var _require = require('decorator-utils'),decorate = _require.decorate;

function handleDescriptor(target, key, descriptor) {
  return descriptor;
}

module.exports = function env() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
  return decorate(handleDescriptor, args);
};