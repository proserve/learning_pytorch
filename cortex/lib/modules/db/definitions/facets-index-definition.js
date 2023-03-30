const AnyDefinition = require('./types/any-definition')

module.exports = class FacetsIndexDefinition extends AnyDefinition {

  constructor(options) {

    options = options || {}
    options.type = 'Any'
    options.public = false
    options.readable = false
    options.writable = false
    options.uniqueValues = false
    options.serializeData = false
    options.maxItems = -1

    super(options)

    this.array = true // really need to force this here.

  }

}
