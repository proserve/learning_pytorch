'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}function _defineProperty(obj, key, value) {if (key in obj) {Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });} else {obj[key] = value;}return obj;}

var _Runtime = require('runtime.script'),_require =
require('util.values'),rNum = _require.rNum,
accessor = require('util.paths.accessor'),_require2 =
require('runtime'),triggerCustom = _require2.env.trigger;

function makeOptions(args, name) {var _ref;
  var initial = [];
  var options = {};
  for (var i = 0; i < args.length; i += 1) {
    if (typeof args[i] === 'string') {
      initial.push(args[i]);
    } else {
      options = args[i];
      break;
    }
  }
  return _ref = {}, _defineProperty(_ref, name, initial), _defineProperty(_ref, 'options', options), _ref;
}

module.exports = {

  Runtime: function (_Runtime2) {_inherits(Runtime, _Runtime2);

    function Runtime(Class, handler, params) {_classCallCheck(this, Runtime);var _makeOptions =

      makeOptions(params, 'events'),events = _makeOptions.events,options = _makeOptions.options;
      options.events = events;return _possibleConstructorReturn(this, (Runtime.__proto__ || Object.getPrototypeOf(Runtime)).call(this,

      Class, handler, options));
    }_createClass(Runtime, null, [{ key: 'trigger', value: function trigger(





      event, runtimeArguments) {
        return triggerCustom(event, runtimeArguments);
      } }, { key: '_run', value: function _run(

      registered, options) {var


        name =






        options.name,type = options.type,principal = options.principal,environment = options.environment,weight = options.weight,_options$configuratio = options.configuration,object = _options$configuratio.object,event = _options$configuratio.event,inline = _options$configuratio.inline,paths = _options$configuratio.paths,_options$metadata = options.metadata,resource = _options$metadata.resource,className = _options$metadata.className,methodName = _options$metadata.methodName,isStatic = _options$metadata.static,_options$metadata$loc = _options$metadata.loc;_options$metadata$loc = _options$metadata$loc === undefined ? {} : _options$metadata$loc;var line = _options$metadata$loc.line,column = _options$metadata$loc.column,
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


          script,context = _script.context,_script$arguments = _script.arguments,params = _script$arguments === undefined ? {} : _script$arguments,isInline = _script.inline,scriptEvent = _script.event,
          old = params.old,deprecatedNew = params.new,modified = params.modified,_params$dryRun = params.dryRun,dryRun = _params$dryRun === undefined ? false : _params$dryRun,
          methodOptions = {
            memo: accessor(script.api.memo),
            context: context,
            old: old,
            previous: old,
            body: accessor(script.api.body, { extra: script.api.body }),
            new: deprecatedNew,
            current: deprecatedNew,
            modified: modified,
            dryRun: dryRun,
            params: params,
            inline: isInline,
            event: scriptEvent,
            runtime: {
              name: name,
              type: type,
              principal: principal,
              environment: environment,
              weight: weight,
              configuration: {
                object: object, event: event, inline: inline, paths: paths },

              metadata: {
                resource: resource, className: className, methodName: methodName, static: isStatic, loc: { line: line, column: column } } } };




          return this.callHandler(Class, handler, isStatic, methodOptions);

        }

        try {
          require('logger').warn('missing trigger for "' + object + '.' + event + '" expected in ' + resource);
        } catch (err) {
        }

      } }, { key: 'runtimeType', get: function get() {return 'trigger';} }]);return Runtime;}(_Runtime) };