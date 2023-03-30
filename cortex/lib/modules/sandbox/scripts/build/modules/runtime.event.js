'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}var _Runtime = require('runtime.script'),_require =
require('util.values'),rNum = _require.rNum,_require2 =
require('runtime'),loadRuntimeListeners = _require2.env.events.load;

module.exports = {

  Runtime: function (_Runtime2) {_inherits(Runtime, _Runtime2);

    function Runtime(Class, handler, params) {_classCallCheck(this, Runtime);

      var options = void 0;

      if (typeof params[0] === 'string') {
        var event = params[0];
        options = Object.assign(params[1] || {}, { event: event });
      } else {
        options = params[0];
      }return _possibleConstructorReturn(this, (Runtime.__proto__ || Object.getPrototypeOf(Runtime)).call(this,

      Class, handler, options));
    }_createClass(Runtime, null, [{ key: 'fire', value: function fire()





      {var _this2 = this;var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},source = _ref.source,event = _ref.event,params = _ref.params;

        var listeners = loadRuntimeListeners(event);

        listeners.forEach(function (listener) {

          var module = { exports: {} };
          _this2.run(
          require,
          module.exports,
          module,
          function () {return require(listener.metadata.scriptExport);}, _extends({},
          listener, { source: source, event: event, params: params }));



        });

      } }, { key: 'callHandler', value: function callHandler(

      Class, handler, isStatic, params, info) {

        if (isStatic) {
          return Class[handler].apply(Class, _toConsumableArray(params).concat([info]));
        }

        var Constructor = Class.constructor,
        instance = new Constructor();

        return instance[handler].apply(instance, _toConsumableArray(params).concat([info]));

      } }, { key: '_run', value: function _run(

      registered, options) {var


        weight =




        options.weight,metadata = options.metadata,params = options.params,source = options.source,event = options.event,_script =


        script,context = _script.context,

        className =
        metadata.className,methodName = metadata.methodName,isStatic = metadata.static,
        optionsSignature = className + '.' + methodName + '.' + rNum(weight, 0);

        var selected = void 0;var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {

          for (var _iterator = registered[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var candidate = _step.value;var

            Class = candidate.Class,handler = candidate.handler,_options = candidate.options,
            signature = (isStatic ? Class.name : Class.constructor.name) + '.' + handler + '.' + rNum(_options.weight, 0);

            if (optionsSignature === signature) {
              selected = candidate;
              break;
            }
          }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}

        if (selected) {var _selected =

          selected,Class = _selected.Class,handler = _selected.handler;
          return this.callHandler(Class, handler, isStatic, params, { weight: weight, source: source, metadata: metadata, event: event, context: context });

        }

      } }, { key: 'runtimeType', get: function get() {return 'event';} }]);return Runtime;}(_Runtime) };