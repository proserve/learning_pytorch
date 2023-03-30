'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.default =


















extendDescriptor;var _decoratorUtils = require('decorator-utils');var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var getPrototypeOf = Object.getPrototypeOf,getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;function handleDescriptor(target, key, descriptor) {var superKlass = getPrototypeOf(target);var superDesc = getOwnPropertyDescriptor(superKlass, key);return _extends({}, superDesc, { value: descriptor.value, initializer: descriptor.initializer, get: descriptor.get || superDesc.get, set: descriptor.set || superDesc.set });}function extendDescriptor() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return (0, _decoratorUtils.decorate)(handleDescriptor, args);
}