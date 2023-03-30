const Factory = require('./factory'),
      { updateToPathOperations } = require('./operation'),
      PatchManyOperation = require('./patchMany')

class UpdateManyOperation extends PatchManyOperation {

  constructor(driver, operationName = 'updateMany', options = {}) {
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
Factory.register('updateMany', UpdateManyOperation)

module.exports = UpdateManyOperation
