const Factory = require('./factory'),
      { Operation, getBooleanOption } = require('./operation'),
      ReadOneOperation = require('./readOne'),
      { promised, array: toArray, isSet } = require('../../../utils')

class PatchOneOperation extends Operation {

  constructor(driver, operationName = 'patchOne', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    let { match, ops } = userOptions || {},
        { match: computedMatch, path: computedPath } = this.computeMatchAndPathOptions(match, userOptions)

    const patchOptions = this.getOptions({ ...userOptions, path: computedPath }, privilegedOptions, internalOptions),
          { principal, object } = this.driver,
          { ac, modified } = await promised(object, 'aclPatch', principal, computedMatch, toArray(ops, isSet(ops)), patchOptions)

    if (patchOptions.withRead) {

      const { subject } = ac,
            { path } = patchOptions,
            { dryRun } = patchOptions,
            readOperation = new ReadOneOperation(this.driver, 'readOne', { parent: this }),
            { lean } = userOptions || {},
            where = { _id: subject._id }

      return readOperation.execute({ ...userOptions, path, where }, privilegedOptions, { ...internalOptions, dryRun, subject, modified, lean })

    }

    return { ac, modified }

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const allowedOptions = this.getAllowedOptions(
            ['path', 'passive', 'dryRun', 'locale', 'mergeDocuments'],
            ['grant', 'roles', 'isUnmanaged', 'disableTriggers'],
            ['singlePath', 'withRead'],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            ['locale', 'passive', 'dryRun', 'grant', 'roles', 'mergeDocuments', 'path', 'isUnmanaged', 'disableTriggers'],
            ['singlePath']
          )

    outputOptions.withRead = getBooleanOption(allowedOptions.withRead, true)

    return outputOptions

  }

}
Factory.register('patchOne', PatchOneOperation)

module.exports = PatchOneOperation
