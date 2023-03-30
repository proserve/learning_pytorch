const Factory = require('./factory'),
      { Operation } = require('./operation'),
      { promised, array: toArray } = require('../../../utils')

class InsertManyOperation extends Operation {

  constructor(driver, operationName = 'insertMany', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const insertOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { documents } = userOptions || {},
          { principal, object } = this.driver

    return promised(object, 'aclCreateMany', principal, toArray(documents, documents), insertOptions)

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    return this.getOutputOptions(
      this.getAllowedOptions(
        ['passive', 'dryRun', 'locale'],
        ['bypassCreateAcl', 'isUnmanaged', 'disableTriggers', 'grant', 'roles'],
        [],
        userOptions, privilegedOptions, internalOptions
      ),
      ['locale', 'passive', 'dryRun', 'grant', 'roles', 'bypassCreateAcl', 'isUnmanaged', 'disableTriggers'],
      []
    )

  }

}
Factory.register('insertMany', InsertManyOperation)

module.exports = InsertManyOperation
