'use strict'

const xml2js = require('xml2js'),
      { rString, rBool, rVal, isCircular } = require('../../../../utils'),
      Fault = require('cortex-service/lib/fault')

module.exports = {

  version: '1.0.0',

  toJs: function(script, message, xml, callback) {

    const options = {
      async: true
    }
    try {
      xml2js.parseString(xml, options, callback)
    } catch (err) {
      callback(err)
    }

  },

  toXml: function(script, message, object, options, callback) {

    options = options || {}
    options = {

      rootName: rString(options['rootElement'], 'root'),
      renderOpts: {
        pretty: rBool(options['prettyPrint'], false),
        indent: rString(options['indent'], '  '),
        newline: rString(options['newline'], '\n')
      },
      xmldec: {
        version: rString(options['version'], '1.0'),
        encoding: rString(options['encoding'], 'UTF-8'),
        standalone: rBool(options['standalone'], true)
      },
      doctype: rVal(options['doctype'], null),
      headless: rBool(options['headless'], false),
      // cdata: rBool(options['cdata'], false),
      cdata: false // xml2js has a bug!
    }

    if (isCircular(options.doctype)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'doctype contains circular references' }))
    }

    if (isCircular(object)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Xml document contains circular references' }))
    }

    let err, xml
    try {
      const builder = new xml2js.Builder(options)
      xml = builder.buildObject(object)
    } catch (e) {
      err = e
    }
    setImmediate(callback, err, xml)
  }

}
