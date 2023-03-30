'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var hasOwn = Object.prototype.hasOwnProperty,
toString = Object.prototype.toString;

var Undefined = void 0;

function isPlainObject(obj) {

  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }

  var hasOwnConstructor = hasOwn.call(obj, 'constructor'),
  hasIsPropertyOfMethod = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');


  if (obj.constructor && !hasOwnConstructor && !hasIsPropertyOfMethod) {
    return false;
  }



  var key = void 0;
  for (key in obj) {}
  return key === Undefined || hasOwn.call(obj, key);

}

function extend() {

  var options = void 0,
  name = void 0,
  src = void 0,
  copy = void 0,
  copyIsArray = void 0,
  clone = void 0,
  target = arguments[0],
  i = 1,
  length = arguments.length,
  deep = false;


  if (typeof target === 'boolean') {
    deep = target;
    target = arguments[1] || {};

    i = 2;
  } else if ((typeof target === 'undefined' ? 'undefined' : _typeof(target)) !== 'object' && typeof target !== 'function' || target === null || target === Undefined) {
    target = {};
  }

  for (; i < length; ++i) {
    options = arguments[i];

    if (options !== null && options !== Undefined) {

      for (name in options) {
        if (options.hasOwnProperty(name)) {
          src = target[name];
          copy = options[name];


          if (target === copy) {
            continue;
          }


          if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && Array.isArray(src) ? src : [];
            } else {
              clone = src && isPlainObject(src) ? src : {};
            }


            target[name] = extend(deep, clone, copy);


          } else if (copy !== Undefined) {
            target[name] = copy;
          }
        }
      }
    }
  }


  return target;
}

module.exports = {
  isPlainObject: isPlainObject,
  extend: extend };