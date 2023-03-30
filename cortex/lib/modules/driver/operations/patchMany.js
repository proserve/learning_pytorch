const Factory = require('./factory'),
      { Operation } = require('./operation'),
      { promised, array: toArray, isSet } = require('../../../utils')

class PatchManyOperation extends Operation {

  constructor(driver, operationName = 'patchMany', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const patchOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { match, ops } = userOptions || {},
          { principal, object } = this.driver

    return promised(
      object,
      'aclPatchMany',
      principal,
      match || { _id: null },
      toArray(ops, isSet(ops)),
      patchOptions
    )

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    return this.getOutputOptions(
      this.getAllowedOptions(
        ['limit', 'passive', 'dryRun', 'locale', 'mergeDocuments'],
        ['skipAcl', 'grant', 'roles', 'isUnmanaged', 'disableTriggers'],
        [],
        userOptions, privilegedOptions, internalOptions
      ),
      ['locale', 'passive', 'dryRun', 'grant', 'roles', 'mergeDocuments', 'skipAcl', 'isUnmanaged', 'disableTriggers'],
      ['limit']
    )

  }

}
Factory.register('patchMany', PatchManyOperation)

module.exports = PatchManyOperation
