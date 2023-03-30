'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}var _require =

require('events'),Emitter = _require.Emitter,_require2 =
require('objects'),insertOne = _require2.driver.insertOne,
extend = require('util.deep-extend'),_require3 =
require('util.cursor'),Cursor = _require3.Cursor,ApiCursor = _require3.ApiCursor,BufferedApiCursor = _require3.BufferedApiCursor,_require4 =
require('stream'),OpaqueStream = _require4.OpaqueStream,_require5 =
require('util.values'),isFunction = _require5.isFunction,_require6 =
require('runtime.event'),EventRuntime = _require6.Runtime,_require7 =
require('runtime.trigger'),TriggerRuntime = _require7.Runtime;

var native = module.exports,
pExited = Symbol('exited'),
pResult = Symbol('result'),
script = void 0,
Undefined = void 0;var

Script = function (_Emitter) {_inherits(Script, _Emitter);

  function Script() {_classCallCheck(this, Script);var _this = _possibleConstructorReturn(this, (Script.__proto__ || Object.getPrototypeOf(Script)).call(this));

    _this[pExited] = false;
    _this[pResult] = Undefined;return _this;
  }_createClass(Script, [{ key: 'exit', value: function exit()

    {var result = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Undefined;
      if (!this[pExited]) {
        this[pExited] = true;
        this[pResult] = result;
        this.emit('exit', result);
        result = this[pResult];
        if (result && result instanceof Cursor) {
          if (result instanceof BufferedApiCursor) {
            result.shared();
          }
          result = result.passthru(false);
        } else if (result && result instanceof OpaqueStream) {
          result = result.getOptions();
        }
        this.__exit(result);
      }
    } }, { key: 'as', value: function as(

    principal, options, handler) {

      if (isFunction(options)) {
        handler = options;
        options = null;
      }

      var result = this.__as(principal, options, handler);

      if (result && !(result instanceof Cursor) && result._id) {
        if (result.object === 'stream') {
          result = new OpaqueStream(result);
        } else if (result.object === 'cursor') {
          result = new ApiCursor(result);
        }
      }

      if (result instanceof Cursor) {
        result = this.__as(principal, options, function () {
          if (result instanceof BufferedApiCursor) {
            result.shared();
          }
          return result.passthru(false);
        });
      }

      return result;

    } }, { key: 'fire', value: function fire(













    event) {for (var _len = arguments.length, params = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {params[_key - 1] = arguments[_key];}

      EventRuntime.fire({ source: 'script', event: event, params: params });

    } }, { key: 'trigger', value: function trigger()

    {

      TriggerRuntime.trigger.apply(TriggerRuntime, arguments);

    } }, { key: 'exited', get: function get() {return this[pExited];} }, { key: 'result', get: function get() {return this[pResult];}, set: function set(result) {this[pResult] = result;} }]);return Script;}(Emitter);



script = new Script();

script.fire.async = function (event) {for (var _len2 = arguments.length, params = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {params[_key2 - 1] = arguments[_key2];}

  return insertOne('event', {
    object: 'event',
    document: {
      type: 'script',
      event: event,
      principal: script.principal._id,
      param: params },

    skipAcl: true,
    bypassCreateAcl: true,
    grant: 'update' });


};

module.exports = extend(script, native, global.env.script);

if (_typeof(script.principal) === 'object' && script.principal.object === 'account') {
  script.principal = CortexObject.from(script.principal);
}

if (_typeof(script.org) === 'object' && script.org.object === 'org') {
  script.org = CortexObject.from(script.org);
}


script.__post = function () {


  var contextApi = this.api && this.api.context;

  if (contextApi) {

    var context = this.context || (this.context = {});
    Object.assign(context, contextApi);

    if (this.type === 'trigger' && this.inline && this.arguments.new) {
      Object.assign(this.arguments.new, contextApi);
    }
  }

};