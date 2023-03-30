'use strict';var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var _module$exports =

module.exports,iface = _module$exports.iface,_endpoints = _module$exports.endpoints,call = _module$exports.call,list = _module$exports.list,apiRun = _module$exports.apiRun,apiList = _module$exports.apiList,_require =
require('stream'),OpaqueStream = _require.OpaqueStream,_require2 =
require('util.cursor'),ApiCursor = _require2.ApiCursor,
pName = Symbol('pName');

function callService(name, method, path, options) {

  var result = call(name, method, path, options);
  if (result && result._id && result.object === 'stream') {
    result = new OpaqueStream(result);
  } else if (result && result._id && result.object === 'cursor') {
    result = new ApiCursor(result);
  }
  return result;

}var

Service = function () {

  function Service(name) {_classCallCheck(this, Service);
    this[pName] = name;
  }_createClass(Service, [{ key: 'interface', value: function _interface()

    {
      return iface(this[pName]);
    } }, { key: 'endpoints', value: function endpoints()

    {
      return _endpoints(this[pName]);
    } }, { key: 'get', value: function get(

    path, options) {
      return callService(this[pName], 'get', path, options);
    } }, { key: 'head', value: function head(

    path, options) {
      return callService(this[pName], 'head', path, options);
    } }, { key: 'post', value: function post(

    path, body, options) {
      return callService(this[pName], 'post', path, _extends({ body: body }, options));
    } }, { key: 'put', value: function put(

    path, body, options) {
      return callService(this[pName], 'put', path, _extends({ body: body }, options));
    } }, { key: 'patch', value: function patch(

    path, body, options) {
      return callService(this[pName], 'patch', path, _extends({ body: body }, options));
    } }, { key: 'delete', value: function _delete(

    path, options) {
      return callService(this[pName], 'delete', path, options);
    } }]);return Service;}();var



ApiService = function (_Service) {_inherits(ApiService, _Service);

  function ApiService() {_classCallCheck(this, ApiService);return _possibleConstructorReturn(this, (ApiService.__proto__ || Object.getPrototypeOf(ApiService)).call(this,
    'api'));
  }_createClass(ApiService, [{ key: 'list', value: function list()

    {
      return apiList();
    } }, { key: 'run', value: function run()

    {
      return apiRun.apply(undefined, arguments);
    } }]);return ApiService;}(Service);



module.exports = Object.assign(new Proxy({}, {

  get: function get(target, property) {
    if (!(property in target)) {
      target[property] = property === 'api' ? new ApiService() : new Service(property);
    }
    return target[property];
  } }),

{

  list: list,
  callService: callService });