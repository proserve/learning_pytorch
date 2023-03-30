const Factory = require('./factory'),
      { Operation } = require('./operation'),
      { promised } = require('../../../utils')

class DeleteOneOperation extends Operation {

  constructor(driver, operationName = 'deleteOne', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const deleteOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { match } = userOptions || {},
          { principal, object } = this.driver

    return (await promised(object, 'aclDelete', principal, match, deleteOptions)) > 0

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    return this.getOutputOptions(
      this.getAllowedOptions(
        ['passive', 'dryRun', 'locale'],
        ['grant', 'roles', 'disableTriggers'],
        [],
        userOptions, privilegedOptions, internalOptions
      ),
      ['locale', 'passive', 'dryRun', 'grant', 'roles', 'disableTriggers'],
      []
    )

  }

}
Factory.register('deleteOne', DeleteOneOperation)

module.exports = DeleteOneOperation
