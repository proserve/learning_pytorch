'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      { promised } = require('../../../../lib/utils'),
      { data: objectData } = require('./data/objects')

describe('Issues - CTXAPI-1791 - Export does not contain locales for dependencies', function() {

  const data = [
          { 'allowNameMapping': true, 'authDuration': 900, 'blacklist': [], 'cors': [], 'csrf': true, 'enabled': true, 'expires': null, 'expose': false, 'label': 'Web Study Manager App', 'maxTokensPerPrincipal': 10, 'name': 'c_web_sm_app', 'object': 'app', 'readOnly': false, 'sessions': true, 'urls': { 'connection': '', 'resetPassword': '', 'createPassword': '', 'activateAccount': '', 'verifyAccount': '' }, 'whitelist': [] },
          ...objectData
        ],
        importManifest = {
            'object': 'manifest',
            'env': { 'includes': ['*'] },
            'configs': { 'includes': ['*'] },
            'apps': { 'includes': ['c_web_sm_app'] },
            'objects': [{ 'includes': ['*'], 'name': 'c_group' }, { 'includes': ['*'], 'name': 'c_group_task' }]
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

  it('should export all objects with locales if manifest is not provided', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment().toArray()
    }))

    result.filter(curr => {
        return ['c_group', 'c_group_task'].includes(curr.name)
    }).forEach(current => {
        current.locales.should.not.be.empty()
    })
  })

  it('should export locales of the dependencies too', async function() {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer')
      return exportEnvironment({
        manifest: {
            "object": "manifest",
            "objects": [
              {
                "includes": [
                  "*"
                ],
                "name": "c_group"
              }
            ]
        }
      }).toArray()
    }))
    let cGroupTasks = result.find(object => {
        return object.name === 'c_group_task'
    })
    should.exist(cGroupTasks);
    cGroupTasks.locales.should.not.be.empty()
  })

})
