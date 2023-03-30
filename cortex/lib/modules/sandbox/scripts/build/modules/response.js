'use strict';Object.assign(
module.exports,
{
  redirect: function redirect(url) {

    var address = url,
    status = 302,
    body = '';
    if (arguments.length > 1) {
      if (typeof arguments[0] === 'number') {
        status = arguments[0];
        address = arguments[1];
        if (arguments.length > 2) {
          body = arguments[2];
        }
      }
    }

    this.setStatusCode(status);
    this.setHeader('Location', address);

    if (global.env && global.env.request && global.env.request.method === 'HEAD') {
      return this.end();
    }
    return this.end(body);
  } });