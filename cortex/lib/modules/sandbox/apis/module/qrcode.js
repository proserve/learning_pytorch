'use strict'

const qrcode = require('qrcode')

module.exports = {

  toDataUrl: function(script, message, data, options) {
    return qrcode.toDataURL(data, options)
  },

  toString: function(script, message, data, options) {
    return qrcode.toString(data, options)
  },
  toFileStream: function(script, message, data, options) {
    return qrcode.toBuffer(data, options)
  }
}
