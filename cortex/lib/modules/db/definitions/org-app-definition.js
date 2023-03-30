const DocumentDefinition = require('./types/document-definition'),
      { naturalCmp, path: pathTo, array: toArray, findIdPos, extend, sortKeys, promised } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      util = require('util'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      modules = require('../../../modules'),
      OrgAppClientDefinition = require('./org-app-client-definition')

let Undefined

function OrgAppDefinition(options) {

  const properties = [{
    label: '_id',
    name: '_id',
    type: 'ObjectId',
    // description: 'The application identifier.',
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }],
    auto: true,
    readable: true
  }, {
    label: 'Deployment Identifiers',
    name: 'did',
    type: 'ObjectId',
    public: false,
    array: true,
    readAccess: acl.AccessLevels.System,
    writeAccess: acl.AccessLevels.System,
    canPush: true,
    writable: true,
    canPull: true

  }, {
    label: 'Label',
    name: 'label',
    type: 'String',
    // description: 'The application label',
    readable: true,
    writable: true,
    acl: acl.Inherit,
    validators: [{
      name: 'required'
    }, {
      name: 'uniqueInArray'
    }, {
      name: 'string',
      definition: { min: 1, max: 100 }
    }]
  }, {
    label: 'Name',
    name: 'name',
    type: 'String',
    dependencies: ['._id'],
    acl: acl.Inherit,
    writable: true,
    trim: true,
    writer: function(ac, node, value) {
      return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(value))
    },
    validators: [{
      name: 'customName'
    }, {
      name: 'uniqueInArray'
    }]
  }, {
    label: 'Enabled',
    name: 'enabled',
    type: 'Boolean',
    // description: 'Set to true to enable all application clients access to the api.',
    readable: true,
    writable: true,
    default: false,
    acl: acl.Inherit
  }, {
    label: 'Android GCM',
    name: 'GCM',
    type: 'Document',
    // description: 'Android Push Notification service settings.',
    writable: true,
    acl: acl.Inherit,
    properties: [{
      label: 'API Key',
      name: 'apiKey',
      type: 'String',
      // description: 'the Api Key',
      readable: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'printableString',
        definition: { min: 0, max: 100 }
      }]
    }]
  }, {
    label: 'Firebase FCM',
    name: 'FCM',
    type: 'Document',
    // description: 'Android Push Notification service settings.',
    writable: true,
    acl: acl.Inherit,
    properties: [{
      label: 'API Key',
      name: 'apiKey',
      type: 'String',
      // description: 'the Api Key',
      readable: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'printableString',
        definition: { min: 0, max: 1000 }
      }]
    }]
  }, {
    label: 'Tencent Push Notification Service',
    name: 'TPNS',
    type: 'Document',
    // description: 'Tencent Push Notification Service settings.',
    writable: true,
    acl: acl.Inherit,
    properties: [{
      label: 'Application ID',
      name: 'accessId',
      type: 'String',
      // description: 'the application ID',
      readable: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'printableString',
        definition: { min: 0, max: 1000 }
      }]
    }, {
      label: 'Secret Key',
      name: 'secretKey',
      type: 'String',
      // description: 'the application secret key',
      readable: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'printableString',
        definition: { min: 0, max: 1000 }
      }]
    }]
  }, {
    label: 'Apns',
    name: 'APNs',
    type: 'Document',
    // description: 'Apple Push Notification service settings.',
    writable: true,
    acl: acl.Inherit,
    properties: [{
      label: 'APN Bundle Id',
      name: 'bundleId',
      type: 'String',
      // description: 'BundleId is used when using the new APNS message format. Requires bundle ID of the application',
      readable: true,
      writable: true,
      acl: acl.Inherit
    }, {
      label: 'Debug',
      name: 'debug',
      type: 'Boolean',
      // description: 'Set to true use Apple\'s debug gateway.',
      readable: true,
      writable: true,
      default: false,
      acl: acl.Inherit
    }, {
      label: 'Certificate',
      name: 'cert',
      type: 'String',
      // description: 'The app\'s Apple Push Notification service certificate, in PEM format.',
      readable: true,
      writable: true,
      trim: true,
      acl: acl.Inherit,
      validators: [{
        name: 'adhoc',
        definition: {
          code: 'cortex.invalidArgument.certificateOrKeyFormat',
          message: 'Invalid APN certificate format',
          validator: function(ac, node, value) {
            function endsWith(str, suffix) {
              return str.indexOf(suffix, str.length - suffix.length) !== -1
            }
            if (_.isString(value)) {
              const begin = '-----BEGIN CERTIFICATE-----', end = '-----END CERTIFICATE-----'
              if (value.length === 0) {
                return true
              } else if (value.indexOf(begin) === 0 && endsWith(value, end)) {
                const base64 = value.substr(begin.length, value.length - (begin.length + end.length)).replace(/\r\n|\n|\r/gm, '')
                return !!base64.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/)
              }
            }
            return false
          }
        }
      }]
    }, {
      label: 'Private Key',
      name: 'key',
      type: 'String',
      // description: 'The app\'s Apple Push Notification service private key, in PEM format',
      readable: true,
      trim: true,
      writable: true,
      acl: acl.Inherit,
      validators: [{
        name: 'adhoc',
        definition: {
          code: 'cortex.invalidArgument.certificateOrKeyFormat',
          message: 'Invalid APN key format',
          validator: function(ac, node, value) {
            if (_.isString(value)) {
              if (value.length === 0) {
                return true
              } else {
                const begin = toArray(value.match(/^-----BEGIN (RSA\s)?PRIVATE KEY-----/))[0],
                      end = toArray(value.match(/-----END (RSA\s)?PRIVATE KEY-----$/))[0]
                if (begin && end) {
                  const base64 = value.substr(begin.length, value.length - (begin.length + end.length)).replace(/\r\n|\n|\r/gm, '')
                  return !!base64.match(/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/)
                }
              }
            }
            return false
          }
        }
      }]
    }]
  }, {
    label: 'Suspended',
    name: 'suspended',
    type: 'Boolean',
    // description: 'True if application access has been suspended',
    writeAccess: acl.AccessLevels.System,
    readable: true,
    writable: true,
    default: false,
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: acl.AccessLevels.Read }]
  }, new OrgAppClientDefinition({
    label: 'Clients',
    name: 'clients',
    type: 'Document',
    // description: 'The Application\'s configured clients.',
    dependencies: ['configuration.maxKeysPerApp'],
    array: true,
    readable: true,
    canPull: true,
    canPush: true,
    acl: [{ type: acl.AccessTargets.OrgRole, target: acl.OrgDeveloperRole, allow: (config('app.env') === 'development' ? acl.AccessLevels.Update : acl.AccessLevels.Read) }],
    pusher: function(ac, node, values) {
      if (!ac.principal.isSysAdmin()) {
        if (values.length + toArray(pathTo(this, node.path)).length > ac.subject.configuration.maxKeysPerApp) {
          throw Fault.create('cortex.accessDenied.unspecified', { resource: ac.getResource(), reason: 'You have reached the maximum of ' + ac.subject.configuration.maxKeysPerApp + ' clients per application', path: node.fullpath })
        }
      }
      return values
    },
    puller: function(ac, node, value) {
      const clientIdx = findIdPos(this.clients, '_id', value)
      let app = null, appIdx = -1, clientPath = null
      if (~clientIdx) {
        app = ac.subject.apps.find(app => ~findIdPos(app.clients, '_id', value))
        if (app) {
          appIdx = findIdPos(ac.subject.apps, '_id', app._id)
        }
      }
      if (~appIdx) {
        clientPath = `apps.${appIdx}.clients`
      }
      ac.hook('save').before(function(vars, callback) {
        if (~vars.modified.indexOf(clientPath)) {
          if (!~toArray(pathTo(ac.subject, node.fullpath)).indexOf(value)) {
            return ac.object.fireHook('client.removed.before', null, { ac: ac, clientId: value }, callback)
          }
        }
        callback()
      })
      ac.hook('save').after(function(vars) {
        if (~vars.modified.indexOf(clientPath)) {
          if (app && !~app.indexOf(value)) {
            ac.object.fireHook('client.removed.after', null, { ac: ac, clientId: value }, () => {})
          }
        }
      })
      return value
    }
  })]

  DocumentDefinition.call(this, extend({}, options, { properties: properties }))
}
util.inherits(OrgAppDefinition, DocumentDefinition)

OrgAppDefinition.prototype.export = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `app.${doc && doc.name}`,
        client = toArray(doc.clients)[0],
        def = {}

  if (!doc || !this.isExportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {
    return Undefined
  } else if (!client) {
    throw Fault.create('cortex.accessDenied.unspecified', {
      resource: ac.getResource(),
      reason: `The app ${doc.label} is not configured correctly and cannot be exported. ${doc.label}.`,
      path: resourcePath
    })
  } else if (!doc.name) {
    if (resourceStream.silent) {
      return Undefined
    }
    throw Fault.create('cortex.unsupportedOperation.uniqueKeyNotSet', {
      resource: ac.getResource(),
      reason: `The app "${doc.label}" does not have a name set, therefore it can't be exported.`,
      path: resourcePath
    })
  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {
    return Undefined
  }

  Object.assign(
    def,
    {
      object: 'app',
      enabled: doc.enabled && client.enabled,
      whitelist: client.whitelist.slice().sort(naturalCmp),
      blacklist: client.blacklist.slice().sort(naturalCmp),
      cors: toArray(pathTo(client.CORS, 'origins').slice().sort(naturalCmp))
    },
    _.pick(doc, 'name', 'label'),
    _.pick(client,
      'sessions', 'readOnly', 'expires', 'authDuration',
      'maxTokensPerPrincipal', 'expose', 'allowNameMapping',
      'filter', 'urls'
    )
  )

  if (client.sessions) {
    Object.assign(
      def,
      _.pick(client, 'csrf')
    )
  } else {
    Object.assign(
      def,
      _.pick(client, 'allowUnsigned', 'patterns', 'principalId', 'principalOverride')
    )
    def.principalId = await resourceStream.addMappedPrincipal(ac, def.principalId, `${resourcePath}.principalId`, { includeResourcePrefix: true })
  }

  return resourceStream.exportResource(sortKeys(def), resourcePath)

}

OrgAppDefinition.prototype.import = async function(ac, doc, resourceStream, parentResource, options) {

  const resourcePath = `app.${doc && doc.name}`

  if (!doc || !this.isImportable(ac, doc, resourceStream, resourcePath, parentResource, options)) {

    return Undefined

  } else if (!resourceStream.addPath(resourcePath, parentResource, options)) {

    return Undefined

  } else {

    return resourceStream.updateEnvironment(async(ac) => {

      let existing = ac.org.apps.find(sa => sa.name && sa.name === doc.name),
          def = _.pick(doc, [
            'label', 'enabled',
            'whitelist', 'blacklist'
          ]),
          client = _.pick(doc, [
            'label', 'sessions', 'readOnly', 'expires', 'authDuration',
            'maxTokensPerPrincipal', 'expose', 'enabled', 'allowNameMapping',
            'filter', 'urls'
          ]),
          origins = pathTo(doc, 'cors')

      client.CORS = {
        origins: toArray(origins, origins)
      }

      if (client.sessions) {
        Object.assign(
          client,
          _.pick(doc, 'csrf')
        )
      } else {
        Object.assign(
          client,
          _.pick(doc, 'allowUnsigned', 'patterns', 'principalOverride')
        )
        if (doc.principalId) {
          client.principalId = (await resourceStream.importMappedPrincipal(ac, doc.principalId, `${resourcePath}.principalId`))._id
        }
      }
      def.clients = [client]

      if (existing) {
        def._id = existing._id
        def.clients[0]._id = existing.clients[0]._id
      } else {
        def.name = doc.name
      }

      ac.method = existing ? 'put' : 'post'
      await promised(this, 'aclWrite', ac, ac.org, def)

      return ac.org.apps.find(sa => sa.name && sa.name === doc.name)

    })
  }

}

module.exports = OrgAppDefinition
