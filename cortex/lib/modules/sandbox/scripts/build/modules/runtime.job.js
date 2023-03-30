'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}var _Runtime = require('runtime.script'),_require =
require('util.values'),rNum = _require.rNum;

module.exports = {

  Runtime: function (_Runtime2) {_inherits(Runtime, _Runtime2);

    function Runtime(Class, handler, params) {_classCallCheck(this, Runtime);

      var options = void 0;

      if (typeof params[0] === 'string') {
        if (typeof params[1] === 'string') {
          options = Object.assign(params[2] || {}, { cron: params[0], principal: params[1] });
        } else {
          options = Object.assign(params[1] || {}, { cron: params[0] });
        }
      } else {var _params = _slicedToArray(
        params, 1);options = _params[0];
      }return _possibleConstructorReturn(this, (Runtime.__proto__ || Object.getPrototypeOf(Runtime)).call(this,

      Class, handler, options));
    }_createClass(Runtime, null, [{ key: '_run', value: function _run(





      registered, options) {var


        name =






        options.name,type = options.type,principal = options.principal,environment = options.environment,weight = options.weight,cron = options.configuration.cron,_options$metadata = options.metadata,resource = _options$metadata.resource,className = _options$metadata.className,methodName = _options$metadata.methodName,isStatic = _options$metadata.static,_options$metadata$loc = _options$metadata.loc;_options$metadata$loc = _options$metadata$loc === undefined ? {} : _options$metadata$loc;var line = _options$metadata$loc.line,column = _options$metadata$loc.column,
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

          selected,Class = _selected.Class,handler = _selected.handler,_script =


          script,context = _script.context,
          methodOptions = {
            context: context,
            runtime: {
              name: name,
              type: type,
              principal: principal,
              environment: environment,
              weight: weight,
              configuration: {
                cron: cron },

              metadata: {
                resource: resource, className: className, methodName: methodName, static: isStatic, loc: { line: line, column: column } } } };




          return this.callHandler(Class, handler, isStatic, methodOptions);

        }

        try {
          require('logger').warn('missing job expected in ' + resource);
        } catch (err) {
        }
      } }, { key: 'runtimeType', get: function get() {return 'job';} }]);return Runtime;}(_Runtime) };