'use strict';module.exports = Object.freeze(['cursor', 'json', 'id', 'ip', 'hex', 'paths.to', 'deep-extend', 'deep-equals', 'object', 'values', 'profiler', 'paths.accessor'].reduce(function (object, path) {
  var parts = path.split('.');
  for (var i = 0, curr = object; i < parts.length; i++) {
    var part = parts[i];
    if (i === parts.length - 1) {
      Object.defineProperty(curr, part, {
        get: function get() {
          return require('util.' + path);
        } });

    } else {
      if (!curr[part]) {
        Object.defineProperty(curr, part, {
          value: {} });

      }
      curr = curr[part];
    }
  }
  return object;
}, {}));