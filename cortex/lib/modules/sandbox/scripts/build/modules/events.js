'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var pEvents = Symbol('events');var

Emitter = exports.Emitter = function () {function Emitter() {_classCallCheck(this, Emitter);}_createClass(Emitter, [{ key: 'on', value: function on(

    name, fn) {
      if (!this[pEvents]) {
        this[pEvents] = {};
      }
      if (!this[pEvents][name]) {
        this[pEvents][name] = fn;
      } else if (Array.isArray(this[pEvents][name])) {
        this[pEvents][name].push(fn);
      } else {
        this[pEvents][name] = [this[pEvents][name], fn];
      }
      return this;
    } }, { key: 'once', value: function once(

    name, fn) {
      var self = this;
      this.on(name, function () {
        self.removeListener(name, fn);
        fn.apply(this, arguments);
      });
      return this;
    } }, { key: 'addListener', value: function addListener()

    {
      return this.on.apply(this, arguments);
    } }, { key: 'removeListener', value: function removeListener(

    name, fn) {
      if (this[pEvents] && this[pEvents][name]) {
        var list = this[pEvents][name];
        if (Array.isArray(list)) {
          var pos = -1;
          for (var i = 0, l = list.length; i < l; i++) {
            if (list[i] === fn) {
              pos = i;
              break;
            }
          }
          if (pos < 0) {
            return this;
          }
          list.splice(pos, 1);
          if (!list.length) {
            delete this[pEvents][name];
          }
        } else if (list === fn) {
          delete this[pEvents][name];
        }
      }
      return this;
    } }, { key: 'removeAllListeners', value: function removeAllListeners(

    name) {
      if (name === undefined) {
        this[pEvents] = {};
        return this;
      }
      if (this[pEvents] && this[pEvents][name]) {
        this[pEvents][name] = null;
      }
      return this;
    } }, { key: 'listeners', value: function listeners(

    name) {
      if (!this[pEvents]) {
        this[pEvents] = {};
      }
      if (!this[pEvents][name]) {
        this[pEvents][name] = [];
      }
      if (!Array.isArray(this[pEvents][name])) {
        this[pEvents][name] = [this[pEvents][name]];
      }
      return this[pEvents][name].slice();
    } }, { key: 'emit', value: function emit(

    name) {
      if (!this[pEvents]) {
        return false;
      }
      var handler = this[pEvents][name];
      if (!handler) {
        return false;
      }for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {args[_key - 1] = arguments[_key];}
      if (typeof handler === 'function') {
        handler.apply(this, args);
      } else if (Array.isArray(handler)) {
        var listeners = handler.slice();
        for (var i = 0, l = listeners.length; i < l; i++) {
          listeners[i].apply(this, args);
        }
      } else {
        return false;
      }
      return true;
    } }]);return Emitter;}();