const Factory = require('./factory'),
      { updateToPathOperations } = require('./operation'),
      PatchOneOperation = require('./patchOne')

class UpdateOneOperation extends PatchOneOperation {

  constructor(driver, operationName = 'updateOne', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const { update } = userOptions || {}

    return super._execute(
      { ...userOptions, ops: updateToPathOperations(update), update: null },
      privilegedOptions,
      internalOptions
    )
  }

}
Factory.register('updateOne', UpdateOneOperation)

module.exports = UpdateOneOperation
