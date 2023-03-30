'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _require = require('decorator-utils'),decorate = _require.decorate,
privates = Symbol('privates'),
registeredTypes = {},_require2 =
require('util.values'),matchesEnvironment = _require2.matchesEnvironment,rBool = _require2.rBool;

module.exports = function () {

  function Runtime(Class, handler, options) {_classCallCheck(this, Runtime);

    options = options || {};

    this[privates] = {
      Class: Class,
      handler: handler,
      options: options,
      available: !!(rBool(options.active, true) && matchesEnvironment(options.environment)) };


  }_createClass(Runtime, [{ key: 'Class', get: function get()

    {
      return this[privates].Class;
    } }, { key: 'handler', get: function get()

    {
      return this[privates].handler;
    } }, { key: 'options', get: function get()

    {
      return this[privates].options;
    } }, { key: 'runtimeType', get: function get()

    {
      return this.constructor.runtimeType;
    } }, { key: 'isAvailable', get: function get()

    {
      return this[privates].available;
    } }], [{ key: 'createDecorator', value: function createDecorator()





    {
      var Runtime = this;
      return function () {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
        return decorate(
        function (Class, handler, descriptor, options) {
          if (!(descriptor && typeof descriptor.value === 'function')) {
            throw new TypeError('@' + Runtime.runtimeType + ' can only be used on class methods');
          }
          Runtime.initialize(Class, handler, options);
        },
        args);

      };
    } }, { key: 'callHandler', value: function callHandler(

    Class, handler, isStatic, methodOptions) {

      if (isStatic) {
        return Class[handler](methodOptions);
      }

      var Constructor = Class.constructor,
      instance = new Constructor();

      return instance[handler](methodOptions);

    } }, { key: 'initialize', value: function initialize(

    Class, handler, options) {

      var Runtime = this,
      runtimeType = Runtime.runtimeType,
      registeredType = registeredTypes[runtimeType] || (registeredTypes[runtimeType] = []),
      runtime = new Runtime(Class, handler, options);

      if (runtime.isAvailable) {
        registeredType.push(runtime);
      }

    } }, { key: 'run', value: function run(

    require, exports, module, main, options) {


      main(require, exports, module);

      var Runtime = this,
      runtimeType = Runtime.runtimeType,
      registeredType = registeredTypes[runtimeType] || [];

      return Runtime._run(registeredType, options);

    } }, { key: 'runtimeType', get: function get() {return '';} }]);return Runtime;}();