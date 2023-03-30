'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.WritableBufferedApiCursor = exports.BufferedApiCursor = exports.ApiCursor = exports.Cursor = undefined;var _get = function get(object, property, receiver) {if (object === null) object = Function.prototype;var desc = Object.getOwnPropertyDescriptor(object, property);if (desc === undefined) {var parent = Object.getPrototypeOf(object);if (parent === null) {return undefined;} else {return get(parent, property, receiver);}} else if ("value" in desc) {return desc.value;} else {var getter = desc.get;if (getter === undefined) {return undefined;}return getter.call(receiver);}};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();var _objects = require('objects');var _objects2 = _interopRequireDefault(_objects);
var _util = require('util.values');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}

var sDefaultBatchSize = 100,
sMinBatchSize = 1,
sMaxBatchSize = 100,
pId = Symbol('id'),
pOpened = Symbol(''),
pBuffer = Symbol('buffer'),
pShared = Symbol('shared'),
pBatchSize = Symbol('batch_size'),
pHasMore = Symbol('hasMore'),
pHasNext = Symbol('hasNext'),
pProvider = Symbol('provider'),
fOpen = Symbol('open'),
fOpener = Symbol('opener'),
fFill = Symbol('fill');

var Undefined = void 0;var

Cursor = function () {function Cursor() {_classCallCheck(this, Cursor);}_createClass(Cursor, [{ key: 'close', value: function close()

    {
    } }, { key: 'hasNext', value: function hasNext()

    {
      return false;
    } }, { key: 'isClosed', value: function isClosed()

    {
      return true;
    } }, { key: 'next', value: function next()

    {
      throw new RangeError('Iterator out of bounds.');
    } }, { key: 'passthru', value: function passthru()

    {
      return null;
    } }, { key: 'forEach', value: function forEach(



    fn) {var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
        for (var _iterator = this[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var value = _step.value;
          fn(value);
        }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
    } }, { key: 'map', value: function map(

    fn) {
      var out = [];var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {
        for (var _iterator2 = this[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {var value = _step2.value;
          out.push(fn(value));
        }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
      return out;
    } }, { key: 'find', value: function find(

    fn) {var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {
        for (var _iterator3 = this[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var value = _step3.value;
          if (fn(value)) {
            return value;
          }
        }} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3.return) {_iterator3.return();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}
      return Undefined;
    } }, { key: 'filter', value: function filter(

    fn) {
      var out = [];var _iteratorNormalCompletion4 = true;var _didIteratorError4 = false;var _iteratorError4 = undefined;try {
        for (var _iterator4 = this[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {var value = _step4.value;
          if (fn(value)) {
            out.push(value);
          }
        }} catch (err) {_didIteratorError4 = true;_iteratorError4 = err;} finally {try {if (!_iteratorNormalCompletion4 && _iterator4.return) {_iterator4.return();}} finally {if (_didIteratorError4) {throw _iteratorError4;}}}
      return out;
    } }, { key: 'reduce', value: function reduce(

    fn, memo) {var _iteratorNormalCompletion5 = true;var _didIteratorError5 = false;var _iteratorError5 = undefined;try {
        for (var _iterator5 = this[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {var value = _step5.value;
          memo = fn(memo, value);
        }} catch (err) {_didIteratorError5 = true;_iteratorError5 = err;} finally {try {if (!_iteratorNormalCompletion5 && _iterator5.return) {_iterator5.return();}} finally {if (_didIteratorError5) {throw _iteratorError5;}}}
      return memo;
    } }, { key: 'toArray', value: function toArray()

    {
      var buffer = [];var _iteratorNormalCompletion6 = true;var _didIteratorError6 = false;var _iteratorError6 = undefined;try {
        for (var _iterator6 = this[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {var value = _step6.value;
          buffer.push(value);
        }} catch (err) {_didIteratorError6 = true;_iteratorError6 = err;} finally {try {if (!_iteratorNormalCompletion6 && _iterator6.return) {_iterator6.return();}} finally {if (_didIteratorError6) {throw _iteratorError6;}}}
      return buffer;
    } }, { key:

    Symbol.iterator, value: function value() {var _this = this;
      return {
        next: function next() {return _this.hasNext() ? { value: _this.next(), done: false } : { done: true };} };

    } }, { key: 'stream', value: function stream(









    fnEach_, fnMap_) {

      var buffer = '{ "data": [',
      total = 0,
      hasMore = false;




      var res = require('response'),
      fnEach = typeof fnEach_ === 'function' ? fnEach_ : null,
      fnMap = typeof fnMap_ === 'function' ? fnMap_ : null,
      maxBufferSize = 100 * 1024;

      res.setHeader('Content-Type', 'application/json');

      try {var _iteratorNormalCompletion7 = true;var _didIteratorError7 = false;var _iteratorError7 = undefined;try {
          for (var _iterator7 = this[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {var item = _step7.value;
            ++total;
            if (total > 1) buffer += ',';
            buffer += JSON.stringify(fnMap ? fnMap(item) : item);
            if (buffer.length >= maxBufferSize) {
              res.write(buffer);
              buffer = '';
            }
            if (fnEach && fnEach(item, total) === false) {
              hasMore = !!this.hasNext();
              break;
            }
          }} catch (err) {_didIteratorError7 = true;_iteratorError7 = err;} finally {try {if (!_iteratorNormalCompletion7 && _iterator7.return) {_iterator7.return();}} finally {if (_didIteratorError7) {throw _iteratorError7;}}}
      } catch (err) {
        res.write(buffer + '], "object": "fault", "errCode": "' + (err.errCode || 'cortex.error.unspecified') + '", "code": "' + (err.code || 'kError') + '", "reason": "' + (err.reason || err.message || 'Error') + '"}');
        return;
      }
      res.write(buffer + '], "object": "list", "hasMore": ' + hasMore + '}');
    } }]);return Cursor;}();var





ApiCursor = function (_Cursor) {_inherits(ApiCursor, _Cursor);

  function ApiCursor(id) {var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},_ref$provider = _ref.provider,provider = _ref$provider === undefined ? _objects2.default.cursor : _ref$provider;_classCallCheck(this, ApiCursor);var _this2 = _possibleConstructorReturn(this, (ApiCursor.__proto__ || Object.getPrototypeOf(ApiCursor)).call(this));

    _this2[pId] = id;
    _this2[pProvider] = provider;return _this2;
  }_createClass(ApiCursor, [{ key: 'close', value: function close()

    {
      if (this[pId]) {
        this[pProvider].close(this[pId]);
        this[pId] = null;
      }
    } }, { key: 'hasNext', value: function hasNext()

    {
      return !!this[pId] && this[pProvider].hasNext(this[pId]);
    } }, { key: 'isClosed', value: function isClosed()

    {
      return !this[pId] || this[pProvider].isClosed(this[pId]);
    } }, { key: 'next', value: function next()

    {
      var next = this[pProvider].next(this[pId]);
      if (!next) {
        throw new RangeError('Iterator out of bounds.');
      }
      return next;
    } }, { key: 'passthru', value: function passthru()

    {
      return { object: 'cursor', _id: this[pId] };
    } }, { key: 'toObject', value: function toObject()

    {
      return this[pProvider].toObject ?
      this[pProvider].toObject(this[pId]) :
      {
        _id: this[pId] };

    } }]);return ApiCursor;}(Cursor);var





BufferedApiCursor = function (_ApiCursor) {_inherits(BufferedApiCursor, _ApiCursor);

  function BufferedApiCursor(id, fnOpener) {var _ref2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},_ref2$shared = _ref2.shared,shared = _ref2$shared === undefined ? false : _ref2$shared,_ref2$provider = _ref2.provider,provider = _ref2$provider === undefined ? _objects2.default.cursor : _ref2$provider;_classCallCheck(this, BufferedApiCursor);var _this3 = _possibleConstructorReturn(this, (BufferedApiCursor.__proto__ || Object.getPrototypeOf(BufferedApiCursor)).call(this,

    id, { provider: provider }));
    _this3[pBatchSize] = sDefaultBatchSize;
    _this3[pOpened] = false;
    _this3[fOpener] = fnOpener;
    _this3[pBuffer] = [];
    _this3[pShared] = !!shared;
    _this3[pHasMore] = false;
    _this3[pHasNext] = Undefined;

    if (!id && !(0, _util.isFunction)(fnOpener)) {
      throw new TypeError('missing opener function.');
    }return _this3;

  }_createClass(BufferedApiCursor, [{ key: 'shared', value: function shared()

    {var v = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      if (this[pOpened]) {
        if (this[pShared] !== !!v) {
          throw new Error('cannot update shared property once opened');
        }
      } else {
        this[pShared] = !!v;
      }
      return this;
    } }, { key: 'batchSize', value: function batchSize(

    v) {
      this[pBatchSize] = (0, _util.clamp)(v, sMinBatchSize, sMaxBatchSize);
      return this;
    } }, { key: 'close', value: function close()

    {
      _get(BufferedApiCursor.prototype.__proto__ || Object.getPrototypeOf(BufferedApiCursor.prototype), 'close', this).call(this);
      if (this[pShared]) {
        this[pHasNext] = false;
      }
    } }, { key: 'hasNext', value: function hasNext()

    {
      if (!this[pOpened]) {
        this[fOpen]();
      }
      if (this[pShared]) {
        if (this[pHasNext] !== Undefined) {
          return this[pHasNext];
        }
        return _get(BufferedApiCursor.prototype.__proto__ || Object.getPrototypeOf(BufferedApiCursor.prototype), 'hasNext', this).call(this);
      }
      return !!(this[pId] || this[pBuffer].length > 0);
    } }, { key: 'isClosed', value: function isClosed()

    {
      if (this[pShared]) {
        return !this.hasNext();
      }
      return !this[pId] && this[pOpened] && this[pBuffer].length === 0;
    } }, { key: 'next', value: function next()

    {
      if (!this.hasNext()) {
        throw new RangeError('Iterator out of bounds.');
      }
      var next = null;
      if (this[pShared]) {var _pProvider$fetch =
        this[pProvider].fetch(this[pId], { count: 1 }),buffer = _pProvider$fetch.buffer,hasMore = _pProvider$fetch.hasMore,hasNext = _pProvider$fetch.hasNext;
        next = buffer[0];
        this[pHasMore] = hasMore;
        this[pHasNext] = hasNext;
        if (buffer.length === 0) {
          throw new RangeError('Iterator out of bounds.');
        }
      } else if (this[pBuffer].length > 0) {
        next = this[pBuffer].shift();
        if (this[pBuffer].length === 0) {
          this[fFill]();
        }
      }
      return next;
    } }, { key: 'passthru', value: function passthru()








    {var replay = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

      if (!replay && !this[pOpened]) {
        this[fOpen]();
      }

      return replay ? this[fOpener]() : _get(BufferedApiCursor.prototype.__proto__ || Object.getPrototypeOf(BufferedApiCursor.prototype), 'passthru', this).call(this);
    } }, { key:

    fOpen, value: function value() {
      if (!this[pOpened]) {
        this[pOpened] = true;
        if (!this[pId]) {
          this[pId] = this[fOpener]()._id;
        }
        if (!this[pShared]) {
          this[fFill]();
        }
      }
    } }, { key:

    fFill, value: function value() {
      if (this[pId]) {var _pProvider$fetch2 =
        this[pProvider].fetch(this[pId], { count: this[pBatchSize] }),buffer = _pProvider$fetch2.buffer,hasMore = _pProvider$fetch2.hasMore;
        this[pBuffer] = buffer;
        this[pHasMore] = hasMore;
        if (this[pBuffer].length === 0 || this[pBuffer].length < this[pBatchSize]) {
          this.close();
        }
      }
    } }, { key: 'hasMore', get: function get() {if (this[pShared]) {return this[pHasMore];}return this[pHasMore] && this.isClosed() && this[pBuffer].length === 0;} }]);return BufferedApiCursor;}(ApiCursor);var



WritableBufferedApiCursor = function (_BufferedApiCursor) {_inherits(WritableBufferedApiCursor, _BufferedApiCursor);function WritableBufferedApiCursor() {_classCallCheck(this, WritableBufferedApiCursor);return _possibleConstructorReturn(this, (WritableBufferedApiCursor.__proto__ || Object.getPrototypeOf(WritableBufferedApiCursor)).apply(this, arguments));}_createClass(WritableBufferedApiCursor, [{ key: 'push', value: function push()

    {for (var _len = arguments.length, objects = Array(_len), _key = 0; _key < _len; _key++) {objects[_key] = arguments[_key];}
      return this[pProvider].push(this[pId], objects);
    } }]);return WritableBufferedApiCursor;}(BufferedApiCursor);exports.




Cursor = Cursor;exports.
ApiCursor = ApiCursor;exports.
BufferedApiCursor = BufferedApiCursor;exports.
WritableBufferedApiCursor = WritableBufferedApiCursor;