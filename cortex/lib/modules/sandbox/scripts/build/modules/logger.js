'use strict';var levels = {
  error: 0, warn: 1, info: 2, debug: 3, trace: 4 },

keys = Object.keys(levels),
logger = module.exports;

var level = 'trace';

module.exports = {};
Object.defineProperties(module.exports, {

  level: {
    get: function get() {return level;},
    set: function set(l) {
      if (keys.includes(l)) {
        level = l;
      }
    } } });var _loop = function _loop(




l) {
  module.exports[l] = function () {
    if (levels[l] <= levels[level]) {
      return logger[l].apply(logger, arguments);
    }
  };};var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var l = _step.value;_loop(l);
  }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}