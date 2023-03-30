const Factory = require('./factory'),
      { Operation, getBooleanOption } = require('./operation'),
      config = require('cortex-service/lib/config'),
      {
        promised,
        clamp,
        rInt,
        rString
      } = require('../../../utils')

class CountOperation extends Operation {

  constructor(driver, operationName = 'count', options = {}) {
    super(driver, operationName, options)
  }

  async _execute(userOptions, privilegedOptions, internalOptions) {

    const cursorOptions = this.getOptions(userOptions, privilegedOptions, internalOptions),
          { principal, object } = this.driver

    return promised(object, 'aclCount', principal, cursorOptions)

  }

  getOptions(userOptions, privilegedOptions, internalOptions) {

    const { principal } = this.driver,
          allowedOptions = this.getAllowedOptions(
            [
              'maxTimeMS', 'crossOrg', 'engine', 'explain',
              'locale', 'accessLevel', 'skip', 'limit', 'where'
            ],
            ['grant', 'roles', 'skipAcl'],
            [],
            userOptions, privilegedOptions, internalOptions
          ),
          outputOptions = this.getOutputOptions(
            allowedOptions,
            ['skipAcl', 'locale', 'grant', 'roles', 'crossOrg'],
            ['limit', 'accessLevel', 'skip', 'where']
          )

    // user options ---------------------------------------

    outputOptions.parserExecOptions = {
      maxTimeMS: clamp(rInt(allowedOptions.maxTimeMS, config('query.defaultMaxTimeMS')), config('query.minTimeMS'), config('query.maxTimeMS')), // legacy default to max.
      explain: principal.isDeveloper() && getBooleanOption(allowedOptions.explain, false),
      engine: rString(allowedOptions.engine)
    }

    return outputOptions

  }

}
Factory.register('count', CountOperation)

module.exports = CountOperation
