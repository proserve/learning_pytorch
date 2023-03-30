'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};

/*
                                                                                                                                                                                                                                                                                       * @author Viacheslav Lotsmanov <lotsmanov89@gmail.com>
                                                                                                                                                                                                                                                                                       * @license MIT
                                                                                                                                                                                                                                                                                       *
                                                                                                                                                                                                                                                                                       * The MIT License (MIT)
                                                                                                                                                                                                                                                                                       *
                                                                                                                                                                                                                                                                                       * Copyright (c) 2013-2015 Viacheslav Lotsmanov
                                                                                                                                                                                                                                                                                       */

function isSpecificValue(val) {
  return !!(
  val instanceof Buffer ||
  val instanceof Date ||
  val instanceof RegExp ||
  val instanceof ObjectID);

}

function cloneSpecificValue(val) {
  if (val instanceof Buffer) {
    var x = new Buffer(val.length);
    val.copy(x);
    return x;
  }if (val instanceof Date) {
    return new Date(val.getTime());
  }if (val instanceof RegExp) {
    return new RegExp(val);
  }if (val instanceof ObjectID) {
    return new ObjectID(val.toString());
  }
  throw new Error('Unexpected situation');

}




function deepCloneArray(arr) {
  var clone = [];
  arr.forEach(function (item, index) {
    if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object' && item !== null) {
      if (Array.isArray(item)) {
        clone[index] = deepCloneArray(item);
      } else if (isSpecificValue(item)) {
        clone[index] = cloneSpecificValue(item);
      } else {
        clone[index] = deepExtend({}, item);
      }
    } else {
      clone[index] = item;
    }
  });
  return clone;
}










var deepExtend = module.exports = function () {
  if (arguments.length < 1 || _typeof(arguments[0]) !== 'object') {
    return false;
  }

  if (arguments.length < 2) {
    return arguments[0];
  }

  var target = arguments[0],

  args = Array.prototype.slice.call(arguments, 1),
  val = void 0,
  src = void 0;

  args.forEach(function (obj) {

    if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || obj === null || Array.isArray(obj)) {
      return;
    }

    Object.keys(obj).forEach(function (key) {
      src = target[key];
      val = obj[key];


      if (val === target) {





      } else if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) !== 'object' || val === null) {
        target[key] = val;


      } else if (Array.isArray(val)) {
        target[key] = deepCloneArray(val);


      } else if (isSpecificValue(val)) {
        target[key] = cloneSpecificValue(val);


      } else if ((typeof src === 'undefined' ? 'undefined' : _typeof(src)) !== 'object' || src === null || Array.isArray(src)) {
        target[key] = deepExtend({}, val);


      } else {
        target[key] = deepExtend(src, val);

      }
    });
  });

  return target;
};