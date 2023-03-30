'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}function _toArray(arr) {return Array.isArray(arr) ? arr : Array.from(arr);}var _require =

require('decorator-utils'),decorate = _require.decorate,
ids = Symbol('util.id');

function handleDescriptor(target, key, descriptor, _ref) {var _ref2 = _toArray(_ref),options = _ref2.slice(0);

  var fn = descriptor.value,
  pairs = [];

  if (typeof fn !== 'function') {
    throw new SyntaxError('@acl can only be used on class functions');
  }

  for (var i = 0; i < options.length; i += 2) {
    pairs.push([options[i], options[i + 1]]);
  }

  return _extends({},
  descriptor, {
    value: function value() {var _this = this;for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
      if (!pairs.some(function (_ref3) {var _ref4 = _slicedToArray(_ref3, 2),type = _ref4[0],option = _ref4[1];
        switch (type) {
          case 'role':
            if ((Array.isArray(option) ? option : [option]).some(
            function (role) {return script.principal.hasRole(role);}))

            {
              return true;
            }
            break;
          case 'account':
            if ((Array.isArray(option) ? option : [option]).some(
            function (account) {return script.principal.email.toLowerCase() === String(account).toLowerCase() || ids.equalIds(script.principal._id, account);}))

            {
              return true;
            }
            break;
          case 'assert':
            if (typeof option !== 'function') {
              throw new SyntaxError('@acl assert requires a function');
            }
            if (option.call.apply(option, [_this, script.principal].concat(_toConsumableArray(args)))) {
              return true;
            }
            break;
          default:
            throw Fault.create('script.invalidArgument.acl', { reason: 'Unsupported or missing decorator acl type argument (' + type + ')' });}


      })) {
        throw Fault.create('script.accessDenied.acl');
      }
      return fn.call.apply(fn, [this].concat(_toConsumableArray(args)));
    } });


}

module.exports = function as() {for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {args[_key2] = arguments[_key2];}
  return decorate(handleDescriptor, args);
};