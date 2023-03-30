const { isString, isDate, isRegExp } = require('underscore'),
      { isPrimitive, isSet } = require('cortex-service/lib/utils/values'),
      { isPlainObject } = require('cortex-service/lib/utils/objects'),
      { isId } = require('cortex-service/lib/utils/ids'),
      { TypeFactory } = require('./factory'),
      hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k),
      markedLiterals = new WeakSet()

let Undefined

class Empty {

  static toJSON() {
    return null
  }

}

function isLiteral(value) {

  if (isPrimitive(value)) {
    return !isString(value) || value[0] !== '$'
  } else if (isDate(value)) {
    return true
  } else if (isId(value)) {
    return true
  } else if (value instanceof RegExp) {
    return true
  } else if (Buffer.isBuffer(value)) {
    return true
  } else if (!isSet(value)) {
    return true
  }
  return false

}

function isIterable(value) {

  if (!isSet(value)) {
    return false
  }

  return typeof value[Symbol.iterator] === 'function' || value[Symbol.asyncIterator] === 'function'
}

function setArray(array) {
  return array.reduce(function(target, entry) {
    const exists = target.find(item => TypeFactory.guess(item).equals(item, entry, { cast: false, strict: true }))
    if (!exists) {
      target.push(entry)
    }
    return target
  }, [])
}

function getPlainObjectWithSingleKey(obj, key = Undefined) {

  if (isPlainObject(obj)) {
    const keys = Object.keys(obj)
    if (keys.length === 1 &&
      (
        key === Undefined ||
        (isRegExp(key) && key.test(keys[0])) ||
        hasOwn(obj, key)
      )) {
      return keys[0]
    }
  }
  return Undefined

}

function isLiteralObject(value) {

  return !!(isPlainObject(value) && !getPlainObjectWithSingleKey(value, /^\$/))

}

function isLiteralArray(value) {

  return Array.isArray(value)

}

function literalObjectOrArrayToExpression(value, asLiteral = false) {

  if (isLiteralArray(value)) {
    return { [asLiteral ? '$literal' : '$array']: value }
  } else if (isLiteralObject(value)) {
    return { [asLiteral ? '$literal' : '$object']: value }
  }
  return value

}

function markLiteralObject(v) {
  if (v && typeof v === 'object') {
    markedLiterals.add(v)
  }
  return v
}

function isMarkedAsLiteralObject(v) {
  return v && typeof v === 'object' && markedLiterals.has(v)
}

module.exports = {
  isLiteral,
  isIterable,
  setArray,
  Empty,
  isLiteralObject,
  isLiteralArray,
  getPlainObjectWithSingleKey,
  literalObjectOrArrayToExpression,
  markLiteralObject,
  isMarkedAsLiteralObject
}
