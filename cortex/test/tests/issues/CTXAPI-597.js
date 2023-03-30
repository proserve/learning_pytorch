'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-597 Import/Export when non localized object definition', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      // Insert non localized
      org.objects.objects.insertOne({
        localized: true,
        name: 'c_localized_obj',
        label: 'Localized Obj',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'String Label',
          name: 'c_string',
          type: 'String',
          indexed: true,
          removable: true
        }]
      }).execute()

      org.objects.objects.insertOne({
        name: 'c_non_localized_obj',
        label: 'Non Localized Obj',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'Non Localized String Label',
          name: 'c_string_non_localized',
          type: 'String',
          indexed: true,
          removable: true
        }]
      }).execute()

      // Insert localized

    }))
  })

  after(async() => {
    return promised(null, sandboxed(function() {
      org.objects.objects.deleteOne({ name: 'c_localized_obj' }).execute()
      org.objects.objects.deleteOne({ name: 'c_non_localized_obj' }).execute()
    }))
  })

  it('export localized and non localized should be reflected on locales presence', async() => {
    const result = await promised(null, sandboxed(function() {
            const docs = require('developer').environment.export({
              manifest: {
                objects: [{
                  name: 'c_localized_obj',
                  includes: ['*']
                }, {
                  name: 'c_non_localized_obj',
                  includes: ['*']
                }]
              }
            }).toArray()
            return docs
          })),
          localizedObj = result.find(r => r.name === 'c_localized_obj'),
          nonLocalizedObj = result.find(r => r.name === 'c_non_localized_obj')
    should.exist(localizedObj.locales)
    should.equal(localizedObj.locales.label.length, 1)
    should.equal(localizedObj.locales.properties.length, 1)
    should.not.exists(nonLocalizedObj.locale)
  })

  it('import localized should be processed and non localized should be avoid processing.', async() => {
    const result = await promised(null, sandboxed(function() {

            const docs = [
              {
                'allowConnections': true,
                'auditing': {
                  'enabled': false
                },
                'canCascadeDelete': false,
                'connectionOptions': {
                  'requireAccept': true,
                  'requiredAccess': 5,
                  'sendNotifications': true
                },
                'createAcl': [
                  'account.public'
                ],
                'defaultAcl': [
                  'owner.delete'
                ],
                'favorite': false,
                'hasETag': false,
                'isDeletable': true,
                'isUnmanaged': false,
                'isVersioned': false,
                'label': 'Localized Obj',
                'locales': {
                  'description': [],
                  'label': [
                    {
                      'locale': 'en_US',
                      'value': 'Localized Obj'
                    }
                  ],
                  'objectTypes': [],
                  'properties': [
                    {
                      'description': [],
                      'documents': [],
                      'label': [
                        {
                          'locale': 'en_US',
                          'value': 'String Label'
                        }
                      ],
                      'name': 'c_string',
                      'properties': []
                    }
                  ]
                },
                'localized': true,
                'name': 'c_localized_obj',
                'object': 'object',
                'objectTypes': [],
                'properties': [
                  {
                    'acl': [],
                    'aclOverride': false,
                    'array': false,
                    'auditable': false,
                    'canPull': true,
                    'canPush': true,
                    'creatable': false,
                    'defaultValue': [],
                    'history': false,
                    'indexed': true,
                    'label': 'String Label',
                    'localization': {
                      'acl': [],
                      'aclOverride': false,
                      'enabled': false,
                      'fallback': true,
                      'fixed': '',
                      'readAccess': 'read',
                      'strict': true,
                      'valid': [],
                      'writeAccess': 'update'
                    },
                    'lowercase': false,
                    'maxItems': 100,
                    'maxShift': false,
                    'minItems': 0,
                    'name': 'c_string',
                    'optional': false,
                    'readAccess': 'read',
                    'readable': true,
                    'removable': true,
                    'trim': false,
                    'type': 'String',
                    'unique': false,
                    'uniqueValues': false,
                    'uppercase': false,
                    'validators': [],
                    'writable': true,
                    'writeAccess': 'update',
                    'writeOnCreate': true
                  }
                ],
                'resource': 'object.c_localized_obj',
                'shareAcl': [],
                'shareChain': [],
                'uniqueKey': ''
              },
              {
                'allowConnections': true,
                'auditing': {
                  'enabled': false
                },
                'canCascadeDelete': false,
                'connectionOptions': {
                  'requireAccept': true,
                  'requiredAccess': 5,
                  'sendNotifications': true
                },
                'createAcl': [
                  'account.public'
                ],
                'defaultAcl': [
                  'owner.delete'
                ],
                'favorite': false,
                'hasETag': false,
                'isDeletable': true,
                'isUnmanaged': false,
                'isVersioned': false,
                'label': 'Non Localized Obj',
                'localized': false,
                'name': 'c_non_localized_obj',
                'object': 'object',
                'objectTypes': [],
                'locales': {
                  'description': [],
                  'label': [{
                    'locale': 'en_US',
                    'value': 'Localized Obj'
                  }],
                  'objectTypes': [],
                  'properties': []
                },
                'properties': [
                  {
                    'acl': [],
                    'aclOverride': false,
                    'array': false,
                    'auditable': false,
                    'canPull': true,
                    'canPush': true,
                    'creatable': false,
                    'defaultValue': [],
                    'history': false,
                    'indexed': true,
                    'label': 'Non Localized String Label',
                    'localization': {
                      'acl': [],
                      'aclOverride': false,
                      'enabled': false,
                      'fallback': true,
                      'fixed': '',
                      'readAccess': 'read',
                      'strict': true,
                      'valid': [],
                      'writeAccess': 'update'
                    },
                    'lowercase': false,
                    'maxItems': 100,
                    'maxShift': false,
                    'minItems': 0,
                    'name': 'c_string_non_localized',
                    'optional': false,
                    'readAccess': 'read',
                    'readable': true,
                    'removable': true,
                    'trim': false,
                    'type': 'String',
                    'unique': false,
                    'uniqueValues': false,
                    'uppercase': false,
                    'validators': [],
                    'writable': true,
                    'writeAccess': 'update',
                    'writeOnCreate': true
                  }
                ],
                'resource': 'object.c_non_localized_obj',
                'shareAcl': [],
                'shareChain': [],
                'uniqueKey': ''
              },
              {
                'object': 'manifest',
                'objects': [
                  {
                    'includes': [
                      '*'
                    ],
                    'name': 'c_localized_obj'
                  },
                  {
                    'includes': [
                      '*'
                    ],
                    'name': 'c_non_localized_obj'
                  }
                ]
              }
            ]
            return require('developer').environment.import(docs, { backup: false }).toArray()
          })),
          completed = result.find(log => log.stage === 'complete')
    should.exist(completed)
  })

})
