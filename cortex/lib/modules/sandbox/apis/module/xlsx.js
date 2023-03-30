'use strict'

const xlsx = require('xlsx'),
      { isString } = require('underscore')

module.exports = {

  version: '1.0.0',

  to: async function(script, message, format, buffer, params) {

    const { sheet = 0, options = {} } = params || {},
          to = ['csv', 'txt', 'html', 'json'].includes(format) ? format : 'csv',
          book = xlsx.read(buffer, { ...options, type: null }),
          sheetName = isString(sheet) ? sheet : book.SheetNames[sheet],
          sheetDoc = book.Sheets[sheetName]

    return xlsx.utils[`sheet_to_${to}`](sheetDoc, options)

  }

}
