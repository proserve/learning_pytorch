'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _require = require('stream'),OpaqueStream = _require.OpaqueStream,
ftp = module.exports,
pConnection = Symbol('connection');

var Undefined = void 0;var

Client = function () {

  function Client() {var connection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Undefined;_classCallCheck(this, Client);
    this[pConnection] = connection;
  }_createClass(Client, [{ key: 'connect', value: function connect(

    options) {
      this.close();
      this[pConnection] = ftp.create(options);
    } }, { key: 'close', value: function close()

    {
      if (this[pConnection]) {
        ftp.instance.close(this[pConnection]);
        this[pConnection] = Undefined;
      }
    } }, { key: 'list', value: function list(

    path) {
      return ftp.instance.list(this[pConnection], path);
    } }, { key: 'get', value: function get(

    path, options) {
      return ftp.instance.get(this[pConnection], path, options);
    } }, { key: 'put', value: function put(

    path, input, options) {
      if (input instanceof OpaqueStream) {
        input = input.getOptions();
      }
      return ftp.instance.put(this[pConnection], path, input, options);
    } }, { key: 'mkdir', value: function mkdir(

    path, recursive) {
      return ftp.instance.mkdir(this[pConnection], path, recursive);
    } }, { key: 'delete', value: function _delete(

    path) {
      return ftp.instance.delete(this[pConnection], path);
    } }, { key: 'rename', value: function rename(

    path, to) {
      return ftp.instance.rename(this[pConnection], path, to);
    } }, { key: 'chmod', value: function chmod(

    path, mode) {
      return ftp.instance.chmod(this[pConnection], path, mode);
    } }, { key: 'toJSON', value: function toJSON()

    {
      return {
        _id: this[pConnection] && this[pConnection]._id,
        object: this[pConnection] && this[pConnection].object || 'connection.ftp' };

    } }]);return Client;}();



module.exports = {

  Client: Client,

  create: function create(options) {
    var client = new Client();
    client.connect(options);
    return client;
  },

  list: function list() {
    return ftp.list().map(function (connection) {return new Client(connection);});
  } };