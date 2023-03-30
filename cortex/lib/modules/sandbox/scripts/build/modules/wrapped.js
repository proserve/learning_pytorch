'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};try {
  require('logger').warn('The wrapped module is deprecated.');
} catch (err) {
}

var objects = require('objects'),
clone = require('clone');

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

module.exports = function Wrapped(pluralName, defaultOptions) {

  if (!(this instanceof Wrapped)) {
    return new Wrapped(pluralName, defaultOptions);
  }

  defaultOptions = clone(defaultOptions || {});


  Object.defineProperties(this, {

    findOne: {
      value: function value(id, options) {
        return objects.read(pluralName, id, extend({}, defaultOptions, options));
      } },


    find: {
      value: function value(options) {
        return objects.list(pluralName, extend({}, defaultOptions, options));
      } },


    insertOne: {
      value: function value(doc, options) {
        return objects.create(pluralName, doc, extend({}, defaultOptions, options));
      } },


    removeOne: {
      value: function value(_id, options) {
        return objects.delete(pluralName, _id, extend({}, defaultOptions, options));
      } },


    count: {
      value: function value(where, options) {
        return objects.count(pluralName, where, extend({}, defaultOptions, options));
      } },


    query: {
      value: function value() {
        throw new Error('not implemented');
      } },


    pipeline: {
      value: function value(options) {
        return require('pipeline')(pluralName, extend({}, defaultOptions, options));
      } },


    cursor: {
      value: function value(options) {
        return require('cursor')(pluralName, extend({}, defaultOptions, options));
      } } });




};