'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-663 Import error when triggers loading and script not found in cache and is inactive on import', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      const docs = [
        {
          'label': 'System User',
          'locked': true,
          'name': 'c_system_user',
          'object': 'serviceAccount',
          'roles': [
            'administrator'
          ]
        },
        {
          'allowConnections': true,
          'auditing': {
            'enabled': true
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
            'account.public.read',
            'owner.delete'
          ],
          'favorite': false,
          'hasETag': false,
          'isDeletable': true,
          'isUnmanaged': false,
          'isVersioned': false,
          'label': 'Fault',
          'localized': false,
          'name': 'c_fault',
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
              'indexed': false,
              'label': 'Detail Code',
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
              'name': 'c_detail_code',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': false,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'definition': {
                    'pattern': '/[a-zA-Z]+/',
                    'allowNull': false,
                    'allowEmpty': false
                  },
                  'name': 'pattern'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
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
              'label': 'Error Code',
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
              'name': 'c_error_code',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': true,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'name': 'required'
                },
                {
                  'definition': {
                    'min': 0,
                    'max': 512
                  },
                  'name': 'string'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
            {
              'acl': [],
              'aclOverride': false,
              'array': false,
              'auditable': false,
              'autoGenerate': true,
              'canPull': true,
              'canPush': true,
              'creatable': false,
              'history': false,
              'indexed': true,
              'label': 'Key',
              'maxItems': 100,
              'maxShift': false,
              'minItems': 0,
              'name': 'c_key',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'type': 'UUID',
              'unique': true,
              'uniqueValues': false,
              'uuidVersion': 4,
              'validators': [
                {
                  'name': 'required'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
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
              'indexed': false,
              'label': 'Message',
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
              'name': 'c_message',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': false,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'definition': {
                    'min': 0,
                    'max': 1024
                  },
                  'name': 'string'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
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
              'label': 'Namespace',
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
              'name': 'c_namespace',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': false,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'name': 'required'
                },
                {
                  'definition': {
                    'min': 0,
                    'max': 512
                  },
                  'name': 'string'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
            {
              'acl': [],
              'aclOverride': false,
              'array': false,
              'auditable': false,
              'canPull': true,
              'canPush': true,
              'creatable': false,
              'defaultValue': [
                {
                  'type': 'static',
                  'value': 'kError'
                }
              ],
              'history': false,
              'indexed': false,
              'label': 'Native Code',
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
              'name': 'c_native_code',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': false,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'definition': {
                    'values': [
                      'kInvalidArgument',
                      'kValidationError',
                      'kAccessDenied',
                      'kNotFound',
                      'kTimeout',
                      'kExists',
                      'kExpired',
                      'kRequestTooLarge',
                      'kThrottled',
                      'kTooBusy',
                      'kError',
                      'kNotImplemented',
                      'kUnsupportedOperation'
                    ]
                  },
                  'name': 'stringEnum'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            },
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
              'indexed': false,
              'label': 'Reason',
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
              'name': 'c_reason',
              'optional': false,
              'readAccess': 'read',
              'readable': true,
              'removable': false,
              'trim': false,
              'type': 'String',
              'unique': false,
              'uniqueValues': false,
              'uppercase': false,
              'validators': [
                {
                  'definition': {
                    'min': 0,
                    'max': 1024
                  },
                  'name': 'string'
                }
              ],
              'writable': true,
              'writeAccess': 'update',
              'writeOnCreate': true
            }
          ],
          'shareAcl': [],
          'shareChain': [
            'share',
            'read',
            'connected'
          ],
          'uniqueKey': 'c_key'
        },
        {
          'active': true,
          'configuration': {
            'event': 'update.before',
            'inline': false,
            'object': 'c_fault',
            'paths': []
          },
          'description': 'Setting the correct Error code on object update',
          'environment': '*',
          'label': 'Fault - Err Code Set Create',
          'language': 'javascript/es6',
          'name': 'c_test_fault_errcode_set_update',
          'object': 'script',
          'optimized': false,
          'principal': null,
          'script': `console.log('test')`,
          'type': 'trigger',
          'weight': 0
        },
        {
          'c_detail_code': 'eventsRequirePublicUserWithAccount',
          'c_error_code': 'axon.invalidArgument.eventsRequirePublicUserWithAccount',
          'c_key': 'd70d4014-6798-4ffb-a7c5-ac62b9141ae6',
          'c_namespace': 'axon',
          'c_native_code': 'kInvalidArgument',
          'c_reason': 'Events can only be associated with public users that have an account.',
          'favorite': false,
          'object': 'c_fault',
          'owner': 'serviceAccount.c_system_user'
        },
        {
          'c_fault': {
            'includes': [
              'd70d4014-6798-4ffb-a7c5-ac62b9141ae6'
            ]
          },
          'object': 'manifest',
          'objects': [{
            'name': 'c_fault'
          }],
          'scripts': {
            'includes': [
              'c_test_fault_errcode_set_update'
            ]
          },
          'serviceAccounts': {
            'includes': [
              'c_system_user'
            ]
          }
        }
      ]
      return require('developer').environment.import(docs).toArray()
    }))
  })

  it('import updated instance should load trigger and work even if is inactive.', async() => {
    await promised(null, sandboxed(function() {
      const docs = [
        {
          'active': false,
          'configuration': {
            'event': 'update.before',
            'inline': false,
            'object': 'c_fault',
            'paths': []
          },
          'description': 'Setting the correct Error code on object update (Deactivated, remove in 4.14)',
          'environment': '*',
          'label': 'Fault - Err Code Set Create',
          'language': 'javascript/es6',
          'name': 'c_test_fault_errcode_set_update',
          'object': 'script',
          'optimized': false,
          'principal': null,
          'script': `console.log('test')`,
          'type': 'trigger',
          'weight': 0
        },
        {
          'c_detail_code': 'eventsRequirePublicUserWithAccountOrEmail',
          'c_error_code': 'axon.invalidArgument.eventsRequirePublicUserWithAccountOrEmail',
          'c_key': 'd70d4014-6798-4ffb-a7c5-ac62b9141ae6',
          'c_namespace': 'axon',
          'c_native_code': 'kInvalidArgument',
          'c_reason': 'Events can only be associated with public users that have an account or an email.',
          'favorite': false,
          'object': 'c_fault',
          'owner': 'serviceAccount.c_system_user'
        },
        {
          'c_fault': {
            'includes': [
              'd70d4014-6798-4ffb-a7c5-ac62b9141ae6'
            ]
          },
          'object': 'manifest',
          'scripts': {
            'includes': [
              'c_test_fault_errcode_set_update'
            ]
          }
        }
      ]

      return require('developer').environment.import(docs).toArray()
    }))
  })

})
