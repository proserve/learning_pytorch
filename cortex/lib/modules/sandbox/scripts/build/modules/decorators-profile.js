'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}var profiler = require('util.profiler'),_require =
require('decorator-utils'),decorate = _require.decorate;

function handleDescriptor(target, key, descriptor, _ref) {var _ref2 = _slicedToArray(_ref, 1),_ref2$ = _ref2[0],prefix = _ref2$ === undefined ? null : _ref2$;
  if (!profiler.enabled) {
    return descriptor;
  }

  var fn = descriptor.value;

  if (prefix === null) {
    prefix = target.constructor.name + '.' + key;
  }

  if (typeof fn !== 'function') {
    throw new SyntaxError('@profile can only be used on functions, not: ' + fn);
  }

  return _extends({},
  descriptor, {
    value: function value() {var _this = this;for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
      return profiler.profile(prefix, function () {return fn.call.apply(fn, [_this].concat(_toConsumableArray(args)));});
    } });

}

module.exports = function profile() {for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {args[_key2] = arguments[_key2];}
  return decorate(handleDescriptor, args);
};