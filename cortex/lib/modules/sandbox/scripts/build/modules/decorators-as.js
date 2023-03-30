'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _require =

require('decorator-utils'),decorate = _require.decorate;

function handleDescriptor(target, key, descriptor, _ref) {var _ref2 = _slicedToArray(_ref, 2),account = _ref2[0],options = _ref2[1];

  var fn = descriptor.value;

  if (typeof fn !== 'function') {

    throw new SyntaxError('@as can only be used on class functions');
  }

  function wrapAs() {var _this = this,_arguments = arguments;
    var callAs = function callAs() {return fn.apply(_this, _arguments);};
    return script.as(account, options, callAs);
  }

  return _extends({},
  descriptor, {
    value: wrapAs });


}

module.exports = function as() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
  return decorate(handleDescriptor, args);
};