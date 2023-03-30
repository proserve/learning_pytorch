'use strict';var _util = require('util.cursor');
var _utilPaths = require('util.paths.to');var _utilPaths2 = _interopRequireDefault(_utilPaths);
var _clone = require('clone');var _clone2 = _interopRequireDefault(_clone);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

var copy = (0, _clone2.default)(module.exports),
cursorWrap = {
  'environment.export': module.exports.environment.export,
  'environment.import': module.exports.environment.import };


Object.keys(cursorWrap).forEach(function (path) {

  (0, _utilPaths2.default)(copy, path, function () {return new _util.ApiCursor(cursorWrap[path].apply(cursorWrap, arguments)._id);});

});

module.exports = copy;