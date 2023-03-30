'use strict';


var Undefined = void 0;

var OBJECT_ID_REGEXP = /^[0-9a-fA-F]{24}$/,
dig = module.exports = {

  READ_PART_MATCH: /^([^\[]+)($|(\[(\d+|[0-9a-fA-F]{24})\]$))/,
  WRITE_PART_MATCH: /^([^\[]+)($|(\[([0-9a-fA-F]{24})\]$))/,
  LAST_WRITE_PART_MATCH: /^([^\[]+)($|(\[(|[0-9a-fA-F]{24})\]$))/,

  get: function get(obj, path) {

    if (obj === null || obj === Undefined) {
      return Undefined;
    }

    var isString = path && typeof path === 'string',
    isArray = !isString && Array.isArray(path),
    p = isArray ? path : path.split('.');

    if (!isString && !isArray) {
      return Undefined;
    }var _loop = function _loop(

    i, j) {

      var part = p[i],
      match = part.match(dig.READ_PART_MATCH),
      property = match ? match[1] : part,
      id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null,
      idx = match && isInteger(match[4]) ? parseInt(match[4]) : null;

      if (obj !== null && obj !== Undefined) {
        obj = obj[property];
        if (obj !== null && obj !== Undefined) {
          if (id !== null) {
            obj = obj.find(function (v) {return v && v._id && id.equals(v._id);});
          } else if (idx !== null) {
            obj = obj[idx];
          }
        }
      }};for (var i = 0, j = p.length; i < j; i++) {_loop(i, j);
    }

    return obj;

  },












  set: function set(obj, path, value, options) {

    options = options || {};

    var top = obj === null || obj === Undefined ? obj = {} : obj,
    isString = path && typeof path === 'string',
    isArray = !isString && Array.isArray(path);

    if (isString || isArray) {

      var p = isArray ? path : path.split('.');var _loop2 = function _loop2(

      i, j) {

        var part = p[i],
        match = part.match(dig.WRITE_PART_MATCH),
        property = match ? match[1] : part,
        id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null;

        if (obj[property] === null || obj[property] === Undefined) {
          obj[property] = id ? [] : {};
        }
        obj = obj[property];

        if (id) {
          var _el = void 0;
          if (Array.isArray(obj)) {
            _el = obj.find(function (v) {return v && v._id && id.equals(v._id);});
            if (!_el) {
              _el = { _id: id };
              obj.push(_el);
            }
            obj = _el;
          } else {
            throw new TypeError('array expected at ' + p.slice(0, i + 1).join('.'));
          }
        } else {
          obj = obj[property];
        }};for (var i = 0, j = p.length - 1; i < j; i++) {_loop2(i, j);

      }

      var part = p[p.length - 1],
      match = part.match(dig.LAST_WRITE_PART_MATCH),
      _property = match ? match[1] : part,
      _id = match && isIdFormat(match[4]) ? new ObjectID(match[4]) : null,
      push = match && match[4] === '',
      shouldBeArray = _id !== null || push;

      if (shouldBeArray) {

        if (obj[_property] === null || obj[_property] === Undefined) {
          obj[_property] = [];
        } else if (!Array.isArray(obj[_property])) {
          throw new TypeError('array expected at ' + p.join('.'));
        }

        if (_id) {
          if (value === null) {
            var len = obj[_property].length;
            while (len--) {
              var v = obj[_property][len];
              if (v && v._id && _id.equals(v._id)) {
                obj[_property].splice(len, 1);
              }
            }
          } else {
            var _idx = -1,
            el = obj[_property].find(function (v, i) {_idx = i;return v && v._id && _id.equals(v._id);});
            if (!el) {
              if (options.clone) {
                value = clone(value);
              }
              value._id = _id;
              el = value;
              obj[_property].push(el);
            } else {
              if (options.clone) {
                value = clone(value);
              }
              if (options.merge) {
                deepExtend(el, value);
              } else {
                obj[_property].splice(_idx, 1);
                value._id = _id;
                el = value;
                obj[_property].push(el);
              }

            }
            obj = el;
          }
        } else {
          if (options.clone) {
            value = clone(value);
          }
          obj[_property].push(value);
          obj = obj[_property];
        }

      } else {
        if (options.clone) {
          value = clone(value);
        }
        obj[_property] = value;
      }

    }
    return options.returnTop ? top : obj;

  } };



function isIdFormat(id) {
  return id && typeof id === 'string' && OBJECT_ID_REGEXP.test(id);
}

function isInteger(a) {
  var b = void 0;
  return isFinite(a) && (b = String(a)) === parseInt(b).toString();
}

function deepExtend() {
  return require('util.deep-extend').apply(undefined, arguments);
}

function clone() {
  return require('clone').apply(undefined, arguments);
}