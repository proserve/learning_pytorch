'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _require = require('decorator-utils'),decorate = _require.decorate,
ObjectRuntime = require('runtime.object').Runtime,_require2 =
require('util.values'),isFunction = _require2.isFunction;

function object() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}

  var Class = args[0];

  if (Class && args.length === 1 && isFunction(Class)) {
    ObjectRuntime.initialize(Class, Class.name.toLowerCase(), {});
  } else {
    return decorate(
    function (Class, _ref, descriptor) {var _ref2 = _slicedToArray(_ref, 2),name = _ref2[0],options = _ref2[1];

      if (descriptor) {
        throw new TypeError('@object can only be used on class declarations');
      }

      if ((typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object') {
        options = name;
        name = Class.name.toLowerCase();
      } else if (typeof name !== 'string') {
        name = Class.name.toLowerCase();
      }

      ObjectRuntime.initialize(
      Class,
      name || Class.name.toLowerCase(),
      options);


    },

    args);

  }
}

module.exports = object;