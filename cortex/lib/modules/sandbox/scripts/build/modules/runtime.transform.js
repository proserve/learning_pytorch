'use strict';var _get = function get(object, property, receiver) {if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {var parent = Object.getPrototypeOf(object);if (parent === null) {return undefined;} else {return get(parent, property, receiver);}} else if ("value" in desc) {return desc.value;} else {var getter = desc.get;if (getter === undefined) {return undefined;}return getter.call(receiver);}};var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _require =

require('util.values'),rNum = _require.rNum,rInt = _require.rInt,rBool = _require.rBool,clamp = _require.clamp,isSet = _require.isSet,isFunction = _require.isFunction,_require2 =
require('util.cursor'),WritableBufferedApiCursor = _require2.WritableBufferedApiCursor,_require3 =
require('decorator-utils'),decorate = _require3.decorate,
max = Math.max,
Runtime = require('runtime.script'),
accessor = require('util.paths.accessor'),
Handlers = ['error', 'result', 'beforeAll', 'before', 'each', 'after', 'afterAll'],
Properties = {
  opsThreshold: {
    defaultValue: 0.8,
    symbol: Symbol('Transform.opsThreshold') },

  msThreshold: {
    defaultValue: 0.8,
    symbol: Symbol('Transform.msThreshold') },

  minMs: {
    defaultValue: 0,
    symbol: Symbol('Transform.minMs') },

  minOps: {
    defaultValue: 0,
    symbol: Symbol('Transform.minOps') },

  useMemoApi: {
    defaultValue: false,
    symbol: Symbol('Transform.useMemoApi') } },


PropertyValues = Object.values(Properties);

Object.freeze(Handlers);

var Undefined = void 0;var

Transform = function () {

  function Transform(options, runtime) {_classCallCheck(this, Transform);var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {

      for (var _iterator = PropertyValues[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var property = _step.value;
        this[property.symbol] = property.defaultValue;
      }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
    if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
        for (var _iterator2 = Object.keys(options)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var option = _step2.value;
          var Prop = Properties[option];
          if (isSet(Prop)) {
            this[option] = options[option];
          } else if (Handlers.includes(option) && isFunction(options[option])) {
            this[option] = options[option];
          }
        }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
    }

  }_createClass(Transform, [{ key: 'opsThreshold', get: function get()

    {
      return this[Properties.opsThreshold.symbol];
    }, set: function set(

















    value) {
      this[Properties.opsThreshold.symbol] = clamp(rNum(value, Properties.opsThreshold.defaultValue), 0.0, 1.0);
    } }, { key: 'msThreshold', get: function get() {return this[Properties.msThreshold.symbol];}, set: function set(

    value) {
      this[Properties.msThreshold.symbol] = clamp(rNum(value, Properties.msThreshold.defaultValue), 0.0, 1.0);
    } }, { key: 'minMs', get: function get() {return this[Properties.minMs.symbol];}, set: function set(

    value) {
      this[Properties.minMs.symbol] = max(0, rInt(value, Properties.minMs.defaultValue));
    } }, { key: 'minOps', get: function get() {return this[Properties.minOps.symbol];}, set: function set(

    value) {
      this[Properties.minOps.symbol] = max(0, rInt(value, Properties.minOps.defaultValue));
    } }, { key: 'useMemoApi', get: function get() {return this[Properties.useMemoApi.symbol];}, set: function set(

    value) {
      this[Properties.useMemoApi.symbol] = rBool(value, Properties.useMemoApi.defaultValue);
    } }], [{ key: 'create', value: function create(





    options, runtime) {

      if (options instanceof Transform) {
        return options;
      }

      var Class = Transform;
      if (options === Transform || options && options.prototype instanceof Transform) {
        Class = options;
        options = Undefined;
      } else if (typeof options === 'function') {
        Class = options;
        return new Class(runtime);
      }
      return new Class(options, runtime);

    } }, { key: 'Handlers', get: function get() {return Handlers;} }]);return Transform;}();



function hasHandler(instance, name) {
  return isFunction(instance[name]);
}

function runHandler(instance, name) {
  if (isFunction(instance[name])) {for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {args[_key - 2] = arguments[_key];}
    return instance[name].apply(instance, args);
  }
  return Undefined;
}

function getProperty(instance, name) {
  var prop = Properties[name];
  if (instance instanceof Transform) {
    return instance[prop.symbol];
  }
  return prop.defaultValue;
}var

Runner = function () {function Runner() {_classCallCheck(this, Runner);}_createClass(Runner, null, [{ key: 'run', value: function run(

    instance) {var _script =

      script,context = _script.context,api = _script.api,_ref =
      context || {},kind = _ref.kind;

      if (context.err) {
        var err = Fault.from(context.err, true);
        runHandler(instance, 'error', err, { context: context });
        return;
      }

      switch (kind) {

        case 'result':{var

            getResult = context.getResult,setResult = context.setResult;

            if (hasHandler(instance, 'result')) {
              var result = runHandler(
              instance, 'result', getResult(), { context: context });

              if (result !== Undefined) {
                setResult(result);
              }
            }
            break;
          }

        case 'cursor':{var


            runtimeApi =



            api.runtime,memoApi = api.memo,cursorApi = api.cursor,bodyApi = api.body,_script2 =





            script,getOpsUsed = _script2.getOpsUsed,getOpsRemaining = _script2.getOpsRemaining,getTimeLeft = _script2.getTimeLeft,getElapsedTime = _script2.getElapsedTime,
            cursor = new WritableBufferedApiCursor(
            new ObjectID(),
            function () {return {};},
            { shared: true, provider: cursorApi }),

            body = accessor(bodyApi, { extra: bodyApi }),
            opsThreshold = getOpsRemaining() * getProperty(instance, 'opsThreshold'),
            msThreshold = getTimeLeft() * getProperty(instance, 'msThreshold'),
            minMs = getProperty(instance, 'minMs'),
            minOps = getProperty(instance, 'minOps'),
            useMemoApi = getProperty(instance, 'useMemoApi'),
            isOverThreshold = function isOverThreshold() {return (
                getOpsUsed() > opsThreshold ||
                getElapsedTime() > msThreshold ||
                getTimeLeft() < minMs ||
                getOpsRemaining() < minOps);},
            willExit = function willExit() {return script.exited || isOverThreshold();};

            if (!runtimeApi.ended) {

              var memo = useMemoApi ? memoApi : memoApi.get();

              var count = 0;

              script.on('exit', function () {
                if (!useMemoApi) {
                  memoApi.set(null, memo);
                }
              });

              if (runtimeApi.count === 1) {
                runHandler(instance, 'beforeAll', memo, { cursor: cursor, body: body, context: context });
                if (willExit()) {
                  return;
                }
              }

              runHandler(instance, 'before', memo, { cursor: cursor, body: body, context: context });

              if (!willExit() && !runtimeApi.ending) {

                var hasEach = hasHandler(instance, 'each');

                if (!hasEach) {
                  var hasNext = cursor.hasNext();
                  while (hasNext) {var _cursorApi$passthru =
                    cursorApi.passthru({ count: 1 }),resultHasNext = _cursorApi$passthru.hasNext,pushedCount = _cursorApi$passthru.count;
                    count += pushedCount;
                    hasNext = resultHasNext;
                    if (willExit()) {
                      break;
                    }
                  }
                } else {var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {
                    for (var _iterator3 = cursor[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var object = _step3.value;
                      object = runHandler(instance, 'each', object, memo, { cursor: cursor, body: body, context: context });
                      if (object !== Undefined) {
                        cursor.push(object);
                        count += 1;
                      }
                      if (willExit() || !cursor.hasNext()) {
                        break;
                      }
                    }} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3.return) {_iterator3.return();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}
                }

              }

              runHandler(instance, 'after', memo, { cursor: cursor, body: body, count: count, context: context });
              if (willExit()) {
                return;
              }

              if (!cursor.hasNext() || runtimeApi.ending) {
                runtimeApi.setEnded();
                runHandler(instance, 'afterAll', memo, { cursor: cursor, body: body, context: context });
              }

            }

            break;
          }}


      return null;

    } }]);return Runner;}();var



TransformRuntime = function (_Runtime) {_inherits(TransformRuntime, _Runtime);

  function TransformRuntime(Class, handler, params) {_classCallCheck(this, TransformRuntime);

    var options = void 0;

    if (typeof params[0] === 'string') {
      var name = params[0];
      options = Object.assign(params[1] || {}, { name: name });
    } else {
      options = params[0];
    }return _possibleConstructorReturn(this, (TransformRuntime.__proto__ || Object.getPrototypeOf(TransformRuntime)).call(this,

    Class, handler, options));
  }_createClass(TransformRuntime, null, [{ key: 'createDecorator', value: function createDecorator()





    {
      var Runtime = this;
      return function () {for (var _len2 = arguments.length, options = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {options[_key2] = arguments[_key2];}
        var Class = options[0];
        if (Class && options.length === 1 && isFunction(Class)) {
          Runtime.initialize(Class, null, []);
        } else {
          return decorate(
          function (Class, args, descriptor) {
            if (descriptor && typeof descriptor.value === 'function') {
              throw new TypeError('@' + Runtime.runtimeType + ' can only be used on class declarations');
            }
            Runtime.initialize(Class, null, options);
          },
          options);

        }
      };
    } }, { key: 'run', value: function run(

    require, exports, module, main, options) {

      if (options && options.metadata && options.metadata.adhoc) {

        main(require, module.exports, module);

        var Class = module.exports,
        instance = new Class();

        return Runner.run(instance, options);
      }

      return _get(TransformRuntime.__proto__ || Object.getPrototypeOf(TransformRuntime), 'run', this).call(this, require, exports, module, main, options);

    } }, { key: '_run', value: function _run(

    registered, options) {var


      name =



      options.name,environment = options.environment,weight = options.weight,_options$metadata = options.metadata,resource = _options$metadata.resource,className = _options$metadata.className,_options$metadata$loc = _options$metadata.loc;_options$metadata$loc = _options$metadata$loc === undefined ? {} : _options$metadata$loc;var line = _options$metadata$loc.line,column = _options$metadata$loc.column,scriptExport = _options$metadata.scriptExport,
      optionsSignature = className + '.' + name + '.' + rNum(weight, 0);

      var selected = void 0;var _iteratorNormalCompletion4 = true;var _didIteratorError4 = false;var _iteratorError4 = undefined;try {

        for (var _iterator4 = registered[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {var candidate = _step4.value;var

          Class = candidate.Class,_options = candidate.options,
          signature = Class.name + '.' + (_options.name || scriptExport) + '.' + rNum(_options.weight, 0);

          if (optionsSignature === signature) {
            selected = candidate;
            break;
          }
        }} catch (err) {_didIteratorError4 = true;_iteratorError4 = err;} finally {try {if (!_iteratorNormalCompletion4 && _iterator4.return) {_iterator4.return();}} finally {if (_didIteratorError4) {throw _iteratorError4;}}}

      if (selected) {var _selected =
        selected,Class = _selected.Class,
        transformOptions = {
          runtime: {
            name: name,
            environment: environment,
            weight: weight,
            metadata: {
              resource: resource, className: className, loc: { line: line, column: column } } } };




        return Runner.run(
        Transform.create(Class, transformOptions));


      }

      throw Fault.create('cortex.notFound.script', { reason: 'Missing transform.', resource: resource });

    } }, { key: 'runtimeType', get: function get() {return 'transform';} }]);return TransformRuntime;}(Runtime);



module.exports = {

  Transform: Transform,
  Runtime: TransformRuntime,
  Runner: Runner };