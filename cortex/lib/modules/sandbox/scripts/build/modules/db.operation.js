'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _get = function get(object, property, receiver) {if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {var parent = Object.getPrototypeOf(object);if (parent === null) {return undefined;} else {return get(parent, property, receiver);}} else if ("value" in desc) {return desc.value;} else {var getter = desc.get;if (getter === undefined) {return undefined;}return getter.call(receiver);}};var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _require =

require('util.values'),isSet = _require.isSet,clamp = _require.clamp,isString = _require.isString,compact = _require.compact,
objects = require('objects'),_require2 =
require('util.cursor'),BufferedApiCursor = _require2.BufferedApiCursor,_require3 =
require('db.util'),createOperation = _require3.createOperation,getAllowedOptions = _require3.getAllowedOptions,_require4 =
require('db.factory'),register = _require4.register,
pEngine = Symbol('engine'),
pExplain = Symbol('explain'),
pMaxTimeMs = Symbol('max_time_ms'),
pName = Symbol('name'),
pSkipAcl = Symbol('skip_acl'),
pBypassCreateAcl = Symbol('bypass_create_acl'),
pLean = Symbol('lean'),
pMerge = Symbol('merge'),
pLocale = Symbol('locale'),
pTransform = Symbol('transform'),
pAsync = Symbol('async'),
pDocument = Symbol('document'),
pGrant = Symbol('grant'),
pRoles = Symbol('roles'),
pPrefix = Symbol('prefix'),
pCrossOrg = Symbol('crossOrg'),
pDryRun = Symbol('dryRun'),
fOptions = Symbol('options'),
pMatch = Symbol('match'),
pSkip = Symbol('skip'),
pLimit = Symbol('limit'),
pSort = Symbol('sort'),
pExpand = Symbol('expand'),
pThrowNotFound = Symbol('throwNotFound'),
pPaths = Symbol('paths'),
pPassive = Symbol('passive'),
pInclude = Symbol('include'),
pThrough = Symbol('through'),
pBulk = Symbol('bulk'),
pOperation = Symbol('operation'),
pBulkName = Symbol('bulkName'),
pHalt = Symbol('halt'),
pWrap = Symbol('wrap'),
pOutput = Symbol('output'),
pAs = Symbol('as'),
pIsUnmanaged = Symbol('isUnmanaged'),
pDisableTriggers = Symbol('disableTriggers'),
pOps = Symbol('ops'),
pOpName = Symbol('opName'),
fOps = Symbol('bulkOps'),
WRAPPER_OPTIONS = ['name', 'halt', 'wrap', 'output', 'as'];

var Undefined = void 0;var

Operation = function () {

  function Operation(name) {_classCallCheck(this, Operation);
    this[pName] = name;
    this[pSkipAcl] = null;
    this[pThrough] = null;
    this[pGrant] = null;
    this[pRoles] = null;
    this[pCrossOrg] = null;
    this[pDryRun] = null;
    this[pPassive] = null;
    this[pLocale] = null;
  }_createClass(Operation, [{ key: 'skipAcl', value: function skipAcl()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pSkipAcl] = Boolean(v);
      return this;
    } }, { key: 'object', value: function object(

    name) {
      this[pName] = name;
      return this;
    } }, { key: 'through', value: function through()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      this[pThrough] = String(v);
      return this;
    } }, { key: 'grant', value: function grant()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      this[pGrant] = v;
      return this;
    } }, { key: 'roles', value: function roles()

    {for (var _len = arguments.length, _roles = Array(_len), _key = 0; _key < _len; _key++) {_roles[_key] = arguments[_key];}
      this[pRoles] = _roles;
      return this;
    } }, { key: 'crossOrg', value: function crossOrg()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pCrossOrg] = Boolean(v);
      return this;
    } }, { key: 'dryRun', value: function dryRun()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pDryRun] = Boolean(v);
      return this;
    } }, { key: 'passive', value: function passive()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pPassive] = Boolean(v);
      return this;
    } }, { key: 'locale', value: function locale(

    v) {
      this[pLocale] = v;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return {
        skipAcl: this[pSkipAcl],
        grant: this[pGrant],
        roles: this[pRoles],
        crossOrg: this[pCrossOrg],
        dryRun: this[pDryRun],
        through: this[pThrough],
        passive: this[pPassive],
        locale: this[pLocale] };

    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        object: this[pName],
        operation: this[pOpName] },
      this[fOptions]()),
      Undefined, null);
    } }, { key: 'setOptions', value: function setOptions()









    {var _this = this;var userOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};var privilegedOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var allowedOptions = getAllowedOptions(
      this.userOptions,
      this.privilegedOptions,
      userOptions,
      privilegedOptions);


      Object.entries(allowedOptions).forEach(function (_ref) {var _ref2 = _slicedToArray(_ref, 2),fn = _ref2[0],value = _ref2[1];
        _this[fn](value);
      });

      return this;

    } }, { key: 'userOptions', get: function get() {return ['passive', 'dryRun', 'locale'];} }, { key: 'privilegedOptions', get: function get() {return ['grant', 'roles', 'skipAcl'];} }]);return Operation;}();var





ReadOneOperation = function (_Operation) {_inherits(ReadOneOperation, _Operation);

  function ReadOneOperation(name, where) {_classCallCheck(this, ReadOneOperation);var _this2 = _possibleConstructorReturn(this, (ReadOneOperation.__proto__ || Object.getPrototypeOf(ReadOneOperation)).call(this,
    name));
    _this2[pMatch] = where;
    _this2[pThrowNotFound] = true;
    _this2[pMaxTimeMs] = script.config.query.defaultMaxTimeMS;return _this2;
  }_createClass(ReadOneOperation, [{ key: 'where', value: function where(

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
    } }, { key: 'sort', value: function sort(

    v) {
      this[pSort] = v;
      return this;
    } }, { key: 'path', value: function path()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      this[pPrefix] = v;
      return this;
    } }, { key: 'throwNotFound', value: function throwNotFound()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pThrowNotFound] = v;
      return this;
    } }, { key: 'engine', value: function engine()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'stable';
      this[pEngine] = v;
      return this;
    } }, { key: 'explain', value: function explain()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pExplain] = v;
      return this;
    } }, { key: 'maxTimeMS', value: function maxTimeMS(

    v) {
      this[pMaxTimeMs] = clamp(v, script.config.query.minTimeMS, script.config.query.maxTimeMS);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(ReadOneOperation.prototype.__proto__ || Object.getPrototypeOf(ReadOneOperation.prototype),
      fOptions, this).call(this), {
        where: this[pMatch],
        paths: this[pPaths],
        include: this[pInclude],
        expand: this[pExpand],
        path: this[pPrefix],
        sort: this[pSort],
        throwNotFound: this[pThrowNotFound],
        engine: this[pEngine],
        explain: this[pExplain],
        maxTimeMS: this[pMaxTimeMs] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.readOne(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        where: this[pMatch] }, _get(ReadOneOperation.prototype.__proto__ || Object.getPrototypeOf(ReadOneOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(ReadOneOperation.prototype.__proto__ || Object.getPrototypeOf(ReadOneOperation.prototype), 'userOptions', this).concat('where', 'paths', 'include', 'expand', 'path', 'sort', 'throwNotFound', 'engine', 'explain', 'maxTimeMS');
    } }, { key:

    pOpName, get: function get() {
      return 'readOne';
    } }]);return ReadOneOperation;}(Operation);var





CountOperation = function (_Operation2) {_inherits(CountOperation, _Operation2);

  function CountOperation(name, where) {_classCallCheck(this, CountOperation);var _this3 = _possibleConstructorReturn(this, (CountOperation.__proto__ || Object.getPrototypeOf(CountOperation)).call(this,
    name));
    _this3[pMatch] = where;
    _this3[pMaxTimeMs] = script.config.query.defaultMaxTimeMS;return _this3;
  }_createClass(CountOperation, [{ key: 'limit', value: function limit(

    v) {
      this[pLimit] = v;
      return this;
    } }, { key: 'skip', value: function skip(

    v) {
      this[pSkip] = v;
      return this;
    } }, { key: 'where', value: function where(

    _where2) {
      this[pMatch] = _where2;
      return this;
    } }, { key: 'engine', value: function engine()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'stable';
      this[pEngine] = v;
      return this;
    } }, { key: 'explain', value: function explain()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pExplain] = v;
      return this;
    } }, { key: 'maxTimeMS', value: function maxTimeMS(

    v) {
      this[pMaxTimeMs] = clamp(v, script.config.query.minTimeMS, script.config.query.maxTimeMS);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(CountOperation.prototype.__proto__ || Object.getPrototypeOf(CountOperation.prototype),
      fOptions, this).call(this), {
        skip: this[pSkip],
        limit: this[pLimit],
        where: this[pMatch],
        engine: this[pEngine],
        explain: this[pExplain],
        maxTimeMS: this[pMaxTimeMs] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.count(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        where: this[pMatch] }, _get(CountOperation.prototype.__proto__ || Object.getPrototypeOf(CountOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(CountOperation.prototype.__proto__ || Object.getPrototypeOf(CountOperation.prototype), 'userOptions', this).concat('where', 'skip', 'limit', 'engine', 'explain', 'maxTimeMS');
    } }, { key:

    pOpName, get: function get() {
      return 'count';
    } }]);return CountOperation;}(Operation);var





WriteOneOperation = function (_Operation3) {_inherits(WriteOneOperation, _Operation3);

  function WriteOneOperation(name) {_classCallCheck(this, WriteOneOperation);var _this4 = _possibleConstructorReturn(this, (WriteOneOperation.__proto__ || Object.getPrototypeOf(WriteOneOperation)).call(this,
    name));
    _this4[pPaths] = null;
    _this4[pInclude] = null;
    _this4[pLean] = true;
    _this4[pIsUnmanaged] = null;
    _this4[pDisableTriggers] = null;return _this4;
  }_createClass(WriteOneOperation, [{ key: 'isUnmanaged', value: function isUnmanaged()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pIsUnmanaged] = Boolean(v);
      return this;
    } }, { key: 'disableTriggers', value: function disableTriggers()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pDisableTriggers] = Boolean(v);
      return this;
    } }, { key: 'paths', value: function paths(

    v) {for (var _len5 = arguments.length, more = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {more[_key5 - 1] = arguments[_key5];}
      this[pPaths] = Array.isArray(v) ? v : [v].concat(more);
      this[pLean] = false;
      return this;
    } }, { key: 'include', value: function include(

    v) {for (var _len6 = arguments.length, more = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {more[_key6 - 1] = arguments[_key6];}
      this[pInclude] = Array.isArray(v) ? v : [v].concat(more);
      this[pLean] = false;
      return this;
    } }, { key: 'lean', value: function lean()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pLean] = v === 'modified' ? v : Boolean(v);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(WriteOneOperation.prototype.__proto__ || Object.getPrototypeOf(WriteOneOperation.prototype),
      fOptions, this).call(this), {
        paths: this[pPaths],
        include: this[pInclude],
        lean: this[pLean],
        isUnmanaged: this[pIsUnmanaged],
        disableTriggers: this[pDisableTriggers] });

    } }, { key: 'userOptions', get: function get()

    {
      return _get(WriteOneOperation.prototype.__proto__ || Object.getPrototypeOf(WriteOneOperation.prototype), 'userOptions', this).concat('paths', 'include', 'lean');
    } }, { key: 'privilegedOptions', get: function get()

    {
      return _get(WriteOneOperation.prototype.__proto__ || Object.getPrototypeOf(WriteOneOperation.prototype), 'privilegedOptions', this).concat('isUnmanaged', 'disableTriggers');
    } }]);return WriteOneOperation;}(Operation);var





InsertOperation = function (_WriteOneOperation) {_inherits(InsertOperation, _WriteOneOperation);

  function InsertOperation(name, document) {_classCallCheck(this, InsertOperation);var _this5 = _possibleConstructorReturn(this, (InsertOperation.__proto__ || Object.getPrototypeOf(InsertOperation)).call(this,
    name));
    _this5.document(document);
    _this5[pBypassCreateAcl] = null;return _this5;
  }_createClass(InsertOperation, [{ key: 'bypassCreateAcl', value: function bypassCreateAcl()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pBypassCreateAcl] = Boolean(v);
      return this;
    } }, { key: 'document', value: function document(

    _document) {
      this[pDocument] = _document;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(InsertOperation.prototype.__proto__ || Object.getPrototypeOf(InsertOperation.prototype),
      fOptions, this).call(this), {
        bypassCreateAcl: this[pBypassCreateAcl] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.insertOne(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        document: this[pDocument] }, _get(InsertOperation.prototype.__proto__ || Object.getPrototypeOf(InsertOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(InsertOperation.prototype.__proto__ || Object.getPrototypeOf(InsertOperation.prototype), 'userOptions', this).concat('document');
    } }, { key: 'privilegedOptions', get: function get()

    {
      return _get(InsertOperation.prototype.__proto__ || Object.getPrototypeOf(InsertOperation.prototype), 'privilegedOptions', this).concat('bypassCreateAcl');
    } }, { key:

    pOpName, get: function get() {
      return 'insertOne';
    } }]);return InsertOperation;}(WriteOneOperation);var



WriteManyOperation = function (_Operation4) {_inherits(WriteManyOperation, _Operation4);

  function WriteManyOperation(name) {var document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];_classCallCheck(this, WriteManyOperation);var _this6 = _possibleConstructorReturn(this, (WriteManyOperation.__proto__ || Object.getPrototypeOf(WriteManyOperation)).call(this,
    name));
    _this6[pIsUnmanaged] = null;
    _this6[pDisableTriggers] = null;return _this6;
  }_createClass(WriteManyOperation, [{ key: 'isUnmanaged', value: function isUnmanaged()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pIsUnmanaged] = Boolean(v);
      return this;
    } }, { key: 'disableTriggers', value: function disableTriggers()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pDisableTriggers] = Boolean(v);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(WriteManyOperation.prototype.__proto__ || Object.getPrototypeOf(WriteManyOperation.prototype),
      fOptions, this).call(this), {
        isUnmanaged: this[pIsUnmanaged],
        disableTriggers: this[pDisableTriggers] });

    } }, { key: 'privilegedOptions', get: function get()

    {
      return _get(WriteManyOperation.prototype.__proto__ || Object.getPrototypeOf(WriteManyOperation.prototype), 'privilegedOptions', this).concat('isUnmanaged', 'disableTriggers');
    } }]);return WriteManyOperation;}(Operation);var



InsertManyOperation = function (_WriteManyOperation) {_inherits(InsertManyOperation, _WriteManyOperation);

  function InsertManyOperation(name) {var document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];_classCallCheck(this, InsertManyOperation);var _this7 = _possibleConstructorReturn(this, (InsertManyOperation.__proto__ || Object.getPrototypeOf(InsertManyOperation)).call(this,
    name));
    _this7.documents(document);
    _this7[pBypassCreateAcl] = null;return _this7;
  }_createClass(InsertManyOperation, [{ key: 'bypassCreateAcl', value: function bypassCreateAcl()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pBypassCreateAcl] = Boolean(v);
      return this;
    } }, { key: 'documents', value: function documents(

    document) {
      this[pDocument] = Array.isArray(document) ? document : [document];
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(InsertManyOperation.prototype.__proto__ || Object.getPrototypeOf(InsertManyOperation.prototype),
      fOptions, this).call(this), {
        bypassCreateAcl: this[pBypassCreateAcl] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.insertMany(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        documents: this[pDocument] }, _get(InsertManyOperation.prototype.__proto__ || Object.getPrototypeOf(InsertManyOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(InsertManyOperation.prototype.__proto__ || Object.getPrototypeOf(InsertManyOperation.prototype), 'userOptions', this).concat('documents');
    } }, { key: 'privilegedOptions', get: function get()

    {
      return _get(InsertManyOperation.prototype.__proto__ || Object.getPrototypeOf(InsertManyOperation.prototype), 'privilegedOptions', this).concat('bypassCreateAcl');
    } }, { key:

    pOpName, get: function get() {
      return 'insertMany';
    } }]);return InsertManyOperation;}(WriteManyOperation);var



PatchOperation = function (_WriteOneOperation2) {_inherits(PatchOperation, _WriteOneOperation2);

  function PatchOperation(name, match, ops) {_classCallCheck(this, PatchOperation);var _this8 = _possibleConstructorReturn(this, (PatchOperation.__proto__ || Object.getPrototypeOf(PatchOperation)).call(this,
    name));
    _this8[pMatch] = match;
    _this8[pOps] = ops;
    _this8[pPrefix] = null;
    _this8[pMerge] = false;return _this8;
  }_createClass(PatchOperation, [{ key:

    fOptions, value: function value() {

      if (this[pPrefix] && this[pThrough]) {
        throw new TypeError('through() and pathPrefix cannot be used together.');
      }

      return _extends({}, _get(PatchOperation.prototype.__proto__ || Object.getPrototypeOf(PatchOperation.prototype),
      fOptions, this).call(this), {
        path: this[pPrefix],
        mergeDocuments: this[pMerge] });

    } }, { key: 'ops', value: function ops(

    _ops) {
      this[pOps] = _ops;
      return this;
    } }, { key: 'match', value: function match(

    _match) {
      this[pMatch] = _match;
      return this;
    } }, { key: 'merge', value: function merge()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pMerge] = Boolean(v);
      return this;
    } }, { key: 'mergeDocuments', value: function mergeDocuments()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return this.merge(v);
    } }, { key: 'pathPrefix', value: function pathPrefix()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (v !== null) {
        v = String(v);
      }
      if (this[pLean] === null) this[pLean] = false;
      this[pPrefix] = v;
      return this;
    } }, { key: 'path', value: function path()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      return this.pathPrefix(v);
    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.patchOne(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        match: this[pMatch],
        ops: this[pOps] }, _get(PatchOperation.prototype.__proto__ || Object.getPrototypeOf(PatchOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(PatchOperation.prototype.__proto__ || Object.getPrototypeOf(PatchOperation.prototype), 'userOptions', this).concat('path', 'mergeDocuments', 'match', 'ops');
    } }, { key:

    pOpName, get: function get() {
      return 'patchOne';
    } }]);return PatchOperation;}(WriteOneOperation);var



PatchManyOperation = function (_WriteManyOperation2) {_inherits(PatchManyOperation, _WriteManyOperation2);

  function PatchManyOperation(name, match) {var ops = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;_classCallCheck(this, PatchManyOperation);var _this9 = _possibleConstructorReturn(this, (PatchManyOperation.__proto__ || Object.getPrototypeOf(PatchManyOperation)).call(this,
    name));
    _this9[pMatch] = ops === null ? {} : match;
    _this9[pOps] = ops === null ? match : ops;
    _this9[pLimit] = null;
    _this9[pMerge] = false;return _this9;
  }_createClass(PatchManyOperation, [{ key: 'limit', value: function limit(

    v) {
      this[pLimit] = v;
      return this;
    } }, { key: 'ops', value: function ops(

    _ops2) {
      this[pOps] = _ops2;
      return this;
    } }, { key: 'match', value: function match(

    _match2) {
      this[pMatch] = _match2;
      return this;
    } }, { key: 'merge', value: function merge()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pMerge] = Boolean(v);
      return this;
    } }, { key: 'mergeDocuments', value: function mergeDocuments()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return this.merge(v);
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(PatchManyOperation.prototype.__proto__ || Object.getPrototypeOf(PatchManyOperation.prototype),
      fOptions, this).call(this), {
        limit: this[pLimit],
        mergeDocuments: this[pMerge] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.patchMany(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        match: this[pMatch],
        ops: this[pOps] }, _get(PatchManyOperation.prototype.__proto__ || Object.getPrototypeOf(PatchManyOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(PatchManyOperation.prototype.__proto__ || Object.getPrototypeOf(PatchManyOperation.prototype), 'userOptions', this).concat('mergeDocuments', 'match', 'ops', 'limit');
    } }, { key:

    pOpName, get: function get() {
      return 'patchMany';
    } }]);return PatchManyOperation;}(WriteManyOperation);var



UpdateOperation = function (_WriteOneOperation3) {_inherits(UpdateOperation, _WriteOneOperation3);

  function UpdateOperation(name, match, document) {_classCallCheck(this, UpdateOperation);var _this10 = _possibleConstructorReturn(this, (UpdateOperation.__proto__ || Object.getPrototypeOf(UpdateOperation)).call(this,
    name));
    _this10[pMatch] = match;
    _this10[pDocument] = document;
    _this10[pPrefix] = null;
    _this10[pMerge] = false;return _this10;
  }_createClass(UpdateOperation, [{ key:

    fOptions, value: function value() {

      if (this[pPrefix] && this[pThrough]) {
        throw new TypeError('through() and pathPrefix cannot be used together.');
      }

      return _extends({}, _get(UpdateOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateOperation.prototype),
      fOptions, this).call(this), {
        path: this[pPrefix],
        mergeDocuments: this[pMerge] });

    } }, { key: 'match', value: function match(

    _match3) {
      this[pMatch] = _match3;
      return this;
    } }, { key: 'update', value: function update(

    document) {
      this[pDocument] = document;
      return this;
    } }, { key: 'merge', value: function merge()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pMerge] = Boolean(v);
      return this;
    } }, { key: 'mergeDocuments', value: function mergeDocuments()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return this.merge(v);
    } }, { key: 'pathPrefix', value: function pathPrefix()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (v !== null) {
        v = String(v);
      }
      if (this[pLean] === null) this[pLean] = false;
      this[pPrefix] = v;
      return this;
    } }, { key: 'path', value: function path()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      return this.pathPrefix(v);
    } }, { key: 'pathDelete', value: function pathDelete()

    {var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (path !== null) {
        this.pathPrefix(path);
      }
      return objects.delete(this[pName], this[pMatch], this[fOptions]());
    } }, { key: 'pathUpdate', value: function pathUpdate()

    {var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var body = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      if (typeof path !== 'string') {
        body = path;
        path = null;
      }
      if (path !== null) {
        this.pathPrefix(path);
      }
      return objects.update(this[pName], this[pMatch], body, this[fOptions]());
    } }, { key: 'pathPush', value: function pathPush()

    {var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var body = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      if (typeof path !== 'string') {
        body = path;
        path = null;
      }
      if (path !== null) {
        this.pathPrefix(path);
      }
      return objects.push(this[pName], this[pMatch], body, this[fOptions]());
    } }, { key: 'pathPatch', value: function pathPatch()

    {var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;var body = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      if (typeof path !== 'string') {
        body = path;
        path = null;
      }
      if (path !== null) {
        this.pathPrefix(path);
      }
      return objects.patch(this[pName], this[pMatch], body, this[fOptions]());
    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.updateOne(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        match: this[pMatch],
        update: this[pDocument] }, _get(UpdateOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(UpdateOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateOperation.prototype), 'userOptions', this).concat('path', 'mergeDocuments', 'match', 'update');
    } }, { key:

    pOpName, get: function get() {
      return 'updateOne';
    } }]);return UpdateOperation;}(WriteOneOperation);var



UpdateManyOperation = function (_WriteManyOperation3) {_inherits(UpdateManyOperation, _WriteManyOperation3);

  function UpdateManyOperation(name, match) {var document = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;_classCallCheck(this, UpdateManyOperation);var _this11 = _possibleConstructorReturn(this, (UpdateManyOperation.__proto__ || Object.getPrototypeOf(UpdateManyOperation)).call(this,
    name));
    _this11[pMatch] = document === null ? {} : match;
    _this11[pDocument] = document === null ? match : document;
    _this11[pLimit] = null;
    _this11[pMerge] = false;return _this11;
  }_createClass(UpdateManyOperation, [{ key: 'limit', value: function limit(

    v) {
      this[pLimit] = v;
      return this;
    } }, { key: 'match', value: function match(

    _match4) {
      this[pMatch] = _match4;
      return this;
    } }, { key: 'update', value: function update(

    document) {
      this[pDocument] = document;
      return this;
    } }, { key: 'merge', value: function merge()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pMerge] = Boolean(v);
      return this;
    } }, { key: 'mergeDocuments', value: function mergeDocuments()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return this.merge(v);
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(UpdateManyOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateManyOperation.prototype),
      fOptions, this).call(this), {
        limit: this[pLimit],
        mergeDocuments: this[pMerge] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.driver.updateMany(this[pName], this.getOptions());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        match: this[pMatch],
        update: this[pDocument] }, _get(UpdateManyOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateManyOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(UpdateManyOperation.prototype.__proto__ || Object.getPrototypeOf(UpdateManyOperation.prototype), 'userOptions', this).concat('limit', 'mergeDocuments', 'match', 'update');
    } }, { key:

    pOpName, get: function get() {
      return 'updateMany';
    } }]);return UpdateManyOperation;}(WriteManyOperation);var





DeleteOperation = function (_Operation5) {_inherits(DeleteOperation, _Operation5);

  function DeleteOperation(name) {var match = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};_classCallCheck(this, DeleteOperation);var _this12 = _possibleConstructorReturn(this, (DeleteOperation.__proto__ || Object.getPrototypeOf(DeleteOperation)).call(this,
    name));
    _this12[pMatch] = match;
    _this12[pDisableTriggers] = null;return _this12;
  }_createClass(DeleteOperation, [{ key: 'match', value: function match(

    _match5) {
      this[pMatch] = _match5;
      return this;
    } }, { key: 'disableTriggers', value: function disableTriggers()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pDisableTriggers] = Boolean(v);
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(DeleteOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteOperation.prototype),
      fOptions, this).call(this), {
        disableTriggers: this[pDisableTriggers] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.delete(this[pName], this[pMatch], this[fOptions]());
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        match: this[pMatch] }, _get(DeleteOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteOperation.prototype), 'getOptions', this).call(this)),

      Undefined, null);
    } }, { key: 'userOptions', get: function get()

    {
      return _get(DeleteOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteOperation.prototype), 'userOptions', this).concat('match');
    } }, { key: 'privilegedOptions', get: function get()

    {
      return _get(DeleteOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteOperation.prototype), 'privilegedOptions', this).concat('disableTriggers');
    } }, { key:

    pOpName, get: function get() {
      return 'deleteOne';
    } }]);return DeleteOperation;}(Operation);var



DeleteManyOperation = function (_DeleteOperation) {_inherits(DeleteManyOperation, _DeleteOperation);

  function DeleteManyOperation(name, match) {_classCallCheck(this, DeleteManyOperation);var _this13 = _possibleConstructorReturn(this, (DeleteManyOperation.__proto__ || Object.getPrototypeOf(DeleteManyOperation)).call(this,
    name, match));
    _this13[pLimit] = null;return _this13;
  }_createClass(DeleteManyOperation, [{ key: 'limit', value: function limit(

    v) {
      this[pLimit] = v;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return _extends({}, _get(DeleteManyOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteManyOperation.prototype),
      fOptions, this).call(this), {
        limit: this[pLimit] });

    } }, { key: 'execute', value: function execute()

    {
      return objects.deleteMany(this[pName], this[pMatch], this[fOptions]());
    } }, { key: 'userOptions', get: function get()

    {
      return _get(DeleteManyOperation.prototype.__proto__ || Object.getPrototypeOf(DeleteManyOperation.prototype), 'userOptions', this).concat('limit');
    } }, { key:

    pOpName, get: function get() {
      return 'deleteMany';
    } }]);return DeleteManyOperation;}(DeleteOperation);var





BulkOperationWrapper = function () {

  function BulkOperationWrapper(bulk, operation) {var _this14 = this;var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};_classCallCheck(this, BulkOperationWrapper);

    this[pBulk] = bulk;
    this[pOperation] = operation;

    if (isSet(options)) {
      WRAPPER_OPTIONS.forEach(function (prop) {
        if (isSet(options[prop])) {
          _this14[prop](options[prop]);
        }
      });
    }

  }_createClass(BulkOperationWrapper, [{ key: 'name', value: function name()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      this[pBulkName] = String(v);
      return this;
    } }, { key: 'halt', value: function halt()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pHalt] = Boolean(v);
      return this;
    } }, { key: 'wrap', value: function wrap()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pWrap] = Boolean(v);
      return this;
    } }, { key: 'output', value: function output()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      this[pOutput] = Boolean(v);
      return this;
    } }, { key: 'as', value: function as(

    id) {var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (isString(id)) {
        this[pAs] = _extends({ id: id }, options || {});
      } else if (isSet(id)) {
        this[pAs] = id;
      }
      return this;
    } }, { key: 'getOptions', value: function getOptions()









    {
      return compact(_extends({
        name: this[pBulkName],
        halt: this[pHalt],
        wrap: this[pWrap],
        output: this[pOutput],
        as: this[pAs] },
      this.operation.getOptions()),
      Undefined);
    } }, { key: 'bulk', get: function get() {return this[pBulk];} }, { key: 'operation', get: function get() {return this[pOperation];} }]);return BulkOperationWrapper;}();var



BulkOperation = function (_BufferedApiCursor) {_inherits(BulkOperation, _BufferedApiCursor);

  function BulkOperation(name) {_classCallCheck(this, BulkOperation);

    var execute = function execute() {
      return objects.driver.bulk(
      '',
      this[fOptions]());

    };var _this15 = _possibleConstructorReturn(this, (BulkOperation.__proto__ || Object.getPrototypeOf(BulkOperation)).call(this,

    null, execute, { shared: false }));

    _this15[pName] = name;
    _this15[pOps] = [];
    _this15[pTransform] = null;
    _this15[pAsync] = null;return _this15;
  }_createClass(BulkOperation, [{ key: 'object', value: function object(

    name) {
      this[pName] = name;
      return this;
    } }, { key: 'add', value: function add(

    operation, options) {

      var wrapped = new BulkOperationWrapper(this, operation, options);
      this[pOps].push(wrapped);
      return this;

    } }, { key: 'ops', value: function ops(

    _ops3) {var _this16 = this;for (var _len7 = arguments.length, more = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {more[_key7 - 1] = arguments[_key7];}

      var operations = Array.isArray(_ops3) ? _ops3 : [_ops3].concat(more);
      operations.forEach(function (options) {


        var operations = createOperation(_extends({ object: _this16[pName] }, options));
        _this16.add(operations, options);

      });
      return this;

    } }, { key: 'transform', value: function transform(

    v) {
      this[pTransform] = v;
      return this;
    } }, { key: 'async', value: function async()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      this[pAsync] = v;
      return this;
    } }, { key:

    fOptions, value: function value() {
      return {
        ops: this[fOps](),
        transform: this[pTransform],
        async: this[pAsync] };

    } }, { key:

    fOps, value: function value() {
      return this[pOps].map(function (op) {return op.getOptions();});
    } }, { key: 'getOptions', value: function getOptions()

    {
      return compact(_extends({
        operation: 'bulk',
        object: this[pName] },
      this[fOptions]()),
      Undefined, null);
    } }, { key: 'setOptions', value: function setOptions()

    {var _Operation$prototype$;for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {args[_key8] = arguments[_key8];}
      return (_Operation$prototype$ = Operation.prototype.setOptions).call.apply(_Operation$prototype$, [this].concat(args));
    } }, { key: 'userOptions', get: function get()

    {
      return ['object', 'ops'];
    } }, { key: 'privilegedOptions', get: function get()

    {
      return ['transform', 'async'];
    } }]);return BulkOperation;}(BufferedApiCursor);



register('insertOne', InsertOperation);
register('insertMany', InsertManyOperation);
register('updateOne', UpdateOperation);
register('updateMany', UpdateManyOperation);
register('patchOne', PatchOperation);
register('patchMany', PatchManyOperation);
register('deleteOne', DeleteOperation);
register('deleteMany', DeleteManyOperation);
register('bulk', BulkOperation);
register('readOne', ReadOneOperation);
register('count', CountOperation);exports.


InsertOperation = InsertOperation;exports.
InsertManyOperation = InsertManyOperation;exports.
UpdateOperation = UpdateOperation;exports.
UpdateManyOperation = UpdateManyOperation;exports.
PatchOperation = PatchOperation;exports.
PatchManyOperation = PatchManyOperation;exports.
DeleteOperation = DeleteOperation;exports.
DeleteManyOperation = DeleteManyOperation;exports.
BulkOperation = BulkOperation;exports.
ReadOneOperation = ReadOneOperation;exports.
CountOperation = CountOperation;