'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};

var pathTo = require('util.paths.to');

exports = module.exports = {

  OBJECT_ID_REGEXP: /^[0-9a-fA-F]{24}$/,

  isIdFormat: function isIdFormat(id) {
    return typeof id === 'string' && exports.OBJECT_ID_REGEXP.test(id);
  },

  couldBeId: function couldBeId(id) {
    return exports.isId(id) || exports.isIdFormat(id);
  },

  equalIds: function equalIds(a, varArgs) {
    a = exports.getIdOrNull(a);
    if (!a) return false;
    var len = arguments.length;
    while (len-- > 1) {
      var b = exports.getIdOrNull(arguments[len]);
      if (!b || !a.equals(b)) {
        return false;
      }
    }
    return true;
  },
  timestampToId: function timestampToId(timestamp) {

    if (typeof timestamp === 'string') {
      timestamp = new Date(timestamp).getTime();
    }
    return new ObjectID(timestamp);
  },

  idToTimestamp: function idToTimestamp(id) {
    id = exports.getIdOrNull(id);
    return id ? id.getTimestamp() : 0;
  },

  createId: function createId() {var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    return new ObjectID(value);
  },

  getIdOrNull: function getIdOrNull(value, anyObject) {

    if (!value) {
      return null;
    }if (exports.isId(value)) {
      return value;
    }if (exports.isIdFormat(value)) {
      try {
        return new ObjectID(value);
      } catch (e) {
        return null;
      }
    }
    if (anyObject && value._id) {
      return exports.getIdOrNull(value._id, false);
    }
    return null;
  },

  indexOfId: function indexOfId(ids, id) {
    id = exports.getIdOrNull(id);
    if (id && Array.isArray(ids)) {
      for (var i = 0, j = ids.length; i < j; i++) {
        if (exports.equalIds(ids[i], id)) return i;
      }
    }
    return -1;
  },

  inIdArray: function inIdArray(ids, id) {
    return exports.indexOfId(ids, id) > -1;
  },

  getIdArray: function getIdArray(ids, convertToStrings, fnEach) {
    if (!Array.isArray(ids)) ids = [ids];
    var isFunction = typeof fnEach === 'function';
    for (var i = ids.length - 1; i >= 0; i--) {
      var id = exports.getIdOrNull(isFunction ? fnEach(ids[i]) : ids[i]);
      if (id) {
        ids[i] = convertToStrings ? id.toString() : id;
      } else {
        ids.splice(i, 1);
      }
    }
    return ids;
  },

  uniqueIdArray: function uniqueIdArray(ids) {
    if (Array.isArray(ids)) {
      ids = ids.slice();
    } else {
      ids = [ids];
    }
    ids = exports.getIdArray(ids);
    return ids.filter(function (id, i, a) {return i === exports.indexOfId(a, id);});
  },

  lookupId: function lookupId(obj, id) {
    var out = null;
    var type = typeof obj === 'undefined' ? 'undefined' : _typeof(obj),
    lookFor = exports.getIdOrNull(id);

    if (lookFor && (type === 'function' || type === 'object' && !!obj)) {
      Object.keys(obj).forEach(function (key) {
        if (!out && exports.equalIds(id, key)) {
          out = obj[key];
        }
      });
    }
    return out;
  },

  findIdPos: function findIdPos(array, path, id) {
    if (Array.isArray(array)) {
      for (var i = 0, j = array.length; i < j; i++) {
        var item = array[i];
        if (item) {
          var _id = pathTo(item, path);
          if (exports.equalIds(_id, id)) {
            return i;
          }
        }
      }
    }
    return -1;
  },

  findIdInArray: function findIdInArray(array, path, id) {
    var pos = exports.findIdPos(array, path, id);
    return pos === -1 ? undefined : array[pos];
  },

  diffIdArrays: function diffIdArrays(array) {for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {rest[_key - 1] = arguments[_key];}
    return exports.uniqueIdArray(array).filter(function (item) {return rest.every(function (other) {return !exports.inIdArray(other, item);});});
  },

  intersectIdArrays: function intersectIdArrays(array) {for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {rest[_key2 - 1] = arguments[_key2];}
    return exports.uniqueIdArray(array).filter(function (item) {return rest.every(function (other) {return exports.inIdArray(other, item);});});
  },

  isId: function isId(id) {
    return id instanceof ObjectID;
  } };