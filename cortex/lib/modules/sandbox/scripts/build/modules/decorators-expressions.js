'use strict';var _require = require('decorator-utils'),decorate = _require.decorate;

function handleDescriptor(target, key, descriptor) {
  return descriptor;
}

module.exports = {

  expression: function expression() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
    return decorate(handleDescriptor, args);
  },

  pipeline: function pipeline() {for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {args[_key2] = arguments[_key2];}
    return decorate(handleDescriptor, args);
  },

  action: function operator() {for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {args[_key3] = arguments[_key3];}
    return decorate(handleDescriptor, args);
  } };