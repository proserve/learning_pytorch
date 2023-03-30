'use strict'

/* global afterEach, before */

const sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      modules = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      should = require('should'),
      _ = require('lodash'),
      cleanInstances = function() {
        const should = require('should')
        org.objects.c_ctxapi_208.deleteMany({}).grant(consts.accessLevels.delete).skipAcl().execute()
        org.objects.c_ctxapi_208_deleteacl.deleteMany({}).execute()

        should.equal(org.objects.c_ctxapi_208.find().count(), 0)
        should.equal(org.objects.c_ctxapi_208_deleteacl.find().count(), 0)
      }

let defaultParserEngine

describe('Features - DB Driver', function() {

  before(sandboxed(function() {

    /* global org, consts */

    org.objects.objects.insertOne({
      label: 'CTXAPI-208',
      name: 'c_ctxapi_208',
      defaultAcl: ['owner.public'], // owner only gets public access.
      createAcl: ['account.public'],
      properties: [{
        label: 'Public',
        name: 'c_public',
        type: 'String',
        indexed: true,
        readAccess: consts.accessLevels.public
      }, {
        label: 'Connected',
        name: 'c_connected',
        type: 'String',
        readAccess: consts.accessLevels.connected
      }]
    }).execute()

    org.objects.objects.insertOne({
      label: 'CTXAPI-208',
      name: 'c_ctxapi_208_deleteacl',
      defaultAcl: ['owner.delete'],
      createAcl: ['account.public'],
      properties: [
        { name: 'c_string', label: 'A string', type: 'String', indexed: true },
        { name: 'c_number', label: 'Number', type: 'Number', indexed: true },
        { name: 'c_boolean', label: 'Boolean', type: 'Boolean', indexed: true },
        { name: 'c_string_b', label: 'Another string', type: 'String', removable: true },
        { name: 'c_string_array', label: 'String Array', type: 'String', array: true },
        { name: 'c_boolean_array', label: 'Boolean Array', type: 'Boolean', array: true },
        { name: 'c_number_array', label: 'Number Array', type: 'Number', array: true },
        { name: 'c_doc_array',
          label: 'Document Array',
          type: 'Document',
          array: true,
          properties: [{
            name: 'c_string',
            label: 'String',
            type: 'String'
          }]
        }]
    }).execute()
  }))

  before(function() {
    defaultParserEngine = server.org.configuration.defaultParserEngine
  })

  after(callback => {
    modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
      $set: {
        'configuration.defaultParserEngine': defaultParserEngine
      }
    }, () => {
      server.updateOrg(callback)
    })
  })

  afterEach(sandboxed(cleanInstances))

  describe('Stable parser engine', function() {
    before(callback => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.defaultParserEngine': 'stable'
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    describe('Driver Interface', function() {
      it('Operation - cursor', driverCursor)

      it('Operation - insertOne', driverInsertOne)

      it('Operation - insertMany', driverInsertMany)

      it('Operation - deleteOne', driverDeleteOne)

      it('Operation - deleteMany', driverDeleteMany)

      it('Operation - patchOne', driverPatchOne)

      it('Operation - patchMany', driverPatchMany)

      it('Operation - updateOne', driverUpdateOne)

      it('Operation - updateMany', driverUpdateMany)
    })

    describe('Sandbox Regression', function() {
      it('should insert one instance', sandboxed(shouldInsertOneInstance))

      it('should update one instance', sandboxed(shouldUpdateOneInstance))

      it('should delete one instance', sandboxed(shouldDeleteOneInstance))

      it('should insert many instances', sandboxed(shouldInsertManyInstances))

      it('should update many instances', sandboxed(shouldUpdateManyInstances))

      it('should delete many instances', sandboxed(shouldDeleteManyInstances))
    })
  })

  describe('Latest parser engine', function() {
    before(callback => {
      modules.db.sequencedUpdate(server.org.constructor, { _id: server.org._id }, {
        $set: {
          'configuration.defaultParserEngine': 'latest'
        }
      }, () => {
        server.updateOrg(callback)
      })
    })

    describe('Driver Interface', function() {

      it('Operation - cursor', driverCursor)

      it('Operation - insertOne', driverInsertOne)

      it('Operation - insertMany', driverInsertMany)

      it('Operation - deleteOne', driverDeleteOne)

      it('Operation - deleteMany', driverDeleteMany)

      it('Operation - patchOne', driverPatchOne)

      it('Operation - patchMany', driverPatchMany)

      it('Operation - updateOne', driverUpdateOne)

      it('Operation - updateMany', driverUpdateMany)
    })

    describe('Sandbox Regression', function() {

      it('should insert one instance', sandboxed(shouldInsertOneInstance))

      it('should update one instance', sandboxed(shouldUpdateOneInstance))

      it('should delete one instance', sandboxed(shouldDeleteOneInstance))

      it('should insert many instances', sandboxed(shouldInsertManyInstances))

      it('should update many instances', sandboxed(shouldUpdateManyInstances))

      it('should delete many instances', sandboxed(shouldDeleteManyInstances))

    })
  })

})

function shouldInsertOneInstance() {
  const should = require('should'),
        { tryCatch } = require('util.values')

  org.objects.c_ctxapi_208.insertOne({
    c_public: 'public_string',
    c_connected: 'connected_string'
  }).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 1)

  let instance = org.objects.c_ctxapi_208
    .find()
    .skipAcl()
    .grant(consts.accessLevels.read)
    .next()

  should.exist(instance)
  should.exist(instance.c_public)
  should.exist(instance.c_connected)

  instance.c_public.should.equal('public_string')
  instance.c_connected.should.equal('connected_string')

  tryCatch(() => {
    org.objects.c_ctxapi_208.insertOne({ c_public: 'a_string' }).execute()
  }, (err, result) => {
    should.not.exist(result)
    should.exist(err)
    should.equal(err.errCode, 'cortex.accessDenied.propertyUpdate')
    should.equal(err.statusCode, 403)
    should.equal(err.path, 'c_ctxapi_208.c_public')

    return true
  })
}

function shouldUpdateOneInstance() {
  const should = require('should'),
        { tryCatch } = require('util.values')

  org.objects.c_ctxapi_208.insertOne({
    c_public: 'public_string',
    c_connected: 'connected_string'
  }).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 1)

  org.objects.c_ctxapi_208.updateOne({
    c_public: 'public_string'
  }, {
    $set: {
      c_connected: 'UPDATE!',
      c_public: 'Update'
    }
  }).skipAcl().grant(consts.accessLevels.update).execute()

  let instance = org.objects.c_ctxapi_208
    .find()
    .skipAcl()
    .grant(consts.accessLevels.read)
    .next()

  should.exist(instance)
  should.exist(instance.c_public)
  should.exist(instance.c_connected)
  instance.c_public.should.equal('Update')
  instance.c_connected.should.equal('UPDATE!')

  tryCatch(() => {
    org.objects.c_ctxapi_208.updateOne({ c_public: 'Update' }, {
      $set: {
        c_public: 'a_string'
      }
    }).execute()
  }, (err, result) => {
    should.not.exist(result)
    should.exist(err)
    should.equal(err.errCode, 'cortex.accessDenied.propertyUpdate')
    should.equal(err.statusCode, 403)
    should.equal(err.path, 'c_ctxapi_208.c_public')

    return true
  })
}

function shouldDeleteOneInstance() {
  const should = require('should'),
        { tryCatch } = require('util.values')

  org.objects.c_ctxapi_208.insertOne({
    c_public: 'public_string',
    c_connected: 'connected_string'
  }).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 1)

  org.objects.c_ctxapi_208.deleteOne({
    c_public: 'public_string'
  }).skipAcl().grant(consts.accessLevels.delete).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 0)

  org.objects.c_ctxapi_208.insertOne({
    c_public: 'public_string',
    c_connected: 'connected_string'
  }).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 1)

  tryCatch(() => {
    org.objects.c_ctxapi_208.deleteOne({
      c_public: 'public_string'
    }).execute()
  }, (err, result) => {
    should.not.exist(result)
    should.exist(err)
    should.equal(err.errCode, 'cortex.accessDenied.instanceDelete')
    should.equal(err.statusCode, 403)

    return true
  })
}

function shouldInsertManyInstances() {
  const should = require('should'),
        { tryCatch } = require('util.values')

  org.objects.c_ctxapi_208.insertMany([{
    c_public: 'public_string',
    c_connected: 'connected_string'
  }, {
    c_public: 'a_string',
    c_connected: 'another_string'
  }, {
    c_public: 'b_string',
    c_connected: 'another_one'
  }]).skipAcl().grant(consts.accessLevels.update).execute()

  let instances = org.objects.c_ctxapi_208
    .find()
    .skipAcl()
    .grant(consts.accessLevels.read)
    .toArray()

  should.exist(instances)
  should.equal(instances.length, 3)

  instances.map(i => i.c_public).should.containDeep(['public_string', 'a_string', 'b_string'])
  instances.map(i => i.c_connected).should.containDeep(['connected_string', 'another_string', 'another_one'])

  tryCatch(() => {
    return org.objects.c_ctxapi_208.insertMany([{
      c_public: 'str',
      c_connected: 'conn'
    }, {
      c_public: 'str2',
      c_connected: 'conn2'
    }, {
      c_public: 'str3',
      c_connected: 'conn3'
    }]).execute()
  }, (err, result) => {
    if (err) return err
    should.exist(result)
    should.equal(result.insertedCount, 0)
    should.equal(result.insertedIds.length, 0)
    should.equal(result.writeErrors.length, 3)

    result.writeErrors.forEach(e => {
      should.equal(e.errCode, 'cortex.accessDenied.propertyUpdate')
      should.equal(e.status, 403)
      should.equal(e.path, 'c_ctxapi_208.c_public')
    })

    return true
  })

}

function shouldUpdateManyInstances() {
  const should = require('should'),
        { tryCatch } = require('util.values'),
        _ = require('underscore')

  org.objects.c_ctxapi_208.insertMany([{
    c_public: 'a_string',
    c_connected: 'connected_string'
  }, {
    c_public: 'a_string',
    c_connected: 'another_string'
  }, {
    c_public: 'b_string',
    c_connected: 'another_one'
  }]).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 3)

  org.objects.c_ctxapi_208.updateMany({
    c_public: 'a_string'
  }, {
    $set: {
      c_connected: 'Different',
      c_public: 'Update'
    }
  }).skipAcl().grant(consts.accessLevels.update).execute()

  let instances, updatedInstances, nonUpdatedInstance

  instances = org.objects.c_ctxapi_208
    .find()
    .skipAcl()
    .grant(consts.accessLevels.read)
    .toArray()

  should.exist(instances)
  should.equal(instances.length, 3)

  updatedInstances = _.filter(instances, i => i.c_public === 'Update')
  nonUpdatedInstance = _.find(instances, i => i.c_public === 'b_string')

  should.exist(updatedInstances)
  should.equal(updatedInstances.length, 2)

  updatedInstances.forEach(i => {
    should.equal(i.c_public, 'Update')
    should.equal(i.c_connected, 'Different')
  })

  should.exist(nonUpdatedInstance)
  should.exist(nonUpdatedInstance.c_public)
  should.exist(nonUpdatedInstance.c_connected)
  nonUpdatedInstance.c_public.should.equal('b_string')
  nonUpdatedInstance.c_connected.should.equal('another_one')

  tryCatch(() => {
    return org.objects.c_ctxapi_208.updateMany({ c_public: 'Update' }, {
      $set: {
        c_public: 'a_string'
      }
    }).execute()
  }, (err, result) => {
    if (err) return err
    should.exist(result)
    should.equal(result.matchedCount, 2)
    should.equal(result.modifiedCount, 0)
    should.equal(result.updatedIds.length, 0)
    should.equal(result.writeErrors.length, 2)

    result.writeErrors.forEach(e => {
      should.equal(e.errCode, 'cortex.accessDenied.propertyUpdate')
      should.equal(e.status, 403)
      should.equal(e.path, 'c_ctxapi_208.c_public')
    })

    return true
  })

}

function shouldDeleteManyInstances() {

  const should = require('should'),
        { tryCatch } = require('util.values')

  org.objects.c_ctxapi_208.insertMany([{
    c_public: 'a_string',
    c_connected: 'connected_string'
  }, {
    c_public: 'a_string',
    c_connected: 'another_string'
  }, {
    c_public: 'b_string',
    c_connected: 'another_one'
  }]).skipAcl().grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 3)

  org.objects.c_ctxapi_208.deleteMany({
    c_public: 'a_string'
  }).skipAcl()
    .grant(consts.accessLevels.update).execute()

  should.equal(org.objects.c_ctxapi_208.find().count(), 1)

  let instance = org.objects.c_ctxapi_208
    .find()
    .skipAcl()
    .grant(consts.accessLevels.read)
    .next()

  should.exist(instance)
  should.exist(instance.c_public)
  should.exist(instance.c_connected)
  should.equal(instance.c_public, 'b_string')
  should.equal(instance.c_connected, 'another_one')

  org.objects.c_ctxapi_208.insertMany([{
    c_public: 'a_string',
    c_connected: 'connected_string'
  }, {
    c_public: 'a_string',
    c_connected: 'another_string'
  }]).skipAcl().grant(consts.accessLevels.update).execute()

  tryCatch(() => {
    return org.objects.c_ctxapi_208.deleteMany({ c_public: 'a_string' }).execute()
  }, (err, result) => {
    if (err) return err
    should.exist(result)
    should.equal(result, 0)
    should.equal(org.objects.c_ctxapi_208.find().skipAcl().grant(consts.accessLevels.read).count(), 3)

    return true
  })
}

async function driverCursor() {

  let options, response

  options = await promised(null, sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_208.insertOne({
      c_public: 'c_public',
      c_connected: 'c_connected'
    }).skipAcl().grant(consts.accessLevels.update).execute()

    const should = require('should'),
          cursor = org.objects.c_ctxapi_208.find().grant(consts.accessLevels.delete),
          options = cursor.getOptions(),
          result = cursor.next()

    options.operation.should.equal('cursor')
    options.grant.should.equal(consts.accessLevels.delete)

    should.exist(result.c_public)
    should.exist(result.c_connected)

    return options

  }, 'admin'))

  response = await runOperation(options)

  should.exist(response.body.data)
  should.exist(response.body.data[0].c_public)
  should.not.exist(response.body.data[0].c_connected)

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.exist(response.body.data[0].data.c_public)
  should.not.exist(response.body.data[0].data.c_connected)

  void response

}

async function driverInsertOne() {

  let options, response, instance, instanceArray, id

  options = await promised(null, sandboxed(function() {

    /* global org */

    const should = require('should'),
          options = org.objects.c_ctxapi_208_deleteacl
            .insertOne({ c_string: 'test_insert_one' })
            .getOptions()

    options.operation.should.equal('insertOne')
    should.exist(options.document)
    options.document.c_string.should.equal('test_insert_one')

    return options

  }, 'admin'))

  response = await runOperation(options)

  should.exist(response.body.data)
  id = response.body.data

  instance = await fetchObjects('/c_ctxapi_208_deleteacl/' + id)

  should.exist(instance)
  should.exist(instance.body)
  instance.body.c_string.should.equal('test_insert_one')

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.exist(response.body.data[0].data)

  id = response.body.data[0].data

  instanceArray = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instanceArray)
  should.exist(instanceArray.body)
  should.exist(instanceArray.body.data)
  instanceArray.body.data.length.should.equal(2)

  instance = _.find(instanceArray.body.data, i => i._id === id)
  instance.c_string.should.equal('test_insert_one')

  void response
}

async function driverInsertMany() {

  let options, response, instances

  options = await promised(null, sandboxed(function() {

    /* global org */

    const should = require('should'),
          options = org.objects.c_ctxapi_208_deleteacl
            .insertMany([
              { c_string: 'test_insert_many1' },
              { c_string: 'test_insert_many2' },
              { c_string: 'test_insert_many3' },
              { c_string: 'test_insert_many4' }
            ])
            .getOptions()

    options.operation.should.equal('insertMany')
    should.exist(options.documents)
    options.documents.length.should.equal(4)

    options.documents.map(d => d.c_string).should.containDeep(
      ['test_insert_many1',
        'test_insert_many2',
        'test_insert_many3',
        'test_insert_many4'])

    return options

  }, 'admin'))

  response = await runOperation(options)

  should.exist(response.body.data)
  response.body.data.insertedCount.should.equal(4)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.equal(instances.body.data.length, 4)
  instances.body.data.map(i => i.c_string).should.containDeep(
    ['test_insert_many1',
      'test_insert_many2',
      'test_insert_many3',
      'test_insert_many4'])

  await promised(null, sandboxed(cleanInstances))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.exist(response.body.data[0].data)
  should.equal(response.body.data[0].data.insertedCount, 4)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  instances.body.data.length.should.equal(4)
  instances.body.data.map(i => i.c_string).should.containDeep([
    'test_insert_many1',
    'test_insert_many2',
    'test_insert_many3',
    'test_insert_many4'])

  void response
}

async function driverDeleteOne() {

  let options, response, instances

  options = await promised(null, sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl
      .insertMany([
        { c_string: 'test_delete_one1' },
        { c_string: 'test_delete_one2' },
        { c_string: 'test_delete_one3' }
      ]).execute()

    const should = require('should'),
          options = org.objects.c_ctxapi_208_deleteacl.deleteOne({
            c_string: 'test_delete_one1'
          }).getOptions()

    options.operation.should.equal('deleteOne')
    should.exist(options.match)
    should.exist(options.match.c_string)
    options.match.c_string.should.equal('test_delete_one1')

    return options
  }, 'admin'))

  response = await runOperation(options)

  should.exist(response.body.data)
  response.body.data.should.equal(true)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.equal(instances.body.data.length, 2)
  instances.body.data.map(i => i.c_string).should.containDeep(
    ['test_delete_one2',
      'test_delete_one3'])

  await promised(null, sandboxed(function() {
    org.objects.c_ctxapi_208_deleteacl.insertOne({ c_string: 'test_delete_one1' }).execute()
  }))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.equal(response.body.data[0].data, 1)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  instances.body.data.length.should.equal(2)
  instances.body.data.map(i => i.c_string).should.containDeep([
    'test_delete_one2',
    'test_delete_one3'])

  void response
}

async function driverDeleteMany() {

  let options, response, instances

  options = await promised(null, sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl
      .insertMany([
        { c_string: 'test_delete_many1' },
        { c_string: 'test_delete_many2' },
        { c_string: 'test_delete_many3' },
        { c_string: 'test_delete_many4' },
        { c_string: 'test_delete_many5' }
      ]).execute()

    const should = require('should'),
          options = org.objects.c_ctxapi_208_deleteacl.deleteMany({
            $or: [
              { c_string: 'test_delete_many1' },
              { c_string: 'test_delete_many2' },
              { c_string: 'test_delete_many3' }
            ]
          }).getOptions()

    options.operation.should.equal('deleteMany')
    should.exist(options.match)
    should.exist(options.match.$or)
    options.match.$or.map(or => or.c_string).should.containDeep([
      'test_delete_many1', 'test_delete_many2', 'test_delete_many3'])

    return options
  }, 'admin'))

  response = await runOperation(options)

  should.exist(response.body.data)
  response.body.data.should.equal(3)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.equal(instances.body.data.length, 2)
  instances.body.data.map(i => i.c_string).should.containDeep(
    ['test_delete_many4',
      'test_delete_many5'])

  await promised(null, sandboxed(function() {
    org.objects.c_ctxapi_208_deleteacl.insertMany([
      { c_string: 'test_delete_many1' },
      { c_string: 'test_delete_many2' },
      { c_string: 'test_delete_many3' }
    ]).execute()
  }))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.equal(response.body.data[0].data, 3)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  instances.body.data.length.should.equal(2)
  instances.body.data.map(i => i.c_string).should.containDeep([
    'test_delete_many4',
    'test_delete_many5'])

  void response
}

async function driverPatchOne() {

  let options, response, instances

  await promised(null, sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl.insertOne({
      c_number: 4,
      c_boolean: true,
      c_string: 'stringA',
      c_string_b: 'stringB',
      c_string_array: ['first', 'second'],
      c_boolean_array: [true, false, true],
      c_number_array: [1, 9, 8, 55],
      c_doc_array: [{
        c_string: 'first_doc'
      }, {
        c_string: 'second_doc'
      }]
    }).execute()
  }, 'admin'))

  options = {
    object: 'c_ctxapi_208_deleteacl',
    operation: 'patchOne',
    match: {
      c_string: 'stringA'
    },
    ops: [{
      op: 'set',
      value: {
        c_number: 42,
        c_boolean: false,
        c_doc_array: [{
          c_string: 'third_doc'
        }, {
          c_string: 'fourth_doc'
        }]
      }
    }, {
      op: 'unset',
      value: {
        'c_string_b': 1
      }
    }, {
      op: 'push',
      path: 'c_string_array',
      value: ['third', 'fourth']
    }, {
      op: 'remove',
      path: 'c_number_array',
      value: [1, 55]
    }]
  }

  response = await runOperation(options)

  should.exist(response)
  validatePatchedResponse(response.body)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 1)
  validatePatchedResponse(instances.body.data[0])

  await promised(null, sandboxed(cleanInstances))
  await promised(null, sandboxed(function() {
    org.objects.c_ctxapi_208_deleteacl.insertOne({
      c_number: 4,
      c_boolean: true,
      c_string: 'stringA',
      c_string_b: 'stringB',
      c_string_array: ['first', 'second'],
      c_boolean_array: [true, false, true],
      c_number_array: [1, 9, 8, 55],
      c_doc_array: [{
        c_string: 'first_doc'
      }, {
        c_string: 'second_doc'
      }]
    }).execute()
  }))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  validatePatchedResponse(response.body.data[0].data)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  instances.body.data.length.should.equal(1)
  validatePatchedResponse(instances.body.data[0])

  void response
}

async function driverPatchMany() {

  let options, response, instances, updatedInstances, nonUpdatedInstance

  const insertInstances = function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl.insertMany([
      {
        c_number: 4,
        c_boolean: true,
        c_string: 'stringA',
        c_string_b: 'stringB',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, false, true],
        c_number_array: [1, 9, 8, 55],
        c_doc_array: [{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }]
      },
      {
        c_number: 1,
        c_boolean: false,
        c_string: 'stringA',
        c_string_b: 'anotherString',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, false, true],
        c_number_array: [1, 9, 8, 55],
        c_doc_array: [{
          c_string: 'asdasdasd'
        }, {
          c_string: 'qweqweqwe'
        }]
      }, {
        c_number: 88,
        c_boolean: true,
        c_string: 'doesNotMatch',
        c_string_b: 'aString',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, true, false, false, false, true],
        c_number_array: [567, 78987, 55, 956],
        c_doc_array: [{
          c_string: 'documentA'
        }, {
          c_string: 'documentC'
        }]
      }
    ]).execute()
  }

  await promised(null, sandboxed(insertInstances))

  options = {
    object: 'c_ctxapi_208_deleteacl',
    operation: 'patchMany',
    match: {
      c_string: 'stringA'
    },
    ops: [{
      op: 'set',
      value: {
        c_number: 42,
        c_boolean: false,
        c_doc_array: [{
          c_string: 'third_doc'
        }, {
          c_string: 'fourth_doc'
        }]
      }
    }, {
      op: 'unset',
      value: {
        'c_string_b': 1
      }
    }, {
      op: 'push',
      path: 'c_string_array',
      value: ['third', 'fourth']
    }, {
      op: 'remove',
      path: 'c_number_array',
      value: [1, 55]
    }]
  }

  response = await runOperation(options)

  should.exist(response)
  should.exist(response.body)
  should.exist(response.body.data)
  should.exist(response.body.data.updatedIds)
  response.body.data.updatedIds.length.should.equal(2)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 3)

  updatedInstances = instances.body.data.filter(i => i.c_string === 'stringA')
  updatedInstances.length.should.equal(2)

  validatePatchedResponse(updatedInstances[0])
  validatePatchedResponse(updatedInstances[1])

  nonUpdatedInstance = _.find(instances.body.data, i => i.c_string === 'doesNotMatch')
  should.exist(nonUpdatedInstance)
  nonUpdatedInstance.c_number.should.equal(88)
  nonUpdatedInstance.c_boolean.should.equal(true)
  nonUpdatedInstance.c_string_b.should.equal('aString')
  nonUpdatedInstance.c_string_array.length.should.equal(2)
  nonUpdatedInstance.c_string_array.should.containDeep(['first', 'second'])
  nonUpdatedInstance.c_boolean_array.length.should.equal(6)
  nonUpdatedInstance.c_boolean_array.should.containDeep([true, true, false, false, false, true])
  nonUpdatedInstance.c_number_array.length.should.containDeep(4)
  nonUpdatedInstance.c_number_array.should.containDeep([567, 78987, 55, 956])
  nonUpdatedInstance.c_doc_array.length.should.equal(2)
  nonUpdatedInstance.c_doc_array.should.containDeep([{ c_string: 'documentA' }, { c_string: 'documentC' }])

  await promised(null, sandboxed(cleanInstances))
  await promised(null, sandboxed(insertInstances))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.exist(response.body.data[0].data.updatedIds)
  response.body.data[0].data.updatedIds.length.should.equal(2)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 3)

  updatedInstances = instances.body.data.filter(i => i.c_string === 'stringA')
  updatedInstances.length.should.equal(2)

  validatePatchedResponse(updatedInstances[0])
  validatePatchedResponse(updatedInstances[1])

  nonUpdatedInstance = _.find(instances.body.data, i => i.c_string === 'doesNotMatch')
  should.exist(nonUpdatedInstance)
  nonUpdatedInstance.c_number.should.equal(88)
  nonUpdatedInstance.c_boolean.should.equal(true)
  nonUpdatedInstance.c_string_b.should.equal('aString')
  nonUpdatedInstance.c_string_array.length.should.equal(2)
  nonUpdatedInstance.c_string_array.should.containDeep(['first', 'second'])
  nonUpdatedInstance.c_boolean_array.length.should.equal(6)
  nonUpdatedInstance.c_boolean_array.should.containDeep([true, true, false, false, false, true])
  nonUpdatedInstance.c_number_array.length.should.containDeep(4)
  nonUpdatedInstance.c_number_array.should.containDeep([567, 78987, 55, 956])
  nonUpdatedInstance.c_doc_array.length.should.equal(2)
  nonUpdatedInstance.c_doc_array.should.containDeep([{ c_string: 'documentA' }, { c_string: 'documentC' }])

  void response
}

async function driverUpdateOne() {

  let options, response, instances

  await promised(null, sandboxed(function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl.insertOne({
      c_number: 4,
      c_boolean: true,
      c_string: 'stringA',
      c_string_b: 'stringB',
      c_string_array: ['first', 'second'],
      c_boolean_array: [true, false, true],
      c_number_array: [1, 9, 8, 55],
      c_doc_array: [{
        c_string: 'first_doc'
      }, {
        c_string: 'second_doc'
      }]
    }).execute()
  }, 'admin'))

  options = {
    object: 'c_ctxapi_208_deleteacl',
    operation: 'updateOne',
    match: {
      c_string: 'stringA'
    },
    update: {
      $set: {
        c_number: 42,
        c_boolean: false,
        c_doc_array: [{
          c_string: 'third_doc'
        }, {
          c_string: 'fourth_doc'
        }]
      },
      $unset: {
        'c_string_b': 1
      },
      $push: {
        c_string_array: ['third', 'fourth']
      },
      $remove: {
        c_number_array: [1, 55]
      }
    }
  }

  response = await runOperation(options)

  should.exist(response)
  validatePatchedResponse(response.body)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 1)
  validatePatchedResponse(instances.body.data[0])

  await promised(null, sandboxed(cleanInstances))
  await promised(null, sandboxed(function() {
    org.objects.c_ctxapi_208_deleteacl.insertOne({
      c_number: 4,
      c_boolean: true,
      c_string: 'stringA',
      c_string_b: 'stringB',
      c_string_array: ['first', 'second'],
      c_boolean_array: [true, false, true],
      c_number_array: [1, 9, 8, 55],
      c_doc_array: [{
        c_string: 'first_doc'
      }, {
        c_string: 'second_doc'
      }]
    }).execute()
  }))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  validatePatchedResponse(response.body.data[0].data)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  instances.body.data.length.should.equal(1)
  validatePatchedResponse(instances.body.data[0])

  void response
}

async function driverUpdateMany() {

  let options, response, instances, updatedInstances, nonUpdatedInstance

  const insertInstances = function() {

    /* global org */

    org.objects.c_ctxapi_208_deleteacl.insertMany([
      {
        c_number: 4,
        c_boolean: true,
        c_string: 'stringA',
        c_string_b: 'stringB',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, false, true],
        c_number_array: [1, 9, 8, 55],
        c_doc_array: [{
          c_string: 'first_doc'
        }, {
          c_string: 'second_doc'
        }]
      },
      {
        c_number: 1,
        c_boolean: false,
        c_string: 'stringA',
        c_string_b: 'anotherString',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, false, true],
        c_number_array: [1, 9, 8, 55],
        c_doc_array: [{
          c_string: 'asdasdasd'
        }, {
          c_string: 'qweqweqwe'
        }]
      }, {
        c_number: 88,
        c_boolean: true,
        c_string: 'doesNotMatch',
        c_string_b: 'aString',
        c_string_array: ['first', 'second'],
        c_boolean_array: [true, true, false, false, false, true],
        c_number_array: [567, 78987, 55, 956],
        c_doc_array: [{
          c_string: 'documentA'
        }, {
          c_string: 'documentC'
        }]
      }
    ]).execute()
  }

  await promised(null, sandboxed(insertInstances))

  options = {
    object: 'c_ctxapi_208_deleteacl',
    operation: 'updateMany',
    match: {
      c_string: 'stringA'
    },
    update: {
      $set: {
        c_number: 42,
        c_boolean: false,
        c_doc_array: [{
          c_string: 'third_doc'
        }, {
          c_string: 'fourth_doc'
        }]
      },
      $unset: {
        'c_string_b': 1
      },
      $push: {
        c_string_array: ['third', 'fourth']
      },
      $remove: {
        c_number_array: [1, 55]
      }
    }
  }

  response = await runOperation(options)

  should.exist(response)
  should.exist(response.body)
  should.exist(response.body.data)
  should.exist(response.body.data.updatedIds)
  response.body.data.updatedIds.length.should.equal(2)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 3)

  updatedInstances = instances.body.data.filter(i => i.c_string === 'stringA')
  updatedInstances.length.should.equal(2)

  validatePatchedResponse(updatedInstances[0])
  validatePatchedResponse(updatedInstances[1])

  nonUpdatedInstance = _.find(instances.body.data, i => i.c_string === 'doesNotMatch')
  should.exist(nonUpdatedInstance)
  nonUpdatedInstance.c_number.should.equal(88)
  nonUpdatedInstance.c_boolean.should.equal(true)
  nonUpdatedInstance.c_string_b.should.equal('aString')
  nonUpdatedInstance.c_string_array.length.should.equal(2)
  nonUpdatedInstance.c_string_array.should.containDeep(['first', 'second'])
  nonUpdatedInstance.c_boolean_array.length.should.equal(6)
  nonUpdatedInstance.c_boolean_array.should.containDeep([true, true, false, false, false, true])
  nonUpdatedInstance.c_number_array.length.should.containDeep(4)
  nonUpdatedInstance.c_number_array.should.containDeep([567, 78987, 55, 956])
  nonUpdatedInstance.c_doc_array.length.should.equal(2)
  nonUpdatedInstance.c_doc_array.should.containDeep([{ c_string: 'documentA' }, { c_string: 'documentC' }])

  await promised(null, sandboxed(cleanInstances))
  await promised(null, sandboxed(insertInstances))

  // list of operation results.
  response = await runAsBulkOperation(options)
  response.body.data[0].object.should.equal('operationResult')
  response.body.data[0].path.should.equal(`${options.operation}[0][0]`)
  should.exist(response.body.data[0].data.updatedIds)
  response.body.data[0].data.updatedIds.length.should.equal(2)

  instances = await fetchObjects('/c_ctxapi_208_deleteacl')

  should.exist(instances)
  should.exist(instances.body)
  should.exist(instances.body.data)
  should.equal(instances.body.data.length, 3)

  updatedInstances = instances.body.data.filter(i => i.c_string === 'stringA')
  updatedInstances.length.should.equal(2)

  validatePatchedResponse(updatedInstances[0])
  validatePatchedResponse(updatedInstances[1])

  nonUpdatedInstance = _.find(instances.body.data, i => i.c_string === 'doesNotMatch')
  should.exist(nonUpdatedInstance)
  nonUpdatedInstance.c_number.should.equal(88)
  nonUpdatedInstance.c_boolean.should.equal(true)
  nonUpdatedInstance.c_string_b.should.equal('aString')
  nonUpdatedInstance.c_string_array.length.should.equal(2)
  nonUpdatedInstance.c_string_array.should.containDeep(['first', 'second'])
  nonUpdatedInstance.c_boolean_array.length.should.equal(6)
  nonUpdatedInstance.c_boolean_array.should.containDeep([true, true, false, false, false, true])
  nonUpdatedInstance.c_number_array.length.should.containDeep(4)
  nonUpdatedInstance.c_number_array.should.containDeep([567, 78987, 55, 956])
  nonUpdatedInstance.c_doc_array.length.should.equal(2)
  nonUpdatedInstance.c_doc_array.should.containDeep([{ c_string: 'documentA' }, { c_string: 'documentC' }])

  void response
}

function validatePatchedResponse(response) {

  should.exist(response)
  should.not.exist(response.errCode)
  response.c_number.should.equal(42)
  response.c_boolean.should.equal(false)
  response.c_string.should.equal('stringA')
  should.not.exist(response.c_string_b)
  response.c_boolean_array.length.should.equal(3)
  response.c_boolean_array.should.containDeep([true, false, true])
  response.c_string_array.length.should.equal(4)
  response.c_string_array.should.containDeep(['first', 'second', 'third', 'fourth'])
  response.c_number_array.length.should.equal(2)
  response.c_number_array.should.containDeep([9, 8])
  response.c_doc_array.length.should.equal(2)
  response.c_doc_array.should.containDeep([{
    c_string: 'third_doc'
  }, {
    c_string: 'fourth_doc'
  }])
}

async function fetchObjects(path) {

  return server.sessions.admin
    .get(server.makeEndpoint(path))
    .set({ 'Medable-Client-Key': server.sessionsClient.key })
    .then()
}

async function runOperation(options) {

  return server.sessions.admin
    .post(server.makeEndpoint(`/${options.object}/db/${options.operation}`))
    .set({ 'Medable-Client-Key': server.sessionsClient.key })
    .send(options)
    .then()
}

async function runAsBulkOperation(options, { halt = true, wrap = true, output = true, name = '' } = {}) {

  return server.sessions.admin
    .post(server.makeEndpoint(`/org/db/bulk`))
    .set({ 'Medable-Client-Key': server.sessionsClient.key })
    .send({ ops: [{ ...options, halt, wrap, output, name }] })
    .then()
}
