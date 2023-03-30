/* eslint-disable no-use-before-define */

'use strict'

const _ = require('underscore'),
      utils = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('../parser-consts'),
      ParserStage = require('./stage'),
      ParserValues = require('../values')

class LimitStage extends ParserStage {

  static get type() { return '$limit' }

  static get indexable() { return false }

  normalize(expression) {

    if (_.isString(expression)) {
      try {
        expression = JSON.parse(expression)
      } catch (e) {
        expression = null
        var fault = Fault.create('cortex.invalidArgument.query', { reason: 'Invalid ' + this.type + ' JSON format' })
        fault.add(e)
        throw fault
      }
    }
    return expression
  }

  parseOperator($limit, limit) {
    const parser = this.parser
    limit = utils.rInt(limit, 0)
    if (limit < 1 || (!parser.relax && limit > ParserConsts.MAX_LIMIT)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: '$limit must be an integer between 1 and ' + ParserConsts.MAX_LIMIT + ', inclusive' })
    }
    return new ParserValues.Simple(this, limit)
  }

  flattenPaths() {
    return []
  }

}

ParserStage.register(LimitStage)
