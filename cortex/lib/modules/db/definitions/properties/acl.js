const lazy = require('cortex-service/lib/lazy-loader').from({
  AclDefinition: `${__dirname}/../acl-definition`
})

// Merges with runtime acl to increase access to this property.
// Additive only, these entries cannot lessen access for the calling principal
module.exports = {
  definition: () => new lazy.AclDefinition({
    label: 'Acl',
    name: 'acl',
    type: 'Document',
    readable: true,
    writable: true,
    array: true,
    maxItems: 20,
    canPush: true,
    canPull: true,
    includeId: true,
    withExpressions: true
  })
}
