/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values')

class SkipStage extends ParserStage {

  static get type() { return '$skip' }

  static get indexable() { return false }

  normalize(expression) {
    if (_.isString(expression)) {
      try {
        expression = JSON.parse(expression)
      } catch (e) {
        var fault = Fault.create('cortex.invalidArgument.stageJSONFormat', { path: this.type })
        fault.add(e)
        throw fault
      }
    }
    return expression
  }

  parseOperator($skip, skip) {
    const parser = this.parser
    skip = utils.rInt(skip, -1)
    if (skip < 0 || (!parser.relax && skip > ParserConsts.MAX_SKIP)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'skip query option must be an integer between 0 and ' + ParserConsts.MAX_SKIP + ', inclusive' })
    }
    return new ParserValues.Simple(this, skip)
  }

}

ParserStage.register(SkipStage)
