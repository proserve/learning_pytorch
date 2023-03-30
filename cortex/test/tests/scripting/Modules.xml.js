'use strict'

module.exports = {

  main: function() {

    const xml = require('xml'),
          circular = {},
          b = {},
          doc = xml.toXml({ something: 'gouda' })

    circular.b = b
    b.a = circular

    try {
      xml.toJs(null)
    } catch (err) {}

    try {
      xml.toXml(circular)
    } catch (err) {}

    try {
      xml.toXml({}, { doctype: circular })
    } catch (err) {}

    xml.toJs(doc)

    return true

  }

}

const wrapper = require('../../lib/wrapped_sandbox')
describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
