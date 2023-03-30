'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}

var base64 = require('base64'),_require =
require('util.id'),isId = _require.isId,_require2 =
require('util.values'),isPrimitive = _require2.isPrimitive,isDate = _require2.isDate,isFunction = _require2.isFunction,_require3 =
require('util.object'),isPlainObject = _require3.isPlainObject,
escapeChar = ';',
specialChar = '~',
escapedSpecialChar = '~;',
specialCharSplitRG = /~(?!;)/,
specialCharRG = /~/g,
escapedSpecialCharRG = /~;/g,
typeChar = '^',
escapedTypeChar = '^;',
typeCharRG = /\^/g,
escapedTypeCharRG = /\^;/g,
dateMarker = 'd',
bufferMarker = 'b',
idMarker = 'i',
regExpMarker = 'r',
__proto__ = '__proto__',
constructor = 'constructor',
Undefined = undefined;var

MJSON = function () {function MJSON() {_classCallCheck(this, MJSON);}_createClass(MJSON, null, [{ key: 'stringify', value: function stringify(

    value, options) {var _ref =

      options || {},_ref$hydration = _ref.hydration,hydration = _ref$hydration === undefined ? false : _ref$hydration,replacer = _ref.replacer;var _ref2 =

      options || {},_ref2$indent = _ref2.indent,indent = _ref2$indent === undefined ? '' : _ref2$indent;

      if (typeof indent === 'number') {
        var newIndent = '';
        for (var i = 0; i < indent; i += 1) {
          newIndent += ' ';
        }
        indent = newIndent;
      }

      return JSON.stringify(
      value,
      MJSON.createSerializer({ replacer: replacer, hydration: hydration }),
      indent);


    } }, { key: 'parse', value: function parse(

    value, options) {var _ref3 =

      options || {},_ref3$hydration = _ref3.hydration,hydration = _ref3$hydration === undefined ? false : _ref3$hydration,reviver = _ref3.reviver;

      return value && JSON.parse(
      value,
      MJSON.createDeserializer({ hydration: hydration, reviver: reviver }));


    } }, { key: 'isSerializable', value: function isSerializable(

    value) {

      return isDate(value) || isId(value) || value instanceof RegExp || Buffer.isBuffer(value) || value instanceof Uint8Array;
    } }, { key: 'createSerializer', value: function createSerializer(

    options) {

      var path = void 0,all = void 0,seen = void 0,mapP = void 0,last = void 0,lvl = void 0,top = true;var _ref4 =

      options || {},replacer = _ref4.replacer,_ref4$hydration = _ref4.hydration,hydration = _ref4$hydration === undefined ? false : _ref4$hydration;

      return function (key, value) {
        var root = top && key === '';
        if (root) {
          top = false;
          if (hydration) {
            path = [];
            all = [value];
            seen = [value];
            mapP = [specialChar];
            last = value;
            lvl = 1;
          }
        }
        if (key === __proto__ || key === constructor) {
          return Undefined;
        }
        var is = false;
        if (this[key] && _typeof(this[key]) === 'object') {
          if (isDate(this[key])) {
            value = typeChar + dateMarker + value;
            is = true;
          } else if (isId(this[key])) {
            value = typeChar + idMarker + value;
            is = true;
          } else if (this[key] instanceof RegExp) {
            value = typeChar + regExpMarker + value.toString();
            is = true;
          } else if (Buffer.isBuffer(this[key])) {
            value = typeChar + bufferMarker + base64.encode(this[key]);
            is = true;
          } else if (this[key] instanceof Uint8Array) {
            value = typeChar + bufferMarker + base64.encode(Buffer.from(this[key]));
            is = true;
          }
        }
        if (hydration && !root) {
          if (last !== this) {
            lvl -= lvl - all.indexOf(this) - 1;
            all.splice(lvl, all.length);
            path.splice(lvl - 1, path.length);
            last = this;
          }
          if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && value) {
            if (all.indexOf(value) < 0) {
              all.push(last = value);
            }
            lvl = all.length;
            var i = seen.indexOf(value);
            if (i < 0) {
              i = seen.push(value) - 1;
              path.push(('' + key).replace(specialCharRG, escapedSpecialChar));
              mapP[i] = specialChar + path.join(specialChar);
            } else {
              value = mapP[i];
            }
            return value;
          }
        }
        if (!is && typeof value === 'string') {
          if (hydration && value.charAt(0) === specialChar) {
            value = value.replace(specialCharRG, escapedSpecialChar);
          }
          if (value.charAt(0) === typeChar) {
            value = value.replace(typeCharRG, escapedTypeChar);
          }
        }

        return replacer ? replacer.call(this, key, value) : value;

      };

    } }, { key: 'createDeserializer', value: function createDeserializer(

    options) {var

      reviver = options.reviver,_options$hydration = options.hydration,hydration = _options$hydration === undefined ? false : _options$hydration;

      var top = true;

      return function (key, value) {

        var root = top && key === '',
        isString = typeof value === 'string';

        if (root) {
          top = false;
        }
        if (key === __proto__ || key === constructor) {
          return Undefined;
        }
        if (isString) {
          if (value.charAt(0) === typeChar) {
            if (value.charAt(1) === dateMarker) {
              return new Date(value.slice(2));
            } else if (value.charAt(1) === idMarker) {
              return new ObjectID(value.slice(2));
            } else if (value.charAt(1) === regExpMarker) {
              var str = value.slice(2),pos = str.lastIndexOf('/');
              if (~pos) {
                return new RegExp(str.slice(1, pos), str.slice(pos + 1));
              }
            } else if (value.charAt(1) === bufferMarker) {
              return base64.decode(value.slice(2), true);
            } else if (value.charAt(1) === escapeChar) {
              value = value.replace(escapedTypeCharRG, typeChar);
            }
          }
        }
        if (hydration && root) {
          value = hydrate(value, value, {});
        }
        if (reviver) {
          value = reviver(key, value);
        }
        return value;
      };

    } }]);return MJSON;}();


















function stringify(value) {var format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'json';var options = arguments[2];

  options = options || {};
  if (value instanceof Error) {
    value = toJSON(value);
  }
  if (value === Undefined) return 'null';

  var indent = options.indent,
  handleCircular = options.handleCircular;

  var replacer = isFunction(options.replacer) ? options.replacer : null;
  if (handleCircular) {
    replacer = getSerialize(replacer, function () {return Undefined;});
  }

  switch (format) {

    case 'mjson':
      return MJSON.stringify(
      value,
      {
        hydration: options.hydration,
        replacer: replacer,
        indent: indent });



    case 'json':
    default:
      return JSON.stringify(
      value,
      replacer,
      indent);}



}












function parse(value) {var format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'json';var options = arguments[2];

  options = options || {};
  switch (format) {

    case 'mjson':
      return MJSON.parse(
      value,
      {
        hydration: options.hydration,
        reviver: options.reviver });



    case 'json':
    default:
      return JSON.parse(
      value,
      options.reviver);}



}

exports = module.exports = {

  serialize: function serialize(value) {var hydration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return stringify(value, 'mjson', { hydration: hydration });
  },
  serializeObject: function serializeObject(value) {var hydration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return stringify(value, 'mjson', { hydration: hydration });
  },

  deserialize: function deserialize(value) {var hydration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return parse(value, 'mjson', { hydration: hydration });
  },
  deserializeObject: function deserializeObject(value) {var hydration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return parse(value, 'mjson', { hydration: hydration });
  },

  stringify: stringify,
  parse: parse,
  isSerializable: isSerializable,
  toJSON: toJSON,
  MJSON: MJSON };



function hydrate(root, current, retrieve) {
  var type = typeof current === 'undefined' ? 'undefined' : _typeof(current);
  if (type === 'string') {
    if (current.charAt(0) === specialChar) {
      if (current.length === 1) {
        return root;
      } else if (current.charAt(1) === escapeChar) {
        return current.replace(escapedSpecialCharRG, specialChar);
      }
      if (!retrieve.hasOwnProperty(current)) {
        var keys = current.slice(1).split(specialCharSplitRG);
        var level = root;
        for (var i = 0, length = keys.length; i < length; level = level[keys[i++].replace(escapedSpecialChar, specialChar)]) {
        }
        retrieve[current] = level;
      }
      return retrieve[current];
    }
  } else if (type === 'object') {
    if (Array.isArray(current)) {
      for (var _i = 0, _length = current.length; _i < _length; _i++) {
        current[_i] = hydrate(root, current[_i], retrieve);
      }
      return current;
    }
    for (var key in current) {
      if (current.hasOwnProperty(key)) {
        current[key] = hydrate(root, current[key], retrieve);
      }
    }
    return current;
  }
  return current;
}

function matchPseudoPrimitve(value) {
  return value === Undefined || value === isPrimitive(value) || Array.isArray(value) || isPlainObject(value);
}

function toJSON(obj) {for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {args[_key - 1] = arguments[_key];}
  return obj && isFunction(obj.toJSON) ? obj.toJSON.apply(obj, args) : obj;
}

function isSerializable(value) {var as = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'json';

  switch (as) {

    case 'json':
      return true;

    case 'mjson':
      return matchPseudoPrimitve(value) || MJSON.isSerializable(value);}



}

function getSerialize(replacer, cycleReplacer) {

  var stack = [],keys = [];

  if (cycleReplacer == null) {
    cycleReplacer = function cycleReplacer(key, value) {
      if (stack[0] === value) return '[Circular ~]';
      return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
    };
  }

  return function (key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this);
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value);
    } else stack.push(value);

    return replacer == null ? value : replacer.call(this, key, value);
  };
}