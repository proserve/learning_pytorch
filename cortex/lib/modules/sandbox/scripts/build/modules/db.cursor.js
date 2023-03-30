'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.AggregationCursor = exports.QueryCursor = undefined;var _get = function get(object, property, receiver) {if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {var parent = Object.getPrototypeOf(object);if (parent === null) {return undefined;} else {return get(parent, property, receiver);}} else if ("value" in desc) {return desc.value;} else {var getter = desc.get;if (getter === undefined) {return undefined;}return getter.call(receiver);}};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();
var _util = require('util.values');
var _util2 = require('util.cursor');
var _db = require('db.util');
var _objects = require('objects');var _objects2 = _interopRequireDefault(_objects);
var _db2 = require('db.factory');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _defineProperty(obj, key, value) {if (key in obj) {Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });} else {obj[key] = value;}return obj;}function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}



var pName = Symbol('name'),
pEngine = Symbol('engine'),
pMaxTimeMs = Symbol('max_time_ms'),
pSkipAcl = Symbol('skip_acl'),
pGrant = Symbol('grant'),
pRoles = Symbol('roles'),
pPrefix = Symbol('prefix'),
pAccess = Symbol('access'),
pCrossOrg = Symbol('crossOrg'),
pStrict = Symbol('strict'),
pLocale = Symbol('locale'),
pTransform = Symbol('transform'),
pUnindexed = Symbol('indexed'),
fOptions = Symbol('options'),
pMatch = Symbol('match'),
pSort = Symbol('sort'),
pSkip = Symbol('skip'),
pLimit = Symbol('limit'),
pPaths = Symbol('paths'),
pInclude = Symbol('include'),
pExpand = Symbol('expand'),
pPassive = Symbol('passive'),
pThrough = Symbol('through'),
fAdd = Symbol('add'),
pPipeline = Symbol('pipeline'),
pNativePipeline = Symbol('nativePipeline'),
pExpressionPipeline = Symbol('expressionPipeline');

var Undefined = void 0;var

Cursor = function (_BufferedApiCursor) {_inherits(Cursor, _BufferedApiCursor);

  function Cursor(name) {_classCallCheck(this, Cursor);

    var execute = function execute() {

      return _objects2.default.driver.cursor(
      this[pName],
      this[fOptions]());

    };var _this = _possibleConstructorReturn(this, (Cursor.__proto__ || Object.getPrototypeOf(Cursor)).call(this,
    null, execute, { shared: false }));

    _this[pName] = name;
    _this[pMaxTimeMs] = script.config.query.defaultMaxTimeMS;
    _this[pSkipAcl] = null;
    _this[pGrant] = null;
    _this[pRoles] = null;
    _this[pAccess] = null;
    _this[pCrossOrg] = null;
    _this[pPrefix] = null;
    _this[pStrict] = null;
    _this[pUnindexed] = null;
    _this[pThrough] = null;
    _this[pLocale] = null;
    _this[pTransform] = null;return _this;
  }_createClass(Cursor, [{ key: 'object', value: function object(

    name) {
      this[pName] = name;
      return this;
    } }, { key: 'expressionPipeline', value: function expressionPipeline(

    v) {
      this[pExpressionPipeline] = v;
      return this;
    } }, { key: 'access', value: function access(

    v) {
      this[pAccess] = (0, _util.clamp)(v, 1, 8);
      return this;
    } }, { key: 'accessLevel', value: function accessLevel(

    v) {
      return this.access(v);
    } }, { key: 'pathPrefix', value: function pathPrefix()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (v !== null) {
        v = String(v);
      }
      this[pPrefix] = v;
      return this;
    } }, { key: 'prefix', value: function prefix()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      return this.pathPrefix(v);
    } }, { key: 'crossOrg', value: function crossOrg()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pCrossOrg] = Boolean(v);
      return this;
    } }, { key: 'strict', value: function strict()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pStrict] = Boolean(v);
      return this;
    } }, { key: 'indexed', value: function indexed()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pUnindexed] = !v;
      return this;
    } }, { key: 'engine', value: function engine()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'stable';
      this[pEngine] = v;
      return this;
    } }, { key: 'explain', value: function explain()

    {var _explain = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return _objects2.default.list(this[pName], Object.assign(this[fOptions](), { explain: _explain }));
    } }, { key: 'grant', value: function grant()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      this[pGrant] = v;
      return this;
    } }, { key: 'roles', value: function roles()

    {for (var _len = arguments.length, _roles = Array(_len), _key = 0; _key < _len; _key++) {_roles[_key] = arguments[_key];}
      this[pRoles] = _roles;
      return this;
    } }, { key: 'limit', value: function limit()

    {
      throw new Error('script.error.pureVirtual');
    } }, { key: 'map', value: function map(

    fn) {
      var out = [];var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
        for (var _iterator = this[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var value = _step.value;
          out.push(fn(value));
        }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
      return out;
    } }, { key: 'through', value: function through(

    v) {
      this[pThrough] = v;
      return this;
    } }, { key: 'maxTimeMS', value: function maxTimeMS(

    v) {
      this[pMaxTimeMs] = (0, _util.clamp)(v, script.config.query.minTimeMS, script.config.query.maxTimeMS);
      return this;
    } }, { key: 'skip', value: function skip()

    {throw new Error('Pure Virtual');} }, { key: 'skipAcl', value: function skipAcl()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pSkipAcl] = Boolean(v);
      return this;
    } }, { key: 'sort', value: function sort()

    {throw new Error('script.error.pureVirtual');} }, { key: 'toArray', value: function toArray()

    {
      var buffer = [];var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
        for (var _iterator2 = this[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var value = _step2.value;
          buffer.push(value);
        }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
      return buffer;
    } }, { key: 'toList', value: function toList()

    {
      return _objects2.default.list(this[pName], this[fOptions]());
    } }, { key: 'locale', value: function locale(

    v) {
      this[pLocale] = v;
      return this;
    } }, { key: 'transform', value: function transform(

    v) {
      this[pTransform] = v;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return {
        maxTimeMS: this[pMaxTimeMs],
        engine: this[pEngine],
        skipAcl: this[pSkipAcl],
        grant: this[pGrant],
        roles: this[pRoles],
        crossOrg: this[pCrossOrg],
        accessLevel: this[pAccess],
        strict: this[pStrict],
        prefix: this[pPrefix],
        unindexed: this[pUnindexed],
        through: this[pThrough],
        locale: this[pLocale],
        transform: this[pTransform],
        expressionPipeline: this[pExpressionPipeline] };

    } }, { key: 'getOptions', value: function getOptions()

    {
      return (0, _util.compact)(_extends({
        operation: 'cursor',
        object: this[pName] },
      this[fOptions]()),
      Undefined, null);
    } }, { key: 'setOptions', value: function setOptions()









    {var _this2 = this;var userOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};var privilegedOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var allowedOptions = (0, _db.getAllowedOptions)(
      this.userOptions,
      this.privilegedOptions,
      userOptions,
      privilegedOptions);


      Object.entries(allowedOptions).forEach(function (_ref) {var _ref2 = _slicedToArray(_ref, 2),fn = _ref2[0],value = _ref2[1];
        _this2[fn](value);
      });

      return this;

    } }, { key: 'userOptions', get: function get() {return ['maxTimeMS', 'crossOrg', 'engine', 'explain', 'locale', 'accessLevel', 'prefix'];} }, { key: 'privilegedOptions', get: function get() {return ['grant', 'roles', 'skipAcl', 'strict', 'unindexed', 'transform', 'expressionPipeline'];} }]);return Cursor;}(_util2.BufferedApiCursor);var





QueryCursor = function (_Cursor) {_inherits(QueryCursor, _Cursor);

  function QueryCursor(name, where) {_classCallCheck(this, QueryCursor);var _this3 = _possibleConstructorReturn(this, (QueryCursor.__proto__ || Object.getPrototypeOf(QueryCursor)).call(this,
    name));
    _this3[pMatch] = where;return _this3;
  }_createClass(QueryCursor, [{ key: 'count', value: function count()

    {
      return _objects2.default.driver.count(this[pName], this.getOptions());
    } }, { key: 'where', value: function where(

    _where) {
      this[pMatch] = _where;
      return this;
    } }, { key: 'expand', value: function expand(

    v) {for (var _len2 = arguments.length, more = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {more[_key2 - 1] = arguments[_key2];}
      this[pExpand] = Array.isArray(v) ? v : [v].concat(more);
      return this;
    } }, { key: 'paths', value: function paths(

    v) {for (var _len3 = arguments.length, more = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {more[_key3 - 1] = arguments[_key3];}
      this[pPaths] = Array.isArray(v) ? v : [v].concat(more);
      return this;
    } }, { key: 'include', value: function include(

    v) {for (var _len4 = arguments.length, more = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {more[_key4 - 1] = arguments[_key4];}
      this[pInclude] = Array.isArray(v) ? v : [v].concat(more);
      return this;
    } }, { key: 'passive', value: function passive()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pPassive] = Boolean(v);
      return this;
    } }, { key: 'limit', value: function limit(

    v) {
      this[pLimit] = v;
      return this;
    } }, { key: 'skip', value: function skip(

    v) {
      this[pSkip] = v;
      return this;
    } }, { key: 'sort', value: function sort(

    v) {
      this[pSort] = v;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return Object.assign(_get(QueryCursor.prototype.__proto__ || Object.getPrototypeOf(QueryCursor.prototype), fOptions, this).call(this), {
        paths: this[pPaths],
        include: this[pInclude],
        expand: this[pExpand],
        passive: this[pPassive],
        where: this[pMatch],
        sort: this[pSort],
        skip: this[pSkip],
        limit: this[pLimit] });

    } }, { key: 'toUrl', value: function toUrl()





    {var _this4 = this;

      return [
      ['where', pMatch],
      ['paths', pPaths],
      ['include', pInclude],
      ['expand', pExpand],
      ['sort', pSort],
      ['skip', pSkip],
      ['limit', pLimit]].

      filter(function (v) {return _this4[v[1]] !== null && _this4[v[1]] !== Undefined;}).
      map(function (v) {
        var value = _this4[v[1]];
        if (!Array.isArray(value) || value.length <= 1) {
          return v[0] + '=' + encodeURIComponent(JSON.stringify(_this4[v[1]]));
        }
        return value.
        filter(function (v1) {return v1 !== null && v1 !== Undefined;}).
        reduce(function (arr, v1) {return [].concat(_toConsumableArray(arr), [v[0] + '[]=' + encodeURIComponent(v1)]);}, []).
        join('&');
      }).
      join('&');

    } }, { key: 'toJSON', value: function toJSON()

    {
      return JSON.stringify({
        where: this[pMatch],
        paths: this[pPaths],
        include: this[pInclude],
        expand: this[pExpand],
        sort: this[pSort],
        skip: this[pSkip],
        limit: this[pLimit] });

    } }, { key: 'toString', value: function toString()

    {
      return this.toJSON();
    } }, { key: 'pathRead', value: function pathRead(

    path, options) {

      options = options || {};

      return _objects2.default.driver.readOne(this[pName], _extends({},
      this[fOptions](), {
        path: path,
        where: this[pMatch],
        throwNotFound: (0, _util.rBool)(options.throwNotFound, true) }));

    } }, { key: 'userOptions', get: function get() {return _get(QueryCursor.prototype.__proto__ || Object.getPrototypeOf(QueryCursor.prototype), 'userOptions', this).concat('paths', 'include', 'expand', 'passive', 'where', 'sort', 'skip', 'limit');} }]);return QueryCursor;}(Cursor);



(0, _db2.register)('find', QueryCursor);var



AggregationCursor = function (_Cursor2) {_inherits(AggregationCursor, _Cursor2);

  function AggregationCursor(name, pipeline) {_classCallCheck(this, AggregationCursor);var _this5 = _possibleConstructorReturn(this, (AggregationCursor.__proto__ || Object.getPrototypeOf(AggregationCursor)).call(this,
    name));
    _this5[pPipeline] = Array.isArray(pipeline) ? pipeline : [];return _this5;
  }_createClass(AggregationCursor, [{ key: 'pipeline', value: function pipeline(

    _pipeline) {
      this[pPipeline] = Array.isArray(_pipeline) ? _pipeline : [];
      return this;
    } }, { key: 'group', value: function group(

    v) {
      return this[fAdd]('$group', v);
    } }, { key: 'limit', value: function limit(

    v) {
      if (v === false || v === Undefined) {
        this[pLimit] = v;
        return this;
      }
      return this[fAdd]('$limit', v);
    } }, { key: 'match', value: function match(

    v) {
      return this[fAdd]('$match', v);
    } }, { key: 'project', value: function project(

    v) {
      return this[fAdd]('$project', v);
    } }, { key: 'addFields', value: function addFields(

    v) {
      return this[fAdd]('$addFields', v);
    } }, { key: 'native', value: function native(

    v) {
      this[pNativePipeline] = v;
      return this;
    } }, { key: 'nativePipeline', value: function nativePipeline(

    v) {
      return this.native(v);
    } }, { key: 'skip', value: function skip(

    v) {
      return this[fAdd]('$skip', v);
    } }, { key: 'sort', value: function sort(

    v) {
      return this[fAdd]('$sort', v);
    } }, { key: 'unwind', value: function unwind(

    v) {
      return this[fAdd]('$unwind', v);
    } }, { key:

    fAdd, value: function value() {var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var v = arguments[1];
      this[pPipeline].push(type ? _defineProperty({}, type, v) : v);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return Object.assign(_get(AggregationCursor.prototype.__proto__ || Object.getPrototypeOf(AggregationCursor.prototype), fOptions, this).call(this), {
        limit: this[pLimit],
        pipeline: this[pPipeline],
        nativePipeline: this[pNativePipeline] });

    } }, { key: 'toUrl', value: function toUrl()









    {
      return 'pipeline=' + encodeURIComponent(JSON.stringify(this[pPipeline]));
    } }, { key: 'toJSON', value: function toJSON()

    {
      return JSON.stringify(this[pPipeline]);
    } }, { key: 'toString', value: function toString()

    {
      return this.toJSON();
    } }, { key: 'userOptions', get: function get() {return _get(AggregationCursor.prototype.__proto__ || Object.getPrototypeOf(AggregationCursor.prototype), 'userOptions', this).concat('pipeline', 'limit');} }, { key: 'privilegedOptions', get: function get() {return _get(AggregationCursor.prototype.__proto__ || Object.getPrototypeOf(AggregationCursor.prototype), 'privilegedOptions', this).concat('nativePipeline');} }]);return AggregationCursor;}(Cursor);



(0, _db2.register)('aggregate', AggregationCursor);exports.


QueryCursor = QueryCursor;exports.
AggregationCursor = AggregationCursor;