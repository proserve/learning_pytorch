'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};

try {
  require('logger').warn('The utils module is deprecated.');
} catch (err) {
}

var Undefined = void 0;

var _ = require('underscore'),
OBJECT_ID_REGEXP = /^[0-9a-fA-F]{24}$/,
TRUEY = ['y', 'yes', 'true', '1'],
FALSY = ['n', 'no', 'false', '0'],
isPrimitiveRegex = /^[sbn]/,
utils = {

  array: function array(val, wrap) {
    return _.isArray(val) ? val : wrap ? [val] : [];
  },

  clamp: function clamp(number, min, max) {
    if (_.isNumber(number) && number > min) {
      return number > max ? max : number;
    }
    return min;
  },

  path: function path(obj, path, value, returnTopOnWrite) {
    if (obj === null || obj === Undefined) return Undefined;
    if (!path || !_.isString(path)) return undefined;
    var p = path.split('.'),
    write = arguments.length > 2,
    i = void 0,
    j = void 0;
    if (write) {
      var top = obj;
      for (i = 0, j = p.length - 1; i < j; i++) {
        if (obj[p[i]] === null || obj[p[i]] === Undefined) {
          obj[p[i]] = {};
        }
        obj = obj[p[i]];
      }
      obj[p[p.length - 1]] = value;
      if (returnTopOnWrite) return top;
    } else {
      for (i = 0, j = p.length; i < j; i++) {
        if (obj != null) {
          obj = obj[p[i]];
        }
      }
    }
    return obj;
  },

  stringToBoolean: function stringToBoolean(val, defaultVal) {
    if (val != null) {
      if (~FALSY.indexOf(String(val).toLowerCase())) {
        return false;
      }if (~TRUEY.indexOf(String(val).toLowerCase())) {
        return true;
      }
    }
    return defaultVal;
  },

  getIdOrNull: function getIdOrNull(value) {
    if (utils.isId(value)) {
      return value;
    }
    if (utils.isIdFormat(value)) {
      return new ObjectID(value);
    }
    return null;
  },

  indexOfId: function indexOfId(ids, id) {
    id = utils.getIdOrNull(id);
    if (id && _.isArray(ids)) {
      for (var i = 0, j = ids.length; i < j; i++) {
        if (utils.equalIds(ids[i], id)) return i;
      }
    }
    return -1;
  },

  equalIds: function equalIds(a, varArgs) {
    a = utils.getIdOrNull(a);
    if (!a) return false;
    var b = void 0,
    len = arguments.length;
    while (len-- > 1) {
      b = utils.getIdOrNull(arguments[len]);
      if (!b) {
        return false;
      }if (!a.equals(b)) {
        return false;
      }
    }
    return true;
  },

  timestampToId: function timestampToId(timestamp) {
    return new ObjectID(new Date(utils.rInt(timestamp, 0)));
  },

  idToTimestamp: function idToTimestamp(id) {
    id = utils.getIdOrNull(id);
    return id ? id.toDate().getTime() : 0;
  },

  inIdArray: function inIdArray(ids, id) {
    return utils.indexOfId(ids, id) > -1;
  },

  isIdFormat: function isIdFormat(id) {
    return _.isString(id) && OBJECT_ID_REGEXP.test(id);
  },

  couldBeId: function couldBeId(id) {
    return utils.isId(id) || utils.isIdFormat(id);
  },

  getIdArray: function getIdArray(ids, convertToStrings, fnEach) {
    if (!_.isArray(ids)) ids = [ids];
    var isFunction = _.isFunction(fnEach);
    for (var i = ids.length - 1; i >= 0; i--) {
      var id = isFunction ? fnEach(ids[i]) : ids[i];
      id = utils.getIdOrNull(id);
      if (id) {
        ids[i] = convertToStrings ? id.toString() : id;
      } else {
        ids.splice(i, 1);
      }
    }
    return ids;
  },

  uniqueIdArray: function uniqueIdArray(ids) {
    ids = utils.getIdArray(ids);
    return ids.filter(function (id, i, a) {return i === utils.indexOfId(a, id);});
  },

  lookupId: function lookupId(obj, id) {
    var out = null;
    if (_.isObject(obj) && (id = utils.getIdOrNull(id))) {
      Object.keys(obj).forEach(function (key) {
        if (!out && utils.equalIds(id, key)) {
          out = obj[key];
        }
      });
    }
    return out;
  },

  findIdPos: function findIdPos(array, path, id, useGetter) {
    if (_.isArray(array)) {
      var item = void 0,
      _id = void 0;
      for (var i = 0, j = array.length; i < j; i++) {
        item = array[i];
        if (item != null) {
          _id = useGetter && _.isFunction(item.get) ? item.get(path) : utils.path(item, path);
          if (utils.equalIds(_id, id)) {
            return i;
          }
        }
      }
    }
    return -1;
  },

  findIdInArray: function findIdInArray(array, path, id, useGetter) {
    var pos = utils.findIdPos(array, path, id, useGetter);
    return pos === -1 ? undefined : array[pos];
  },

  diffIdArrays: function diffIdArrays(array) {
    var rest = Array.prototype.slice.call(arguments, 1);
    return _.filter(utils.uniqueIdArray(array), function (item) {return _.every(rest, function (other) {return !utils.inIdArray(other, item);});});
  },

  intersectIdArrays: function intersectIdArrays(array) {
    var rest = Array.prototype.slice.call(arguments, 1);
    return _.filter(utils.uniqueIdArray(array), function (item) {return _.every(rest, function (other) {return utils.inIdArray(other, item);});});
  },

  isId: function isId(id) {
    return id instanceof ObjectID;
  },

  rVal: function rVal(val, defaultVal) {
    if (val === undefined) return defaultVal;
    return val;
  },

  rInt: function rInt(val, defaultVal) {
    if (val === undefined) return defaultVal;
    if (utils.isInteger(val)) return parseInt(val);
    return defaultVal;
  },

  rString: function rString(val, defaultVal) {
    if (val === undefined) return defaultVal;
    if (_.isString(val)) return val;
    return defaultVal;
  },

  rBool: function rBool(val, defaultVal) {
    if (val === undefined) return defaultVal;
    return !!val;
  },

  isPrimitive: function isPrimitive(value) {
    return value == null || isPrimitiveRegex.test(typeof value === 'undefined' ? 'undefined' : _typeof(value));
  },

  pad: function pad(string, size, character) {
    var pad = void 0,
    _i = void 0,
    _size = void 0;
    if (character == null) {
      character = ' ';
    }
    if (typeof string === 'number') {
      _size = size;
      size = string;
      string = _size;
    }
    string = string.toString();
    pad = '';
    size -= string.length;
    for (_i = 0; size >= 0 ? _i < size : _i > size; size >= 0 ? ++_i : --_i) {
      pad += character;
    }
    if (_size) {
      return pad + string;
    }
    return string + pad;

  },

  isCircular: function isCircular(obj, seen) {
    if (_.isObject(obj)) {
      seen = seen || [];
      if (~seen.indexOf(obj)) {
        return true;
      }
      seen.push(obj);
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (utils.isCircular(obj[keys[i]], seen.slice(0))) {
          return true;
        }
      }
    }
    return false;
  },

  isInt: function isInt(n) {
    return typeof n === 'number' && parseFloat(n) == parseInt(n, 10) && !isNaN(n);
  },

  isNumeric: function isNumeric(obj) {
    return !_.isArray(obj) && obj - parseFloat(obj) + 1 >= 0;
  },

  isInteger: function isInteger(a) {
    var b = void 0;
    return isFinite(a) && (b = String(a)) == parseInt(b);
  },

  getValidDate: function getValidDate(d, defaultValue) {

    if (d == null) {
      return defaultValue === undefined ? null : utils.getValidDate(defaultValue);
    }
    if (_.isDate(d)) {
      if (isNaN(d.getTime())) {
        return null;
      }
      return d;
    }
    try {
      d = new Date(Date.parse(d));
      if (utils.isValidDate(d)) {
        return d;
      }
    } catch (e) {}

    return defaultValue === undefined ? null : utils.getValidDate(defaultValue);

  },

  isValidDate: function isValidDate(d) {
    if (!_.isDate(d)) {
      return false;
    }
    return !isNaN(d.getTime());
  },

  dateToAge: function dateToAge(birthDate) {
    if (!_.isDate(birthDate)) return 0;
    var today = new Date(),
    age = today.getFullYear() - birthDate.getFullYear(),
    m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
      age--;
    }
    return age;
  } };



module.exports = utils;