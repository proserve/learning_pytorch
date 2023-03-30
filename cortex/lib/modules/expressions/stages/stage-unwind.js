const Stage = require('../stage'),
      { Empty } = require('../expression-utils'),
      { isString } = require('underscore'),
      clone = require('clone'),
      ExpressionRules = require('../expression-rules'),
      { ExpressionFactory, TypeFactory } = require('../factory'),
      Fault = require('cortex-service/lib/fault'),
      { isSet, promised, rBool, array: toArray, isPlainObject } = require('../../../utils'),
      safePathTo = require('../../../classes/pather').sandbox

let Undefined

class Stage$unwind extends Stage {

  _parseStage(value) {

    const Expression$field = ExpressionFactory.get('field')

    if (isString(value)) {
      value = {
        path: value,
        includeArrayIndex: Undefined,
        preserveNullAndEmptyArrays: false
      }
    }

    if (!isPlainObject(value)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$unwind stage expects an object with a path value.`, path: this.fullPath })
    }

    if (!Expression$field.isA(value.path)) {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$unwind stage expects a field name.`, path: `${this.fullPath}.path` })
    }

    if (isSet(value.includeArrayIndex)) {
      ExpressionRules.mustBeUserVariableFormat(this, this, value.includeArrayIndex, `${this.fullPath}.includeArrayIndex`, 'Stage')
      this.registerVariable(value.includeArrayIndex)
    }

    return {
      path: value.path.slice(1),
      includeArrayIndex: value.includeArrayIndex,
      preserveNullAndEmptyArrays: rBool(value.preserveNullAndEmptyArrays, false)
    }

  }

  async _next(ec, next) {
    return next
  }

  async _createInputCursor(ec, { input }) {

    const cursor = TypeFactory.create('Cursor').cast(input),
          inputCursor = await super._createOutputCursor(ec, { input: cursor }),
          _next = inputCursor._next,
          { value: { path, includeArrayIndex, preserveNullAndEmptyArrays } } = this

    let currentDoc = Undefined,
        currentArray = Undefined,
        currentIndex = 0

    inputCursor._next = callback => {

      return Promise.resolve(null)
        .then(async() => {

          let result = Empty

          if (currentDoc === Undefined) {
            currentDoc = await promised(inputCursor, _next)
            if (currentDoc === Empty) {
              currentDoc = Undefined
            } else if (currentDoc === Undefined) {
              result = Undefined
            }
            currentArray = Undefined
          }

          if (currentDoc !== Undefined) {

            if (currentArray === Undefined) {

              currentArray = toArray(await ec.readObject(currentDoc, path), true)
              currentIndex = 0

              if (currentArray.length === 0) {
                if (preserveNullAndEmptyArrays) {
                  currentArray = [Undefined]
                } else {
                  currentDoc = Undefined
                }
              }

            } else if (currentIndex >= currentArray.length) {

              currentDoc = Undefined

            } else {

              const value = currentArray[currentIndex],
                    hasValue = isSet(value)

              if (hasValue || preserveNullAndEmptyArrays) {

                result = clone(currentDoc)
                try {
                  safePathTo(result, path, value)
                } catch (e) { void e }

                if (includeArrayIndex) {
                  try {
                    safePathTo(result, includeArrayIndex, currentIndex)
                  } catch (e) { void e }
                }

              }
              currentIndex += 1
            }

          }

          return result

        })
        .then(result => callback(null, result))
        .catch(callback)

    }

    return inputCursor

  }

}

module.exports = Stage$unwind
