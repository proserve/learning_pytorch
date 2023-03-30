'use strict';var _createClass = function () {function defineProperties(target, props) {for (var i = 0; i < props.length; i++) {var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);}}return function (Constructor, protoProps, staticProps) {if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;};}();function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}var pStream = Symbol('stream'),
clone = require('clone');var




OpaqueStream = function () {

  function OpaqueStream() {var remote = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;_classCallCheck(this, OpaqueStream);
    this[pStream] = remote || { object: 'stream', _id: null };
  }_createClass(OpaqueStream, [{ key: 'getOptions', value: function getOptions()

    {
      var options = clone(this[pStream]);
      if (!options.object) {
        options.object = 'stream';
      }
      return options;

    } }]);return OpaqueStream;}();



module.exports = {

  OpaqueStream: OpaqueStream };