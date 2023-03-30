const Factory = require('./factory'),
      { Operation } = require('./operation'),
      { promised } = require('../../../utils')

class DeleteManyOperation extends Operation {

  constructor(driver, operationName = 'deleteMany', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const deleteOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { match = {} } = userOptions || {},
          { principal, object } = this.driver

    return promised(object, 'aclDeleteMany', principal, match, deleteOptions)

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    return this.getOutputOptions(
      this.getAllowedOptions(
        ['passive', 'dryRun', 'locale', 'limit'],
        ['grant', 'roles', 'skipAcl', 'disableTriggers'],
        [],
        userOptions, privilegedOptions, internalOptions
      ),
      ['locale', 'passive', 'dryRun', 'grant', 'roles', 'skipAcl', 'disableTriggers'],
      ['limit']
    )

  }

}
Factory.register('deleteMany', DeleteManyOperation)

module.exports = DeleteManyOperation
