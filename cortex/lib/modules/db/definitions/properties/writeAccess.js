const acl = require('../../../../acl'),
      { capitalize } = require('inflection'),
      { rString } = require('../../../../utils'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        PropertyDefinition: `${__dirname}/../property-definition`
      })

let Undefined

module.exports = {
  definition: () => ({
    label: 'Write Access',
    name: 'writeAccess',
    type: 'Number',
    // description: 'The level of context access required to update this property.',
    readable: true,
    writable: true,
    writer: function(ac, node, value) {
      return acl.fixAllowLevel(value, false, value)
    },
    default: acl.AccessLevels.Update,
    validators: [{
      name: 'required'
    }, {
      name: 'numberEnum',
      definition: {
        values: [acl.Inherit].concat(acl.VisibleAllowLevels)
      }
    }],
    export: async function(ac, input, resourceStream, parentPath, options) {
      const value = await lazy.PropertyDefinition.prototype.export.call(this, ac, input, resourceStream, parentPath, options)
      return value === Undefined ? value : rString(acl.AccessLevelsLookup[value], '').toLowerCase()
    },
    import: async function(ac, input, resourceStream, parentPath, options) {
      const value = await lazy.PropertyDefinition.prototype.import.call(this, ac, input, resourceStream, parentPath, options)
      return value === Undefined ? value : acl.AccessLevels[capitalize(value)]
    }
  })
}
