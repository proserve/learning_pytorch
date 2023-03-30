/* global ObjectID */

/*
* @author Viacheslav Lotsmanov <lotsmanov89@gmail.com>
* @license MIT
*
* The MIT License (MIT)
*
* Copyright (c) 2013-2015 Viacheslav Lotsmanov
*/

function isSpecificValue(val) {
  return !!((
    val instanceof Buffer ||
        val instanceof Date ||
        val instanceof RegExp ||
        val instanceof ObjectID
  ))
}

function cloneSpecificValue(val) {
  if (val instanceof Buffer) {
    const x = new Buffer(val.length) // eslint-disable-line node/no-deprecated-api
    val.copy(x)
    return x
  } if (val instanceof Date) {
    return new Date(val.getTime())
  } if (val instanceof RegExp) {
    return new RegExp(val)
  } if (val instanceof ObjectID) {
    return new ObjectID(val.toString())
  }
  throw new Error('Unexpected situation')

}

/**
 * Recursive cloning array.
 */
function deepCloneArray(arr) {
  const clone = []
  arr.forEach((item, index) => {
    if (typeof item === 'object' && item !== null) {
      if (Array.isArray(item)) {
        clone[index] = deepCloneArray(item)
      } else if (isSpecificValue(item)) {
        clone[index] = cloneSpecificValue(item)
      } else {
        clone[index] = deepExtend({}, item) // eslint-disable-line no-use-before-define
      }
    } else {
      clone[index] = item
    }
  })
  return clone
}

/**
 * Extending object that entered in first argument.
 *
 * Returns extended object or false if have no target object or incorrect type.
 *
 * If you wish to clone source object (without modify it), just use empty new
 * object as first argument, like this:
 *   deepExtend({}, yourObj_1, [yourObj_N]);
 */
const deepExtend = module.exports = function(/* obj_1, [obj_2], [obj_N] */) {
  if (arguments.length < 1 || typeof arguments[0] !== 'object') {
    return false
  }

  if (arguments.length < 2) {
    return arguments[0]
  }

  let target = arguments[0],
      // convert arguments to array and cut off target object
      args = Array.prototype.slice.call(arguments, 1),
      val,
      src

  args.forEach((obj) => {
    // skip argument if isn't an object, is null, or is an array
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return
    }

    Object.keys(obj).forEach((key) => {
      src = target[key] // source value
      val = obj[key] // new value

      // recursion prevention
      if (val === target) {

        /**
                 * if new value isn't object then just overwrite by new value
                 * instead of extending.
                 */
      } else if (typeof val !== 'object' || val === null) {
        target[key] = val

        // just clone arrays (and recursive clone objects inside)
      } else if (Array.isArray(val)) {
        target[key] = deepCloneArray(val)

        // custom cloning and overwrite for specific objects
      } else if (isSpecificValue(val)) {
        target[key] = cloneSpecificValue(val)

        // overwrite by new value if source isn't object or array
      } else if (typeof src !== 'object' || src === null || Array.isArray(src)) {
        target[key] = deepExtend({}, val)

        // source value and new value is objects both, extending...
      } else {
        target[key] = deepExtend(src, val)

      }
    })
  })

  return target
}
