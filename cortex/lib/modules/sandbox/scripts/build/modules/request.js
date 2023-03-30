'use strict';var accessor = require('util.paths.accessor'),
memo = module.exports.memo;

module.exports = Object.assign(
module.exports,
global.env.request,
{
  getHeader: function getHeader(name) {
    return module.exports.headers[String(name).toLowerCase()];
  },







  memo: accessor(memo) });