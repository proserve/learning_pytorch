'use strict';function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}}function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var pOptions = Symbol('options');var

ServiceProvider =

function ServiceProvider(options) {_classCallCheck(this, ServiceProvider);
  this[pOptions] = options;
};var



IdentityProvider =

function IdentityProvider(options) {_classCallCheck(this, IdentityProvider);
  this[pOptions] = options;
};



Object.keys(module.exports).forEach(function (method) {

  var moduleFn = module.exports[method];
  if (typeof module.exports[method] === 'function') {
    Object.defineProperty(ServiceProvider.prototype, method, {
      value: function value() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}


        args.forEach(function (v, i, a) {
          if (v instanceof IdentityProvider) {
            a[i] = v[pOptions];
          }
        });
        return moduleFn.apply(undefined, [this[pOptions]].concat(_toConsumableArray(args)));
      } });


  }

});

module.exports = {
  IdentityProvider: IdentityProvider,
  ServiceProvider: ServiceProvider };