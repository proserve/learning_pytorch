'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}

var pPrivates = Symbol('objectPrivates'),
runtimes = new Map(),
objects = {},_require =


require('util.values'),rNum = _require.rNum,toArray = _require.array,rBool = _require.rBool,rString = _require.rString,matchesEnvironment = _require.matchesEnvironment,_require2 =
require('util.id'),equalIds = _require2.equalIds,_require3 =
require('inflection'),singularize = _require3.singularize;

module.exports = {

  Runtime: function () {

    function ObjectRuntime(objectClass, objectName, options) {_classCallCheck(this, ObjectRuntime);

      CortexObject.forgetObject(objectName);

      options = options || {};

      this[pPrivates] = {
        objectClass: objectClass,
        objectName: String(singularize(objectName)).toLowerCase().trim(),
        environment: rString(options.environment, '*'),
        active: rBool(options.active, true),
        weight: rNum(options.weight, 0) };


    }_createClass(ObjectRuntime, [{ key: 'objectClass', get: function get()

      {
        return this[pPrivates].objectClass;
      } }, { key: 'objectName', get: function get()

      {
        return this[pPrivates].objectName;
      } }, { key: 'objectWeight', get: function get()

      {
        return this[pPrivates].weight;
      } }, { key: 'objectActive', get: function get()

      {
        return this[pPrivates].active;
      } }, { key: 'objectEnvironment', get: function get()

      {
        return this[pPrivates].environment;
      } }, { key: 'isAvailable', get: function get()

      {var _pPrivates =
        this[pPrivates],active = _pPrivates.active,environment = _pPrivates.environment;
        return !!(active && matchesEnvironment(environment));
      } }], [{ key: 'getObjectClass', value: function getObjectClass(

      name) {var _ref =

        global && global.env,_ref$runtime = _ref.runtime,runtime = _ref$runtime === undefined ? {} : _ref$runtime,
        runtimeObject = toArray(runtime.objects).find(function (v) {return v.name === name;}),_ref2 =




        runtimeObject || {},_ref2$metadata = _ref2.metadata;_ref2$metadata = _ref2$metadata === undefined ? {} : _ref2$metadata;var resource = _ref2$metadata.resource,scriptExport = _ref2$metadata.scriptExport,className = _ref2$metadata.className,_ref2$metadata$loc = _ref2$metadata.loc;_ref2$metadata$loc = _ref2$metadata$loc === undefined ? {} : _ref2$metadata$loc;var _ref2$metadata$loc$li = _ref2$metadata$loc.line,line = _ref2$metadata$loc$li === undefined ? '?' : _ref2$metadata$loc$li,_ref2$metadata$loc$co = _ref2$metadata$loc.column,column = _ref2$metadata$loc$co === undefined ? '?' : _ref2$metadata$loc$co,weight = _ref2.weight;

        var Candidate = void 0,
        RuntimeCandidate = void 0;


        if (equalIds(script._id, consts.emptyId)) {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
            for (var _iterator = runtimes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _runtime = _step.value;var
              objectName = _runtime.objectName,objectWeight = _runtime.objectWeight;
              if (objectName === name) {
                if (!RuntimeCandidate || objectWeight > RuntimeCandidate.objectWeight) {
                  RuntimeCandidate = _runtime;
                }
              }
            }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
        }


        if (runtimeObject) {
          try {
            require(scriptExport);
          } catch (err) {
            try {
              err.resource = resource;
            } catch (e) {
              void e;
            }
            throw err;
          }var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
            for (var _iterator2 = runtimes.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var _runtime2 = _step2.value;var
              objectClass = _runtime2.objectClass,_objectName = _runtime2.objectName,_objectWeight = _runtime2.objectWeight;
              if (!Candidate && _objectName === name && _objectWeight === weight && className === objectClass.name) {
                Candidate = _runtime2;
              }
            }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}

        }

        if (RuntimeCandidate) {
          if (!Candidate || RuntimeCandidate.objectWeight > Candidate.objectWeight) {
            Candidate = RuntimeCandidate;
          }
        }

        if (Candidate) {
          if (!(Candidate.objectClass.prototype instanceof CortexObject)) {
            throw Fault.create('script.invalidArgument.unspecified', { reason: 'Class "' + className + '" in script.export(' + scriptExport + ').@object ' + line + ':' + column + ' must extend CortexObject' });
          } else {
            cortexify(Candidate.objectClass);
            objects[name] = Candidate.objectClass;
          }

        }

        return Candidate && Candidate.objectClass;

      } }, { key: 'initialize', value: function initialize(

      Class, name, options) {

        if (!runtimes.has(Class)) {

          var runtime = new ObjectRuntime(Class, name, options);

          if (runtime.isAvailable) {
            runtimes.set(
            Class, runtime);


            try {var
              objectClass = runtime.objectClass,objectName = runtime.objectName;
              Object.defineProperty(
              objectClass,
              'objectName',
              {
                value: objectName,
                enumerable: true,
                configurable: false });


            } catch (err) {
              throw err;
            }
          }
        }

      } }]);return ObjectRuntime;}() };