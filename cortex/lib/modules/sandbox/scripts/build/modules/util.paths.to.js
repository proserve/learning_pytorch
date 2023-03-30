'use strict';var toString = Object.prototype.toString,
test = '[object String]',
stringTest = function stringTest(string) {return toString.call(string) === test;};

var Undefined = void 0;

exports = module.exports = function (obj, path, value, returnTopOnWrite) {
  if (obj === null || obj === Undefined) return Undefined;
  var isString = stringTest(path),
  isArray = Array.isArray(path),
  p = isString && (isArray ? path : path.split('.')),
  write = arguments.length > 2;

  if (!isString && !isArray) return Undefined;

  if (write) {
    if (obj === null || obj === Undefined) obj = {};
    var top = obj;
    for (var i = 0, j = p.length - 1; i < j; i++) {
      if (obj[p[i]] === null || obj[p[i]] === Undefined) {
        obj[p[i]] = {};
      }
      obj = obj[p[i]];
    }
    obj[p[p.length - 1]] = value;
    if (returnTopOnWrite) return top;
  } else {
    for (var _i = 0, _j = p.length; _i < _j; _i++) {
      if (obj !== null && obj !== Undefined) {
        obj = obj[p[_i]];
      }
    }
  }
  return obj;
};