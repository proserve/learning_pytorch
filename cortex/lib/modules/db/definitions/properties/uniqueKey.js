
const {
        path: pathTo, array: toArray, isSet
      } = require('../../../../utils'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault')

/**
 *
 * NOTE: Object aclInit contains a delete guard for unique key.
 *
 */

module.exports = {
  definition: () => ({
    label: 'Unique key',
    name: 'uniqueKey',
    type: 'String',
    readable: true,
    writable: true,
    trim: true,
    dependencies: ['.properties'],
    default: '',
    onInit: function() {

      const isObject = this.fqpp === 'object.uniqueKey',
            affectedNodes = [
              this.parent.properties.properties.documents.String.properties.validators,
              this.parent.properties.properties.documents.UUID.properties.validators,
              this.parent.properties.properties.documents.String.properties.localization.properties.enabled
            ]

      if (isObject) {
        affectedNodes.push(
          this.parent.properties.properties.documents.String.properties.unique,
          this.parent.properties.properties.documents.UUID.properties.unique
        )
      }

      affectedNodes.forEach(node => {
        const onRemovingValue = node.onRemovingValue
        node.onRemovingValue = (ac, parentDocument, ...args) => {

          const parent = _.isFunction(parentDocument.parent) && parentDocument.parent(),
                { uniqueKey } = parent || {}

          // if there is an unique key set. re-validate.
          if (uniqueKey) {
            parent.markModified('uniqueKey')
          }
          onRemovingValue.call(node, ac, parentDocument, ...args)
        }
      })

    },
    writer: function(ac, node, value) {
      return isSet(value) ? value : ''
    },
    validators: [{
      name: 'string',
      definition: {
        allowNull: false
      }
    }, {
      name: 'adhoc',
      definition: {
        validator: function(ac, node, value) {

          if (value === '') {
            return true
          }

          const isObject = node.fqpp === 'object.uniqueKey',
                configured = {
                  String: {
                    requires: {},
                    validators: ['customName']
                  },
                  UUID: {
                    requires: {},
                    validators: []
                  }
                },
                { properties } = this || {},
                property = Array.isArray(properties) && properties.find(v => v.name === value),
                { type, array, validators, localization } = property || {},
                configuration = configured[type],
                validatorNames = toArray(validators).map(v => v && v.name)

          if (isObject) {
            configured.String.requires.unique = true
            configured.UUID.requires.unique = true
          } else {
            configured.String.validators.push('uniqueInArray')
            configured.UUID.validators.push('uniqueInArray')
          }

          if (isObject && (node.name !== 'uniqueKey' || this.object !== 'object')) {
            throw Fault.create('cortex.invalidArgument.unspecified', 'An unique key can only exist at the top-level.')
          } else if (!isObject && (node.name !== 'uniqueKey' || this.type !== 'Document' || !this.array)) {
            throw Fault.create('cortex.invalidArgument.unspecified', 'An unique key can only exist on document arrays.')
          } else if (!configuration) {
            throw Fault.create('cortex.invalidArgument.unspecified', `An unique key property must be one of: ${Object.keys(configured).sort()}`)
          } else if (array) {
            throw Fault.create('cortex.invalidArgument.unspecified', `An unique key property can't be an array`)
          } else if (_.intersection(validatorNames, configuration.validators).length !== configuration.validators.length) {
            throw Fault.create('cortex.invalidArgument.unspecified', `The unique key property must include these validators: ${configuration.validators}`)
          } else if (pathTo(localization, 'enabled')) {
            throw Fault.create('cortex.invalidArgument.unspecified', `Unique keys cannot be localized`)
          }

          for (let [key, val] of Object.entries(configuration.requires)) {
            if (property[key] !== val) {
              throw Fault.create('cortex.invalidArgument.unspecified', `The unique key "${key}" property must equal "${val}"`)
            }
          }

          return true

        }
      }

    }]
  })
}
