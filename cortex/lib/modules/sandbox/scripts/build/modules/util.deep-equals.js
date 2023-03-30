'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};






var Undefined = void 0;

var toString = Object.prototype.toString,
pSlice = Array.prototype.slice,
objectKeys = Object.keys,
deepEquals = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  if (isUndefinedOrNull(opts.strict)) opts.strict = true;
  if (isUndefinedOrNull(opts.circular)) opts.circular = false;

  if (actual === expected) {
    return true;

  }if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  }if (actual instanceof ObjectID && expected instanceof ObjectID) {
    return actual.equals(expected);

  }if (actual instanceof RegExp && expected instanceof RegExp) {
    return String(actual) === String(expected);



  }if (!actual || !expected || (typeof actual === 'undefined' ? 'undefined' : _typeof(actual)) !== 'object' && (typeof expected === 'undefined' ? 'undefined' : _typeof(expected)) !== 'object') {
    return opts.strict ? actual === expected : actual == expected;







  }
  return objEquiv(actual, expected, opts);

};

function isArguments(object) {
  return toString.call(object) === '[object Arguments]';
}

function isUndefinedOrNull(value) {
  return value === null || value === Undefined;
}

function isBuffer(x) {
  if (!x || (typeof x === 'undefined' ? 'undefined' : _typeof(x)) !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  return !(x.length > 0 && typeof x[0] !== 'number');

}

function objEquiv(a, b, opts) {

  if (isUndefinedOrNull(a) || isUndefinedOrNull(b)) {return false;}

  if (a.prototype !== b.prototype) return false;


  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEquals(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  var ka = void 0,
  kb = void 0;
  try {
    ka = objectKeys(a);
    kb = objectKeys(b);
  } catch (e) {
    return false;
  }


  if (ka.length !== kb.length) {return false;}

  ka.sort();
  kb.sort();

  for (var _i = ka.length - 1; _i >= 0; _i--) {
    if (ka[_i] != kb[_i]) {return false;}
  }


  for (var _i2 = ka.length - 1; _i2 >= 0; _i2--) {
    var key = ka[_i2];
    if (!deepEquals(a[key], b[key], opts)) return false;
  }
  return (typeof a === 'undefined' ? 'undefined' : _typeof(a)) === (typeof b === 'undefined' ? 'undefined' : _typeof(b));
}