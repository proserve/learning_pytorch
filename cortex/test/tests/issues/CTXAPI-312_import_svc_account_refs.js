'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-312 - Exporting and importing service accounts as owner references.', function() {

  before(sandboxed(function() {

    /* global org, consts, script */

    const { Objects } = org.objects

    script.org.push(
      'serviceAccounts',
      {
        name: 'c_ctxapi_312',
        label: 'c_ctxapi_312',
        locked: true,
        roles: [consts.roles.administrator]
      }
    )

    Objects.insertOne({
      label: 'c_ctxapi_312',
      name: 'c_ctxapi_312',
      defaultAcl: ['owner.delete', 'role.administrator.delete'],
      createAcl: 'account.public',
      shareAcl: [],
      uniqueKey: 'c_key',
      properties: [{
        label: 'String',
        name: 'c_string',
        type: 'String'
      },
      {
        label: 'Key',
        name: 'c_key',
        type: 'UUID',
        autoGenerate: true,
        uuidVersion: 4,
        writable: true,
        indexed: true,
        unique: true,
        optional: false
      }]
    }).execute()

  }))

  it('export then import with service account dependency.', sandboxed(function() {

    require('should')

    const { environment: { import: importEnvironment, export: exportEnvironment } } = require('developer'),
          modelName = 'c_ctxapi_312',
          { [modelName]: Model } = org.objects,
          instance = script.as(modelName, {}, () => {
            return Model.insertOne({ c_string: 'foo' }).lean(false).execute()
          }),
          manifest = {
            object: 'manifest',
            [modelName]: {
              includes: [instance.c_key]
            }
          },
          docs = exportEnvironment({ manifest }).toArray()

    docs.filter(({ object, c_key: uniqueKey }) => object === modelName && uniqueKey === instance.c_key).length.should.equal(1)
    docs.filter(({ object, name: uniqueKey }) => object === 'serviceAccount' && uniqueKey === modelName).length.should.equal(1)

    docs.find(({ object }) => object === 'manifest-dependencies').dependencies[`${modelName}.${instance.c_key}.owner`].requires.includes(`serviceAccount.${modelName}`).should.be.true()
    docs.find(({ object }) => object === 'manifest-dependencies').dependencies[`serviceAccount.${modelName}`].requiredBy.includes(`${modelName}.${instance.c_key}.owner`).should.be.true()

    docs.find(({ object }) => object === 'manifest-exports').resources.includes(`${modelName}.${instance.c_key}`).should.be.true()
    docs.find(({ object }) => object === 'manifest-exports').resources.includes(`serviceAccount.${modelName}`).should.be.true()

    let imports = importEnvironment(docs, { backup: false }).toArray()

    imports.filter(({ resource, type }) => resource === `serviceAccount.${modelName}` && type === 'import.resource').length.should.be.greaterThan(0)
    imports.filter(({ resource, type }) => resource === `${modelName}.${instance.c_key}` && type === 'import.resource').length.should.be.greaterThan(0)

  }))

})
