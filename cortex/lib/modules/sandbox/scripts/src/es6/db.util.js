
/* global script */

const { create } = require('db.factory'),
      { pick } = require('lodash.core')

function createOperation(userOptions = {}, privilegedOptions = {}) {

  const { object, operation } = userOptions,
        isCursor = operation === 'cursor',
        op = create(
          isCursor ? (userOptions.pipeline ? 'aggregate' : 'find') : operation,
          object
        )

  return op.setOptions(userOptions, privilegedOptions)

}

function getAllowedOptions(userPool = [], privilegedPool = [], userOptions = {}, privilegedOptions = {}) {

  const { principal: { privileged } } = script

  return {
    ...(pick(userOptions, ...userPool)),
    ...(pick(privileged ? { ...userOptions, ...privilegedOptions } : privilegedOptions, ...privilegedPool))
  }
}

export {
  createOperation,
  getAllowedOptions
}
