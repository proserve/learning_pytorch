'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}var _Runtime = require('runtime.script'),_require =
require('decorator-utils'),decorate = _require.decorate,_require2 =
require('util.values'),rNum = _require2.rNum,
accessor = require('util.paths.accessor');

module.exports = {

  Runtime: function (_Runtime2) {_inherits(Runtime, _Runtime2);

    function Runtime(Class, handler, options) {_classCallCheck(this, Runtime);return _possibleConstructorReturn(this, (Runtime.__proto__ || Object.getPrototypeOf(Runtime)).call(this,
      Class, handler, options[0]));
    }_createClass(Runtime, null, [{ key: 'createDecorator', value: function createDecorator()





      {
        var Runtime = this;
        return function () {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
          return decorate(
          function (Class, handler, descriptor, options) {

            if (descriptor && typeof descriptor.value === 'function') {
              Runtime.initialize(Class, handler, options);
            }
          },
          args);

        };
      } }, { key: '_run', value: function _run(

      registered, options) {var


        name =



        options.name,environment = options.environment,weight = options.weight,_options$metadata = options.metadata,resource = _options$metadata.resource,className = _options$metadata.className,methodName = _options$metadata.methodName,isStatic = _options$metadata.static,_options$metadata$loc = _options$metadata.loc;_options$metadata$loc = _options$metadata$loc === undefined ? {} : _options$metadata$loc;var line = _options$metadata$loc.line,column = _options$metadata$loc.column,
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

          selected,Class = _selected.Class,handler = _selected.handler,
          methodOptions = {
            runtime: {
              name: name,
              environment: environment,
              weight: weight,
              metadata: {
                resource: resource, className: className, methodName: methodName, static: isStatic, loc: { line: line, column: column } } } };





          Object.assign(methodOptions, {
            req: require('request'),
            body: accessor(script.api.body, { extra: script.api.body }),
            halt: function halt() {
              script.api.policy.halt();
              script.exit();
            } });


          return this.callHandler(Class, handler, isStatic, methodOptions);

        }

        throw Fault.create('cortex.notFound.policy', { resource: resource });

      } }, { key: 'runtimeType', get: function get() {return 'policy';} }]);return Runtime;}(_Runtime) };