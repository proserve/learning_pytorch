'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _module$exports = module.exports,statics = _module$exports.statics,classes = _module$exports.classes,
symLocales = Symbol('locales'),
symOptions = Symbol('options');

module.exports = {};var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {



  for (var _iterator = Object.entries(statics)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _ref = _step.value;var _ref2 = _slicedToArray(_ref, 2);var key = _ref2[0];var value = _ref2[1];
    module.exports[key] = value;
  }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {

  for (var _iterator2 = Object.entries(classes)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var _ref3 = _step2.value;var _ref4 = _slicedToArray(_ref3, 2);var _key = _ref4[0];var cls = _ref4[1];


    var Cls = Function('constructor', '\n        return function ' +
    _key + '(locales, options) {                   \n            constructor.call(this, locales, options)            \n        }')(

    function constructor() {var locales = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (locales === null) {
        locales = [script.locale];
      }
      this[symLocales] = locales;
      this[symOptions] = options;
    });var _loop = function _loop(

    name, _value) {
      Cls[name] = function () {for (var _len = arguments.length, params = Array(_len), _key2 = 0; _key2 < _len; _key2++) {params[_key2] = arguments[_key2];}
        return _value(params);
      };};var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {for (var _iterator3 = Object.entries(cls.statics)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var _ref5 = _step3.value;var _ref6 = _slicedToArray(_ref5, 2);var name = _ref6[0];var _value = _ref6[1];_loop(name, _value);
      }} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3.return) {_iterator3.return();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}var _loop2 = function _loop2(

    name, _value2) {
      Cls.prototype[name] = function () {for (var _len2 = arguments.length, params = Array(_len2), _key3 = 0; _key3 < _len2; _key3++) {params[_key3] = arguments[_key3];}
        return _value2([this[symLocales], this[symOptions]].concat(params));
      };};var _iteratorNormalCompletion4 = true;var _didIteratorError4 = false;var _iteratorError4 = undefined;try {for (var _iterator4 = Object.entries(cls.methods)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {var _ref7 = _step4.value;var _ref8 = _slicedToArray(_ref7, 2);var name = _ref8[0];var _value2 = _ref8[1];_loop2(name, _value2);
      }} catch (err) {_didIteratorError4 = true;_iteratorError4 = err;} finally {try {if (!_iteratorNormalCompletion4 && _iterator4.return) {_iterator4.return();}} finally {if (_didIteratorError4) {throw _iteratorError4;}}}

    module.exports[_key] = Cls;
  }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}