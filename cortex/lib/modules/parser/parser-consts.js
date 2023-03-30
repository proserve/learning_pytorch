'use strict'

const BATCH_LIMIT = 20,
      MAX_STAGES = 20,
      MAX_EXPRESSION_DEPTH = 20,
      MAX_EXPRESSION_KEYS = 100,
      MAX_$IN_ELEMENTS = 10000,
      MAX_$ALL_ELEMENTS = 10000,
      MAX_LOGICAL_CONDITIONS = 100,
      MAX_REGEXP_LENGTH = 255,
      MAX_SKIP = 500000,
      MAX_LIMIT = 500000,
      FIELD_NAME_REGEX = /^[a-zA-Z0-9-_]{1,40}$/,
      FIELD_PATH_REGEX = /^[a-zA-Z0-9-_.]{1,200}$/,
      VARIABLE_REGEX = /^\{{2}([a-zA-Z0-9-_.]{1,100})\}{2}$/

class ParserConsts {

  constructor() {
    throw new Error('unusable static class')
  }

  static get BATCH_LIMIT() { return BATCH_LIMIT }
  static get MAX_STAGES() { return MAX_STAGES }
  static get MAX_EXPRESSION_DEPTH() { return MAX_EXPRESSION_DEPTH }
  static get MAX_EXPRESSION_KEYS() { return MAX_EXPRESSION_KEYS }
  static get MAX_$IN_ELEMENTS() { return MAX_$IN_ELEMENTS }
  static get MAX_$ALL_ELEMENTS() { return MAX_$ALL_ELEMENTS }
  static get MAX_LOGICAL_CONDITIONS() { return MAX_LOGICAL_CONDITIONS }
  static get MAX_REGEXP_LENGTH() { return MAX_REGEXP_LENGTH }
  static get MAX_SKIP() { return MAX_SKIP }
  static get MAX_LIMIT() { return MAX_LIMIT }
  static get FIELD_NAME_REGEX() { return FIELD_NAME_REGEX }
  static get FIELD_PATH_REGEX() { return FIELD_PATH_REGEX }
  static get VARIABLE_REGEX() { return VARIABLE_REGEX }

  static get Expression() { return 1 }
  static get Simple() { return 2 }
  static get Property() { return 3 }
  static get Variable() { return 4 }
  static get Array() { return 5 }
  static get Raw() { return 6 }

}

module.exports = ParserConsts
