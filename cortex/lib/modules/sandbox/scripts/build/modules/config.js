'use strict';var accessor = require('util.paths.accessor'),
config = module.exports;

module.exports = accessor(config, { getUndefinedKey: false });

for (var func in config) {
  if (config.hasOwnProperty(func)) {
    module.exports[func] = config[func];
  }
}