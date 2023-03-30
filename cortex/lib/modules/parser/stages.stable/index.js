'use strict'

const ParserStage = require('./stage'),
      fs = require('fs'),
      Fault = require('cortex-service/lib/fault')

fs.readdirSync(__dirname).forEach(file => {
  if (!~['index.js', 'stage.js'].indexOf(file)) {
    require('./' + file)
  }
})

module.exports = {

  create: function(type, parser, expression, options) {

    const Cls = ParserStage.getStageClass(type)
    if (!Cls) {
      throw Fault.create('cortex.invalidArgument.query', '"' + type + '" is not a valid pipeline stage type.')
    }
    let stage = new Cls(parser)
    stage.parse(expression, options)
    return stage
  },

  exists: function(type) {
    return !!ParserStage.getStageClass(type)
  },

  find: function(type) {
    return ParserStage.getStageClass(type)
  }

}
