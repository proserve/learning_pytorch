'use strict'

const { createId } = require('../../../../utils'),
      modulePrivates = require('../../../../classes/privates').createAccessor()

let Undefined

class OperationResult {

  constructor(data, wrap, output, path) {
    Object.assign(modulePrivates(this), {
      data, wrap, output, path
    })
  }

  toJSON() {

    const { data, wrap, output, path } = modulePrivates(this)

    if (!output) {
      return Undefined
    }
    if (!wrap) {
      return data
    }
    return {
      _id: createId(),
      object: 'operationResult',
      timestamp: Date.now(),
      path: path,
      data
    }
  }

}

module.exports = OperationResult
