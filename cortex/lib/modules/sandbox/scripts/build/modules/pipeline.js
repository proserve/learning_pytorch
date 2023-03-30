'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};try {
  require('logger').warn('The pipeline module is deprecated.');
} catch (err) {
}

var clone = require('clone');

function extend(target) {
  target = target || {};
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    if ((typeof source === 'undefined' ? 'undefined' : _typeof(source)) === 'object') {
      for (var prop in source) {
        if (typeof source.hasOwnProperty === 'function' && source.hasOwnProperty(prop)) {
          target[prop] = source[prop];
        }
      }
    }
  }
  return target;
}

function getPath(obj, path) {
  if (obj == null) return undefined;
  if (!path || !(typeof path === 'string')) return undefined;
  var p = path.split('.'),
  i = void 0,
  j = void 0;
  for (i = 0, j = p.length; i < j; i++) {
    if (obj != null) {
      obj = obj[p[i]];
    }
  }
  return obj;
}

module.exports = function Pipeline(pluralName, defaultOptions) {

  if (!(this instanceof Pipeline)) {
    return new Pipeline(pluralName, defaultOptions);
  }

  var pipeline = [],
  single = false,
  path = null;

  defaultOptions = clone(defaultOptions);


  Object.defineProperties(this, {

    match: { value: function value(v) {pipeline.push({ $match: v });return this;} },
    unwind: { value: function value(v) {pipeline.push({ $unwind: v });return this;} },
    group: { value: function value(v) {pipeline.push({ $group: v });return this;} },
    limit: { value: function value(v) {pipeline.push({ $limit: v });return this;} },
    skip: { value: function value(v) {pipeline.push({ $skip: v });return this;} },
    project: { value: function value(v) {pipeline.push({ $project: v });return this;} },
    sort: { value: function value(v) {pipeline.push({ $sort: v });return this;} },

    single: { value: function value() {single = true;defaultOptions.limit = 1;return this;} },
    path: { value: function value(p) {path = String(p);return this.single();} },

    cursor: {
      value: function value(options) {
        if (single || path) {
          throw new Error('single() and path() and incompatible with cursor()');
        }
        return require('cursor')(pluralName, extend({}, defaultOptions, options, { pipeline: pipeline }));
      } },


    exec: {
      value: function value(options) {
        var result = require('objects').list(pluralName, extend({}, defaultOptions, options, { pipeline: pipeline }));
        if (single) {
          result = result && result.data ? result.data[0] : undefined;
          if (path) {
            return getPath(result, path);
          }
        }
        return result;
      } } });




};