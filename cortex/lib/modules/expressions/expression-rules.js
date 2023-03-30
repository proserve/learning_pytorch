
'use strict'

const { isString, isRegExp } = require('underscore'),
      { isPlainObject, isPlainObjectWithSubstance } = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ExpressionConsts = require('./expression-consts'),
      { SystemVariableFactory, ExpressionFactory } = require('./factory')

/**
 * these rules are applied to operators in the parsing stage, prior to creating values.
 */

class ExpressionRules {

  static valueMustBeObject(expression, operator, value, path = expression.fullPath, name = 'Operator') {
    if (!isPlainObject(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${name} ${operator.name} expects an object.`, path })
    }
  }

  static valueMustBeObjectWithSubstance(expression, operator, value, path = expression.fullPath, name = 'Operator') {
    if (!isPlainObjectWithSubstance(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${name} ${operator.name} expects an object with properties.`, path })
    }
  }

  static mustBeUserVariableFormat(expression, operator, value, path = expression.fullPath, name = 'Operator') {

    const variableName = String(value).split('.')[0]

    if (!isString(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${name} ${operator.name} user variable must be a string.`, path })
    } else if (SystemVariableFactory.has(`${variableName}`)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${name} ${operator.name} user variable cannot be a system variable (${variableName}).`, path })
    } else if (variableName !== value || !value.length || value.includes('$')) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `${name} ${operator.name} user variable cannot contain $ and must have length.`, path })
    }

  }

  static mustBeArray(expression, operator, value, path = expression.fullPath) {
    if (!Array.isArray(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: operator.name + ' requires an array.', path })
    }
  }

  static tplMustBeArrayOfSize(size) {
    return function(expression, operator, value, path = expression.fullPath) {

      if (!Array.isArray(value) || value.length !== size) {
        throw Fault.create('cortex.invalidArgument.query', { reason: operator.name + ' requires an array with exactly ' + size + ' elements.', path })
      }

    }
  }

  static tplMustBeArrayOfAtLeastSize(size) {
    return function(expression, operator, value, path = expression.fullPath) {

      if (!Array.isArray(value) || value.length < size) {
        throw Fault.create('cortex.invalidArgument.query', { reason: operator.name + ' requires an array with at least ' + size + ' elements.', path })
      }

    }
  }

  static tplMustBeArrayOfLengthBetween(min, max) {
    return function(expression, operator, value, path = expression.fullPath) {

      if (!Array.isArray(value) || value.length < min || value.length > max) {
        throw Fault.create('cortex.invalidArgument.query', { reason: operator.name + ' requires an array with ' + min + ' to ' + max + ' elements.', path })
      }

    }
  }

  static parseUserVariables(expression, value, path, { register = false } = {}) {

    this.valueMustBeObject(expression, this, value, `${expression.fullPath}.${path}`)

    const vars = {},
          variableNames = Object.keys(value)

    for (const variableName of variableNames) {
      this.mustBeUserVariableFormat(expression, this, variableName, `${expression.fullPath}.${path}`)
      if (register) {
        expression.registerVariable(variableName)
      }
      vars[variableName] = ExpressionFactory.guess(value[variableName], { parent: expression, path: `${path}.${variableName}` })
    }

    return vars

  }

  // ---------

  static validateRegExp(expression, pattern, path = expression.fullPath) {
    let match, regexp
    if (isRegExp(pattern)) {
      return pattern
    }
    if (!isString(pattern) || pattern.length === 0 || (pattern.length > ExpressionConsts.MAX_REGEXP_LENGTH)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Pattern (' + pattern + ') for $regex must be a string between 1 and ' + ExpressionConsts.MAX_REGEXP_LENGTH + ' characters.', path: expression.fullPath })
    }
    if (!(match = pattern.match(/^\/(.*)\/(.*)/)) || match[0].length === 0) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid operator $regex pattern: ' + pattern, path })
    }
    try {
      regexp = new RegExp(match[1], match[2])
      ''.match(regexp)
    } catch (e) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid operator $regex pattern: ' + pattern, path: expression.fullPath })
    }
    return regexp
  };

}

module.exports = ExpressionRules
