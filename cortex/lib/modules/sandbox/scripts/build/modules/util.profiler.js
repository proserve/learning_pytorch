'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();

var _clone = require('clone');var _clone2 = _interopRequireDefault(_clone);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

var profiled = {},
running = {},
enabled = false;

var profiler = {

  get enabled() {
    return enabled;
  },

  set enabled(v) {
    enabled = !!v;
  },

  start: function start(what) {
    var now = performance.now();
    if (enabled) {
      running[what] = now;
    }
    return now;
  },

  end: function end(what) {var record = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    if (enabled) {
      var start = running[what];
      if (start) {
        delete running[what];
        var ms = performance.now() - start;
        if (record) {
          var section = profiled[what];
          if (!section) {
            section = {
              count: 0,
              total: 0,
              avg: 0,
              max: 0,
              min: 0 };

            profiled[what] = section;
          }
          section.count += 1;
          section.total += ms;
          section.avg = section.total / section.count;
          section.max = section.count === 1 ? ms : Math.max(section.max, ms);
          section.min = section.count === 1 ? ms : Math.min(section.min, ms);
        }
        return ms;
      }
    }
    return 0;

  },

  profile: function profile(what, fn) {var scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (!enabled) {
      return fn.call(scope);
    }

    var err = void 0,
    result = void 0;

    profiler.start(what);
    try {
      result = fn.call(scope);
    } catch (e) {
      err = e;
    }

    profiler.end(what, true);

    if (err) {
      throw err;
    }
    return result;

  },

  reset: function reset() {
    profiled = {};
    running = {};
  },

  report: function report() {var formatted = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    return formatted ?
    Object.entries(profiled).
    map(function (_ref) {var _ref2 = _slicedToArray(_ref, 2),what = _ref2[0],section = _ref2[1];return _extends({
        what: what },
      section);}).

    sort(function (a, b) {return b.what - a.what;}).
    map(function (v) {return v.what + ' - avg: ' + v.avg.toFixed(3) + ', min: ' + v.min.toFixed(3) + ', max: ' + v.max.toFixed(3) + ', count: ' + v.count + ', total: ' + v.total.toFixed(3);}) :
    (0, _clone2.default)(profiled);
  } };



module.exports = profiler;