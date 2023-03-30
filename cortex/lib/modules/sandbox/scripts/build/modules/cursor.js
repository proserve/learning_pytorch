'use strict';try {
  require('logger').warn('The cursor module is deprecated.');
} catch (err) {
}

var objects = require('objects');

module.exports = function Cursor(pluralName, options) {

  if (!(this instanceof Cursor)) {
    return new Cursor(pluralName, options);
  }

  var _cursorId = objects.cursor_open(pluralName, options)._id,
  _batchSize = 10,
  _buffer = [];

  this[Symbol.iterator] = function () {
    var _cursor = this;
    return {
      next: function next() {
        var next = _cursor.next();
        return next ? { value: next, done: false } : { done: true };
      } };

  };


  Object.defineProperties(this, {
    next: {
      value: function value() {
        var next = null;
        if (_buffer.length > 0) {
          next = _buffer.shift();
          if (_buffer.length === 0) {
            _fill.call(this);
          }
        }
        return next;
      } },


    hasNext: {
      value: function value() {
        return _cursorId || _buffer.length > 0;
      } },


    close: {
      value: function value() {
        if (_cursorId) {
          objects.cursor_close(_cursorId);
          _cursorId = null;
        }
      } } });




  function _fill() {
    if (_cursorId) {var _objects$cursor_fetch =
      objects.cursor_fetch(_cursorId, _batchSize),buffer = _objects$cursor_fetch.buffer,hasMore = _objects$cursor_fetch.hasMore;
      _buffer = buffer;
      void hasMore;
      if (_buffer.length === 0 || _buffer.length < _batchSize) {
        this.close();
      }
    }
  }

  _fill.call(this);

};