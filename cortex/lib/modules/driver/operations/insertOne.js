const Factory = require('./factory'),
      { Operation, getBooleanOption } = require('./operation'),
      ReadOneOperation = require('./readOne'),
      _ = require('underscore'),
      { promised } = require('../../../utils')

class InsertOneOperation extends Operation {

  constructor(driver, operationName = 'insertOne', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const insertOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { document } = userOptions || {},
          { principal, object } = this.driver,
          { ac, modified } = await promised(object, 'aclCreate', principal, _.isObject(document) ? document : {}, insertOptions)

    if (insertOptions.withRead) {

      const { subject } = ac,
            { dryRun } = insertOptions,
            readOperation = new ReadOneOperation(this.driver, 'readOne', { parent: this }),
            { lean } = userOptions || {},
            where = { _id: subject._id }

      return readOperation.execute({ ...userOptions, where }, privilegedOptions, { ...internalOptions, dryRun, subject, modified, lean })
    }

    return { ac, modified }

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const allowedOptions = this.getAllowedOptions(
            ['passive', 'dryRun', 'locale'],
            ['bypassCreateAcl', 'isUnmanaged', 'disableTriggers', 'grant', 'roles'],
            ['withRead'],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            ['locale', 'passive', 'dryRun', 'grant', 'roles', 'bypassCreateAcl', 'isUnmanaged', 'disableTriggers'],
            ['']
          )

    outputOptions.withRead = getBooleanOption(allowedOptions.withRead, true)

    return outputOptions

  }

}
Factory.register('insertOne', InsertOneOperation)

module.exports = InsertOneOperation
