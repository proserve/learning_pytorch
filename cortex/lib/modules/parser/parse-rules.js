'use strict'

const _ = require('underscore'),
      utils = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ParserConsts = require('./parser-consts')

/**
 * these rules are applied to operators in the parsing stage, prior to creating values.
 */

class ParserRules {

  constructor() {
    throw new Error('unusable class')
  }

  static valueMustBeSimpleOrPrimitiveOrEmpty(component, operator, value, variable) {
    if (!variable && ((_.isArray(value) && value.length > 0) || (utils.isPlainObject(value) && Object.keys(value).length > 0))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' expects a primitive value for property.', path: component.fullpath })
    }
  }

  static valueMustBeSimpleOrPrimitive(component, operator, value, variable) {
    if (!variable && (_.isArray(value) || utils.isPlainObject(value))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' expects a primitive value for property.', path: component.fullpath })
    }
  }

  static valueMustBePropertyPath(component, operator, value, variable) {
    if (!variable) {
      if (!_.isString(value) || value !== utils.normalizeObjectPath(value, true, true, true)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' expects a valid property path.', path: component.fullpath })
      }
    }
  }

  static valueMustBePropertyPathIfString(component, operator, value, variable) {
    if (!variable && _.isString(value)) {
      if (value !== utils.normalizeObjectPath(value, true, true, true)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' expects a valid property path.', path: component.fullpath })
      }
    }
  }

  static valueMustBeObject(component, operator, value, variable) {
    if (!variable && !utils.isPlainObject(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' expects an object.', path: component.fullpath })
    }
  }

  static parentMustBeProperty(component, operator, value, variable) {

    const c = component.parentComponent
    if (!c || c.isOperator) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' must have a property as a direct parent.', path: component.fullpath })
    }

  }

  static parentMustBePropertyOr$all(component, operator, value, variable) {

    const c = component.parentComponent
    if (!c || (c.isOperator && c.key !== '$all')) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' must have a property or $elemMatch as a direct parent.', path: component.fullpath })
    }
  }

  static upstreamMustBePropertyOr$allOr$elemMatch(component, operator, value, variable) {

    const allowed = ['$all', '$elemMatch']
    let c = component.parentComponent
    while (c) {
      if (!c.isOperator) {
        return
      } else if (!~allowed.indexOf(c.key)) {
        break
      }
      c = component.parentComponent
    }
    throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' must be applied to a property or within $all or $elemMatch expressions.', path: component.fullpath })

  }

  static mustBeArray(component, operator, value, variable) {

    if (!variable) {
      if (!_.isArray(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' requires an array.', path: component.fullpath })
      }
    }

  }

  static mustBeArrayOfMax$inElements(component, operator, value, variable) {

    if (!variable) {
      if (!_.isArray(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: `Operator ${operator} expects an array of values for property.`, path: component.fullpath })
      }

      if (!component.parser.relax && value.length > ParserConsts.MAX_$IN_ELEMENTS) {
        throw Fault.create('cortex.invalidArgument.query', { reason: `Operator ${operator} expects an array with a maximum of ${ParserConsts.MAX_$IN_ELEMENTS} values.`, path: component.fullpath })
      }
    }

  }

  static mustBeTopLevelOrInside$orOr$andOr$elemMatch(component, operator, value, variable) {

    // these can only be nested within other logical operators unless they are on top.
    const allowed = ['$and', '$or', '$elemMatch'],
          parentComponent = component.parentComponent

    if (parentComponent && !parentComponent.isRoot && !(parentComponent.isOperator && ~allowed.indexOf(parentComponent.key))) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' can only be nested within $and/$or/$elemMatch.', path: component.fullpath })
    }
  }

  static mustBeArrayOfObjectsFromOneToMaxConditionsInLength(component, operator, value, variable) {

    if (!variable) {
      if (!_.isArray(value)) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' value must be an array.', path: component.fullpath })
      }
      if (value.length === 0) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' must contain at least 1 element.', path: component.fullpath })
      }
      if (!component.parser.relax && value.length > ParserConsts.MAX_LOGICAL_CONDITIONS) {
        throw Fault.create('cortex.invalidArgument.query', { reason: 'Maximum ' + operator + ' count (' + ParserConsts.MAX_LOGICAL_CONDITIONS + ') exceeded.', path: component.fullpath })
      }

      value.forEach(function(value) {
        if (!utils.isPlainObject(value)) {
          throw Fault.create('cortex.invalidArgument.query', { reason: 'Operator ' + operator + ' elements must be objects.', path: component.fullpath })
        }
      })
    }
  }

  static tplMustBeArrayOfSize(size) {
    return function(component, operator, value, variable) {
      if (!variable) {
        if (!_.isArray(value) || value.length !== size) {
          throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' requires an array with exactly ' + size + ' elements.', path: component.fullpath })
        }
      }
    }
  }

  static tplMustBeArrayOfAtLeastSize(size) {
    return function(component, operator, value, variable) {
      if (!variable) {
        if (!_.isArray(value) || value.length < size) {
          throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' requires an array with at least ' + size + ' elements.', path: component.fullpath })
        }
      }
    }
  }

  static tplMustBeArrayOfLengthBetween(min, max) {
    return function(component, operator, value, variable) {
      if (!variable) {
        if (!_.isArray(value) || value.length < min || value.length > max) {
          throw Fault.create('cortex.invalidArgument.query', { reason: operator + ' requires an array with ' + min + ' to ' + max + ' elements.', path: component.fullpath })
        }
      }
    }
  }

  // ---------

  static validateRegExp(component, pattern) {
    let match, regexp
    if (_.isRegExp(pattern)) {
      return pattern
    }
    if (!_.isString(pattern) || pattern.length === 0 || (!component.parser.relax && pattern.length > ParserConsts.MAX_REGEXP_LENGTH)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Pattern (' + pattern + ') for $regex must be a string between 1 and ' + ParserConsts.MAX_REGEXP_LENGTH + ' characters.', path: component.fullpath })
    }
    if (!(match = pattern.match(/^\/(.*)\/(.*)/)) || match[0].length === 0) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid operator $regex pattern: ' + pattern, path: component.fullpath })
    }
    try {
      regexp = new RegExp(match[1], match[2])
      ''.match(regexp)
    } catch (e) {
      throw Fault.create('cortex.invalidArgument.query', { reason: 'Invalid operator $regex pattern: ' + pattern, path: component.fullpath })
    }
    return regexp
  };

}

module.exports = ParserRules
