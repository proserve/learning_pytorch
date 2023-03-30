'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var Undefined = void 0,
TRUEY = ['y', 'yes', 'true', '1'],
FALSY = ['n', 'no', 'false', '0'],
isPrimitiveRegex = /^[sbn]/,
ObjectToString = Object.prototype.toString;

function isFunction(v) {
  return ObjectToString.call(v) === '[object Function]';
}

function isDate(v) {
  return ObjectToString.call(v) === '[object Date]';
}

function isString(v) {
  return ObjectToString.call(v) === '[object String]';
}

function isArray(v) {
  return Array.isArray(v);
}

function isNumber(v) {
  return ObjectToString.call(v) === '[object Number]';
}

function isRegExp(v) {
  return ObjectToString.call(v) === '[object RegExp]';
}

function isError(v) {
  return ObjectToString.call(v) === '[object Error]';
}

function isObject(v) {
  var type = typeof v === 'undefined' ? 'undefined' : _typeof(v);
  return type === 'function' || type === 'object' && !!v;
}

function isSet(value) {
  return value !== null && value !== Undefined;
}

exports = module.exports = {

  isFunction: isFunction,
  isDate: isDate,
  isString: isString,
  isArray: isArray,
  isNumber: isNumber,
  isRegExp: isRegExp,
  isObject: isObject,
  isError: isError,

  option: function option(options, _option, defaultValue, fnTest, fnTransform) {
    if (exports.hasValue(options) && options[_option] !== Undefined) {
      if (fnTest && isFunction(fnTest)) {
        if (!fnTest(options[_option])) {
          return defaultValue;
        }
      }
      if (fnTransform && isFunction(fnTransform)) {
        return fnTransform(options[_option]);
      }
      return options[_option];
    }
    return defaultValue;
  },

  hasNoValue: function hasNoValue() {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    return v === null;
  },

  hasValue: function hasValue() {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    return v !== null;
  },

  stringToBoolean: function stringToBoolean() {var val = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var defaultVal = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Undefined;
    if (val !== null) {
      if (~FALSY.indexOf(String(val).toLowerCase())) {
        return false;
      }if (~TRUEY.indexOf(String(val).toLowerCase())) {
        return true;
      }
    }
    return defaultVal;
  },

  within: function within(number, min, max) {
    number = parseFloat(number);
    return number >= min && number <= max;
  },

  array: function array(val, wrap) {
    return isArray(val) ? val : wrap ? [val] : [];
  },

  rVal: function rVal(val, defaultVal) {
    if (val === Undefined) return defaultVal;
    return val;
  },

  isSet: isSet,

  rNum: function rNum(val, defaultVal) {
    if (val === Undefined) return defaultVal;
    if (exports.isNumeric(val)) return parseFloat(val);
    return defaultVal;
  },

  rInt: function rInt(val, defaultVal) {
    if (val === Undefined) return defaultVal;
    if (exports.isInteger(val)) return parseInt(val);
    return defaultVal;
  },

  rString: function rString(val, defaultVal) {
    if (val === Undefined) return defaultVal;
    if (isString(val)) return val;
    return defaultVal;
  },

  rBool: function rBool() {var boolValue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return Boolean(boolValue === null ? defaultValue : boolValue);
  },

  isPrimitive: function isPrimitive() {var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    return value === null || isPrimitiveRegex.test(typeof value === 'undefined' ? 'undefined' : _typeof(value));
  },

  isInt: function isInt(n) {
    return typeof n === 'number' && parseFloat(n) === parseInt(n, 10) && !isNaN(n);
  },

  isNumeric: function isNumeric(obj) {
    return !isArray(obj) && obj - parseFloat(obj) + 1 >= 0;
  },

  isInteger: function isInteger(a) {
    var b = void 0;
    return isFinite(a) && (b = String(a)) == parseInt(b);
  },

  getValidDate: function getValidDate() {var d = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (d === null) {
      return defaultValue === null ? null : exports.getValidDate(defaultValue);
    }
    if (isDate(d)) {
      if (isNaN(d.getTime())) {
        return null;
      }
      return d;
    }
    try {
      d = new Date(Date.parse(d));
      if (exports.isValidDate(d)) {
        return d;
      }
    } catch (e) {}
    return defaultValue === Undefined ? null : exports.getValidDate(defaultValue);

  },

  isValidDate: function isValidDate(d) {
    if (!isDate(d)) {
      return false;
    }
    return !isNaN(d.getTime());
  },

  dateToAge: function dateToAge(birthDate) {
    if (!isDate(birthDate)) return 0;
    var today = new Date(),
    m = today.getMonth() - birthDate.getMonth();
    var age = today.getFullYear() - birthDate.getFullYear();
    if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
      age--;
    }
    return age;
  },









  pad: function pad(string, size) {var character = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var pad = void 0,
    i = void 0,
    sz = void 0;
    if (character === null) {
      character = ' ';
    }
    if (typeof string === 'number') {
      sz = size;
      size = string;
      string = sz;
    }
    string = string.toString();
    pad = '';
    size -= string.length;
    for (i = 0; size >= 0 ? i < size : i > size; size >= 0 ? ++i : --i) {
      pad += character;
    }
    if (sz) {
      return pad + string;
    }
    return string + pad;

  },

  escapeRegex: function escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  },

  clamp: function clamp(number, min, max) {
    if (isNumber(number) && number > min) {
      return number > max ? max : number;
    }
    return min;
  },

  nullFunc: function nullFunc() {

  },

  ensureCallback: function ensureCallback(fn) {
    return isFunction(fn) ? fn : exports.nullFunc;
  },

  tryCatch: function tryCatch() {var fn = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};var waitLoop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    var err = void 0,
    result = void 0;
    try {
      result = isFunction(fn) ? fn() : Undefined;
    } catch (e) {
      err = e;
    }
    if (isFunction(callback)) {
      if (waitLoop) {
        setImmediate(callback, err, result);
      } else {
        callback(err, result);
      }
    }
    return [err, result];

  },

  naturalCmp: function naturalCmp(str1, str2) {

    if (str1 === str2) return 0;
    if (!str1) return -1;
    if (!str2) return 1;

    var cmpRegex = /(\.\d+|\d+|\D+)/g,
    tokens1 = String(str1).match(cmpRegex),
    tokens2 = String(str2).match(cmpRegex),
    count = Math.min(tokens1.length, tokens2.length);

    for (var i = 0; i < count; i++) {

      var a = tokens1[i],
      b = tokens2[i];

      if (a !== b) {
        var num1 = +a,
        num2 = +b;
        if (num1 === num1 && num2 === num2) {
          return num1 > num2 ? 1 : -1;
        }
        return a < b ? -1 : 1;
      }
    }

    if (tokens1.length !== tokens2.length) {return tokens1.length - tokens2.length;}

    return str1 < str2 ? -1 : 1;
  },

  compact: function compact(object) {for (var _len = arguments.length, values = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {values[_key - 1] = arguments[_key];}
    if (isObject(object) && values.length) {
      Object.keys(object).forEach(function (key) {
        if (values.includes(object[key])) {
          delete object[key];
        }
      });
    }
    return object;
  },

  matchesEnvironment: function matchesEnvironment(value) {var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '*';



    if (!isSet(value)) {
      value = defaultValue;
    }
    return value === '*' || script.env && value === script.env.name;
  },

  getAllProperties: function getAllProperties(obj) {
    var allProps = [];
    var curr = obj;
    do {
      var props = Object.getOwnPropertyNames(curr);
      props.forEach(function (prop) {
        if (allProps.indexOf(prop) === -1) {allProps.push(prop);}
      });
      curr = Object.getPrototypeOf(curr);
    } while (curr);
    return allProps;
  } };