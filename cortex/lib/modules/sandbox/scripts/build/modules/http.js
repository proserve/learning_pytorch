'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();function _defineProperty(obj, key, value) {if (key in obj) {Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });} else {obj[key] = value;}return obj;}var http = module.exports,_require =
require('util.cursor'),ApiCursor = _require.ApiCursor,_require2 =
require('stream'),OpaqueStream = _require2.OpaqueStream,
methods = ['get', 'head', 'patch', 'post', 'put', 'delete', 'options'];

module.exports = {};var _loop = function _loop(

key, value) {

  if (methods.includes(key)) {

    Object.assign(
    module.exports, _defineProperty({},

    key, function () {for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {params[_key] = arguments[_key];}

      var result = value.call.apply(value, [http].concat(params)),
      cursor = result.cursor,stream = result.stream;
      if (stream && stream._id && stream.object === 'stream') {
        result.stream = new OpaqueStream(stream);
      } else if (cursor && cursor._id && cursor.object === 'cursor') {
        result.cursor = new ApiCursor(cursor);
      }
      return result;
    }));



  } else {

    Object.assign(module.exports, _defineProperty({}, key, value));
  }};var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {for (var _iterator = Object.entries(http)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _ref = _step.value;var _ref2 = _slicedToArray(_ref, 2);var key = _ref2[0];var value = _ref2[1];_loop(key, value);

  }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}