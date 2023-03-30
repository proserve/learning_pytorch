'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.default =






enumerable;var _decoratorUtils = require('decorator-utils');function handleDescriptor(target, key, descriptor) {descriptor.enumerable = true;return descriptor;}function enumerable() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return (0, _decoratorUtils.decorate)(handleDescriptor, args);
}