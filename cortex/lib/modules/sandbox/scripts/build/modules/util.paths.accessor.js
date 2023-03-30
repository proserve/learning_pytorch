"use strict";var Undefined = void 0;

module.exports = function (api) {var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},_ref$getUndefinedKey = _ref.getUndefinedKey,getUndefinedKey = _ref$getUndefinedKey === undefined ? true : _ref$getUndefinedKey,_ref$extra = _ref.extra,extra = _ref$extra === undefined ? {} : _ref$extra;var _ref2 =

  api || {},_ref2$get = _ref2.get,get = _ref2$get === undefined ? function () {} : _ref2$get,_ref2$set = _ref2.set,set = _ref2$set === undefined ? function () {} : _ref2$set,

  accessor = function accessor() {var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Undefined;var val = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Undefined;

    if (key === Undefined) {
      return getUndefinedKey ? get() : Undefined;
    }
    if (val === Undefined) {
      return get(key);
    }
    if (set) {
      return set(key, val);
    }
  };var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {

    for (var _iterator = Object.keys(extra)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var key = _step.value;
      accessor[key] = extra[key];
    }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}

  return accessor;
};