'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.default =





































lazyInitialize;var _decoratorUtils = require('decorator-utils');var defineProperty = Object.defineProperty;function handleDescriptor(target, key, descriptor) {var configurable = descriptor.configurable,enumerable = descriptor.enumerable,initializer = descriptor.initializer,value = descriptor.value;return { configurable: configurable, enumerable: enumerable, get: function get() {if (this === target) {return;}var ret = initializer ? initializer.call(this) : value;defineProperty(this, key, { configurable: configurable, enumerable: enumerable, writable: true, value: ret });return ret;}, set: (0, _decoratorUtils.createDefaultSetter)(key) };}function lazyInitialize() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return (0, _decoratorUtils.decorate)(handleDescriptor, args);
}