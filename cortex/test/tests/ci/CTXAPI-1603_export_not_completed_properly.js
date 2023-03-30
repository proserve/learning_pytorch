'use strict'

const sandboxed = require('../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-1603 - Export not completed properly', function() {

  const data = [
          { 'allowNameMapping': true, 'authDuration': 900, 'blacklist': [], 'cors': [], 'csrf': true, 'enabled': true, 'expires': null, 'expose': false, 'label': 'Web Study Manager App', 'maxTokensPerPrincipal': 10, 'name': 'c_web_sm_app', 'object': 'app', 'readOnly': false, 'sessions': true, 'urls': { 'connection': '', 'resetPassword': '', 'createPassword': '', 'activateAccount': '', 'verifyAccount': '' }, 'whitelist': [] },
          { 'allowConnections': true, 'localized': false, 'reporting': false, 'auditing': { 'enabled': false }, 'canCascadeDelete': false, 'connectionOptions': { 'requireAccept': true, 'requiredAccess': 5, 'sendNotifications': true }, 'createAcl': ['account.public'], 'defaultAcl': ['owner.delete'], 'favorite': false, 'hasETag': false, 'isDeletable': true, 'isUnmanaged': false, 'isVersioned': false, 'label': 'c_ctxapi_1603_object', 'name': 'c_ctxapi_1603_object', 'object': 'object', 'objectTypes': [], 'properties': [{ 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'label': 'c_file', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_file', 'optional': false, 'processors': [{ 'allowUpload': true, 'label': 'Content', 'maxFileSize': 10000000, 'mimes': ['*'], 'name': 'content', 'passMimes': false, 'private': false, 'required': true, 'source': 'content', 'type': 'passthru' }], 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'File', 'uniqueValues': false, 'urlExpirySeconds': null, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }, { 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'autoGenerate': true, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'indexed': true, 'label': 'c_key', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_key', 'optional': false, 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'UUID', 'unique': true, 'uniqueValues': false, 'uuidVersion': -1, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }], 'shareAcl': [], 'shareChain': ['share', 'read', 'connected'], 'uniqueKey': 'c_key' },
          { 'allowConnections': true, 'localized': false, 'reporting': false, 'auditing': { 'enabled': false }, 'canCascadeDelete': false, 'connectionOptions': { 'requireAccept': true, 'requiredAccess': 5, 'sendNotifications': true }, 'createAcl': ['account.public'], 'defaultAcl': ['owner.delete'], 'favorite': false, 'hasETag': false, 'isDeletable': true, 'isUnmanaged': false, 'isVersioned': false, 'label': 'c_ctxapi_1603_object_no_ref', 'name': 'c_ctxapi_1603_object_no_ref', 'object': 'object', 'objectTypes': [], 'properties': [{ 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'label': 'c_file_no_ref', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_file_no_ref', 'optional': false, 'processors': [{ 'allowUpload': true, 'label': 'Content', 'maxFileSize': 10000000, 'mimes': ['*'], 'name': 'content', 'passMimes': false, 'private': false, 'required': true, 'source': 'content', 'type': 'passthru' }], 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'File', 'uniqueValues': false, 'urlExpirySeconds': null, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }, { 'acl': [], 'aclOverride': false, 'array': false, 'auditable': false, 'autoGenerate': true, 'canPull': true, 'canPush': true, 'creatable': false, 'history': false, 'indexed': true, 'label': 'c_key', 'maxItems': 100, 'maxShift': false, 'minItems': 0, 'name': 'c_key', 'optional': false, 'readAccess': 'read', 'readable': true, 'removable': false, 'type': 'UUID', 'unique': true, 'uniqueValues': false, 'uuidVersion': -1, 'validators': [], 'writable': true, 'writeAccess': 'update', 'writeOnCreate': true }], 'shareAcl': [], 'shareChain': ['share', 'read', 'connected'], 'uniqueKey': 'c_key' },
          {
            'accountSid': '12345',
            'isDefault': true,
            'name': 'c_test_twilio',
            'number': '+16508611234',
            'object': 'smsNumber',
            'provider': 'twilio'
          },
          { 'code': 'c_site_user', 'include': [], 'name': 'Site User', 'object': 'role', 'scope': [] },
          { 'active': true, 'configuration': { 'acl': ['account.public'], 'apiKey': null, 'authValidation': 'legacy', 'method': 'get', 'path': 'test_csv', 'plainText': false, 'priority': 0, 'system': false, 'urlEncoded': false }, 'environment': '*', 'label': 'c_test_csv', 'language': 'javascript/es6', 'name': 'c_test_csv', 'object': 'script', 'optimized': false, 'principal': null, 'script': "import { Job } from 'renderer'\nimport { setHeader } from 'response'\n\nconst patientsToInsert = 0,\n  pdfJob = new Job('c_axon_demo_app') //apiKey\n\nsetHeader('Content-Type', 'text/csv')\n//return pdfJob.status('a943acd0-835b-11ec-a7da-57a019e445ef')\nreturn pdfJob\n  .addCursor('patients', org.objects.c_patients.find().limit(5))\n  .addTemplate('c_csv_temp', 'ID,Name,Age,Height,Weight,Heart Rate,Blood Pressure,\"Body Fat, Percentage\",Body Mass Index,Waist Circumference,\"Does Exercise,Yes/NO\",Exercise Hours \\n {{#each (cursor patients)}}{{c_id}},\"{{c_name}}\",{{c_age}},{{c_height}},{{c_weight}},{{c_heart_rate}},{{c_blood_pressure}},{{c_body_fat_percentage}},{{c_body_mass_index}},{{c_waist_circumference}},{{c_does_exercise}},{{c_exercise_hours}}\\n{{/each}}')\n  .addOutput('my_csv', 'csv', ['c_csv_temp'])\n  .start()", 'type': 'route', 'weight': 0 },
          { 'label': 'System User', 'locked': true, 'name': 'c_system_user', 'object': 'serviceAccount', 'roles': ['administrator'] },
          { 'acl': ['account.public'], 'active': true, 'description': 'my view', 'label': 'my test view', 'limit': { 'defaultValue': 100, 'max': 1000, 'min': 1, 'settable': true }, 'name': 'c_my_view', 'object': 'view', 'objectAcl': ['account.public.connected'], 'paths': { 'defaultValue': [], 'limitTo': [], 'settable': true }, 'principal': 'account.public', 'query': [], 'skip': { 'defaultValue': 0, 'max': 500000, 'min': 0, 'settable': true }, 'sourceObject': 'c_ctxapi_1603_object' },
          { 'duplicates': false, 'endpoints': [{ 'configurable': true, 'defaultUserState': 0, 'label': 'Email', 'name': 'email', 'state': 'Enabled', 'template': 'c_test_temp', 'type': 'email' }, { 'configurable': true, 'defaultUserState': 0, 'label': 'Push', 'name': 'push', 'state': 'Enabled', 'template': 'c_push_temp', 'type': 'push' }], 'label': 'test_not', 'name': 'c_test_not', 'object': 'notification', 'persists': false },
          { 'description': 'c_test_temp', 'label': 'c_test_temp', 'localizations': [{ 'locale': 'en_US', 'content': [{ 'data': '<h1>Test Template</h1>', 'name': 'html' }, { 'data': 'Test Template', 'name': 'plain' }, { 'data': 'Test template', 'name': 'subject' }] }], 'name': 'c_test_temp', 'object': 'template', 'partial': false, 'type': 'email' },
          { 'description': 'c_push_temp', 'label': 'c_push_temp', 'localizations': [{ 'locale': 'en_US', 'content': [{ 'data': 'Test push template', 'name': 'message' }] }], 'name': 'c_push_temp', 'object': 'template', 'partial': false, 'type': 'push' },
          {
            'name': 'ec__version',
            'object': 'config',
            'value': {
              'version': '1.3.0'
            }
          },
          {
            'aclBlacklist': [],
            'aclWhitelist': [],
            'action': 'Transform',
            'active': true,
            'appBlacklist': [],
            'appWhitelist': [],
            'condition': 'and',
            'environment': '*',
            'faultCode': 'kAccessDenied',
            'faultReason': 'Access denied by policy',
            'faultStatusCode': 403,
            'halt': false,
            'ipBlacklist': [],
            'ipWhitelist': [],
            'label': 'c_test_policy',
            'methods': [
              'get'
            ],
            'name': 'c_test_policy',
            'object': 'policy',
            'paths': [
              '/routes/task_assignments'
            ],
            'priority': 1,
            'rateLimit': false,
            'rateLimitCount': 300,
            'rateLimitElements': [
              'ip'
            ],
            'rateLimitReason': 'Too many requests.',
            'rateLimitWindow': 300,
            'redirectStatusCode': 307,
            'script': 'return "hello";',
            'trace': false,
            'type': 'api',
            'weight': 0
          },
          {
            'accessKeyId': 'aaaa',
            'active': true,
            'bucket': 'my_bucket',
            'exportTtlDays': 7,
            'label': 'test storage',
            'managed': true,
            'name': 'c_test_storage',
            'object': 'storageLocation',
            'passive': false,
            'prefix': '',
            'readUrlExpiry': 900,
            'region': 'us-east-2',
            'resource': 'storageLocation.c_test_storage',
            'type': 'aws-s3'
          }
        ],
        importManifest = {
          'object': 'manifest',
          'env': { 'includes': ['*'] },
          'configs': { 'includes': ['*'] },
          'apps': { 'includes': ['c_web_sm_app'] },
          'policies': { 'includes': ['*'] },
          'objects': [{ 'includes': ['*'], 'name': 'c_ctxapi_1603_object' }, { 'includes': ['*'], 'name': 'c_ctxapi_1603_object_no_ref' }],
          'smsNumbers': { 'includes': ['*'] },
          'views': { 'includes': ['c_my_view'] },
          'scripts': { 'includes': ['c_test_csv'] },
          'roles': { 'includes': ['c_site_user'] },
          'notifications': { 'includes': ['c_test_not'] },
          'serviceAccounts': { 'includes': ['c_system_user'] },
          'templates': { 'includes': ['email.c_test_temp', 'push.c_push_temp'] },
          'storageLocations': { 'includes': ['*'] }
        }
  before(async() => {
    // import some data
    await promised(null, sandboxed(function() {
      const { importManifest, data } = global.script.arguments,
            { environment: { import: importEnvironment } } = require('developer')

      return importEnvironment([
        importManifest,
        ...data
      ], {
        backup: false
      }).toArray()
    }, {
      runtimeArguments: { importManifest, data }
    }))
  })

  it('should export all but instance data without a manifest', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment().toArray()
    }))
    should.exist(result)
    const manifest = result.find(item => item.object === 'manifest')
    should(Object.keys(manifest).filter(k => k !== 'object').sort()).deepEqual([
      'env',
      'objects',
      'configs',
      'scripts', 'views', 'templates',
      'apps', 'roles', 'serviceAccounts', 'smsNumbers', 'policies', 'notifications', 'storageLocations'].sort())
  })

  it('should export items defined in the manifest', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment({
        manifest: {
          object: 'manifest',
          dependencies: false,
          'configs': { 'includes': ['*'] },
          'apps': { 'includes': ['c_web_sm_app'] }
        }
      }).toArray()
    }))
    should.exist(result)
    const manifest = result.find(item => item.object === 'manifest')
    should(Object.keys(manifest).filter(k => k !== 'object').sort()).deepEqual([
      'dependencies',
      'configs',
      'apps'].sort())
  })

  it('should export all objects if no manifest provided', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment().toArray()
    }))
    should.exist(result)
    const manifest = result.find(item => item.object === 'manifest')
    const {objects} = manifest

    // Since we don't know if other tests have objects in use we will need to 
    // at least have the ones we created
    const objectsToCheck = objects.filter(o => ['c_ctxapi_1603_object', 'c_ctxapi_1603_object_no_ref'].includes(o.name))
    should.equal(objectsToCheck.length, 2)
    should.deepEqual(objectsToCheck.map(o => o.name), ['c_ctxapi_1603_object', 'c_ctxapi_1603_object_no_ref'])
  })

  it('should export all objects if full list is provided', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment({
        manifest: {
          object: 'manifest',
          dependencies: false,
          'objects': [
            { 'includes': ['*'], 'name': 'c_ctxapi_1603_object' }, 
            { 'includes': ['*'], 'name': 'c_ctxapi_1603_object_no_ref' }
          ]
        }
      }).toArray()
    }))
    should.exist(result)
    const manifest = result.find(item => item.object === 'manifest')
    const {objects} = manifest
    should.equal(objects.length, 2)
    should.deepEqual(objects.map(o => o.name), ['c_ctxapi_1603_object', 'c_ctxapi_1603_object_no_ref'])
  })

  it('should export all selected objects from manifest', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment({
        manifest: {
          object: 'manifest',
          dependencies: false,
          'objects': [
            { 'includes': ['*'], 'name': 'c_ctxapi_1603_object_no_ref' }
          ]
        }
      }).toArray()
    }))
    should.exist(result)
    const manifest = result.find(item => item.object === 'manifest')
    const {objects} = manifest
    should.equal(objects.length, 1)
    should.deepEqual(objects.map(o => o.name), ['c_ctxapi_1603_object_no_ref'])
  })

})
