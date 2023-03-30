'use strict';var _require = require('util.cursor'),Cursor = _require.Cursor,ApiCursor = _require.ApiCursor,BufferedApiCursor = _require.BufferedApiCursor,
pathTo = require('util.paths.to'),
clone = require('clone'),
copy = clone(module.exports),
cursorWrap = {
  'pipeline.run': module.exports.pipeline.run,
  'pipeline.evaluate': module.exports.pipeline.evaluate,
  'runtime.pipeline.run': module.exports.runtime.pipeline.run,
  'runtime.pipeline.evaluate': module.exports.runtime.pipeline.evaluate };


Object.keys(cursorWrap).forEach(function (path) {

  pathTo(copy, path, function (expression, input) {for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {args[_key - 2] = arguments[_key];}

    if (input && input instanceof Cursor) {
      if (input instanceof BufferedApiCursor) {
        input.shared();
      }
      input = input.passthru(false);
    }

    var output = cursorWrap[path].apply(cursorWrap, [expression, input].concat(args));

    if (output && output.object === 'cursor' && output._id) {
      output = new ApiCursor(output._id);
    }

    return output;

  });

});

module.exports = copy;