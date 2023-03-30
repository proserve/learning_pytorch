'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.Driver = undefined;var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();var _db = require('db.cursor');
var _db2 = require('db.operation');function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}












var pObjectName = Symbol('objectName'),
pThrough = Symbol('through');var

Driver = function () {

  function Driver(objectName) {_classCallCheck(this, Driver);
    this[pObjectName] = objectName;
  }_createClass(Driver, [{ key: 'through', value: function through(

    _through) {
      this[pThrough] = _through;
      return this;
    } }, { key: 'aggregate', value: function aggregate()

    {var pipeline = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      if (!Array.isArray(pipeline)) {
        throw new TypeError('aggregate expects array pipeline');
      }
      var v = new _db.AggregationCursor(this[pObjectName], pipeline);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'count', value: function count(

    where) {
      var v = new _db2.CountOperation(this[pObjectName], where).execute();
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'deleteMany', value: function deleteMany(

    match) {
      var v = new _db2.DeleteManyOperation(this[pObjectName], match);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'deleteOne', value: function deleteOne(

    match) {
      var v = new _db2.DeleteOperation(this[pObjectName], match);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'find', value: function find(

    where) {
      var v = new _db.QueryCursor(this[pObjectName], where);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'readOne', value: function readOne(

    where) {
      var v = new _db2.ReadOneOperation(this[pObjectName], where);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'insertMany', value: function insertMany()

    {var docs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var v = new _db2.InsertManyOperation(this[pObjectName], docs);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'insertOne', value: function insertOne()

    {var doc = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var v = new _db2.InsertOperation(this[pObjectName], doc);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'updateOne', value: function updateOne(

    match, doc) {
      var v = new _db2.UpdateOperation(this[pObjectName], match, doc);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'updateMany', value: function updateMany(

    match, doc) {
      var v = new _db2.UpdateManyOperation(this[pObjectName], match, doc);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'patchOne', value: function patchOne(

    match, doc) {
      var v = new _db2.PatchOperation(this[pObjectName], match, doc);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }, { key: 'patchMany', value: function patchMany(

    match, doc) {
      var v = new _db2.PatchManyOperation(this[pObjectName], match, doc);
      return this[pThrough] ? v.through(this[pThrough]) : v;
    } }]);return Driver;}();exports.




Driver = Driver;