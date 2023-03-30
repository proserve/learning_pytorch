'use strict';var _require = require('util.cursor'),ApiCursor = _require.ApiCursor,
_tail = module.exports.tail,
sys = {};

module.exports = Object.assign(
sys,
module.exports,
{
  tail: function tail() {
    return new ApiCursor(_tail.apply(undefined, arguments));
  } });