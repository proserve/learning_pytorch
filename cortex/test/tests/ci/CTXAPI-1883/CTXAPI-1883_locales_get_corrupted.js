/* eslint-disable one-var */
'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      should = require('should'),
      { org } = require('../../../lib/server'),
      cSiteDefinition = require('./c_site_object')

describe('CTXAPI-1883 - Locales', async function() {

  const exportObject = async() => {
    const result = await promised(null, sandboxed(function() {
      const { environment: { export: exportEnvironment } } = require('developer'),
            manifest = {
              object: 'manifest',
              objects: [
                {
                  'includes': [
                    '*'
                  ],
                  'name': 'c_site'
                }
              ]
            },
            docs = exportEnvironment({
              manifest
            }).toArray()

      return docs
    }))

    return result
  }

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global script */
      const { environment: { import: importEnvironment } } = require('developer'),
            objDefinition = script.arguments.objectDefinition
      importEnvironment([objDefinition], { backup: false }).toArray()
    }, {
      runtimeArguments: {
        objectDefinition: cSiteDefinition
      }
    }))
  })

  after(sandboxed(function() {
    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_site' }).execute()
  }))

  it('should not get corrupted after adding a new property to the object definition', async() => {

    const before = await exportObject()

    await promised(null, sandboxed(function() {
      org.objects.objects.updateOne({ name: 'c_site' }, { $push: {
        properties: [
          {

            'array': false,
            'auditable': false,
            'label': 'blah',
            'name': 'c_blah',
            'optional': false,
            'type': 'Boolean',
            'unique': false
          }
        ]
      } }).execute()
    }))

    const after = await exportObject()

    // all nested locales should have their name attributes untouched
    const localizedProperties = after[0].locales.properties
    for (const localizedPropery of localizedProperties) {
      if (localizedPropery.properties.length > 0) {
        for (const localizedChildProperty of localizedPropery.properties) {
          should.exist(localizedChildProperty.name)
        }
      }
    }

    // everything should be the same apart from the new localized attribute
    after[0].locales.properties = after[0].locales.properties.filter(p => p.name !== 'c_blah')
    after[0].properties = after[0].properties.filter(p => p.name !== 'c_blah')

    should.deepEqual(before, after)

  })

})
