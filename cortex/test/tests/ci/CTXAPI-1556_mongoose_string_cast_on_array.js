/* eslint-disable one-var */
const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-1556 - Mongoose string cast backwards compatibility for one item array', function() {

  const runScript = async(cNames) => {
    const sandboxExecution = sandboxed(function() {
      /* global org script */
      org.objects.c_test_arrays.insertOne({
        'c_name': script.arguments.cNames
      }).bypassCreateAcl().grant('delete').execute()

      return org.objects.c_test_arrays.find().skipAcl().grant('delete').toArray()
    }, {
      runtimeArguments: { cNames }
    })

    return promised(null, sandboxExecution)
  }

  const fetchAll = async() => {
    return promised(null, sandboxed(function() {
      /* global org */
      return org.objects.c_test_arrays.find().skipAcl().grant('delete').toArray()
    }))
  }

  const truncate = async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      return org.objects.c_test_arrays.deleteMany({}).skipAcl().grant('delete').execute()
    }))
  }

  before(async function() {
    await promised(null, sandboxed(function() {
      /* global org */
      return org.objects.objects.insertOne({ name: 'c_test_array', label: 'Test Array', properties: [{ type: 'String', name: 'c_name', label: 'Name' }] }).execute()
    }))
  })

  after(async function() {
    await promised(null, sandboxed(function() {
      /* global org */
      return org.objects.objects.deleteOne({ name: 'c_test_array' }).execute()
    }))
  })

  it('should not fail executing the script for one item String array', async function() {
    await runScript(['c_name_1'])
    const results = await fetchAll()
    should.exist(results.filter(r => r.c_name === 'c_name_1')[0])
  })

  it('should not fail executing the script for primitive types', async function() {
    await truncate()
    await runScript('c_name_2')
    await runScript(12)
    await runScript('')

    const results = await fetchAll(),
          stringResult = results.filter(r => r.c_name === 'c_name_2')[0],
          intResult = results.filter(r => r.c_name === '12')[0],
          emptyResult = results.filter(r => r.c_name === '')[0]

    should.equal(3, results.length)
    should.exist(stringResult)
    should.exist(intResult)
    should.exist(emptyResult)
  })

  it('should not fail for empty array', async function() {
    await truncate()
    await runScript([])
    const results = await fetchAll(),
    emptyResult = results.filter(r => r.c_name === '')[0];
    should.equal(1, results.length)
    should.exist(emptyResult)
  })

  it('should fail executing the script for multiple item String array', async function() {
    let error = null
    try {
      await runScript(['c_name_1', 'c_name_2'])
    } catch (err) {
      error = err
    }

    should.exist(error)
    should.equal(error.faults[0].message, "Cast to string failed for value \"[ 'c_name_1', 'c_name_2' ]\" (type Array) at path \"c_name\"")
  })

  it('should fail executing the script for an object that cannot cast to string', async function() {
    let error = null
    try {
      await runScript({ c_name: 'c_name_3' })
    } catch (err) {
      error = err
    }

    should.exist(error)
    should.equal(error.faults[0].message, "Cast to string failed for value \"{ c_name: 'c_name_3' }\" (type Object) at path \"c_name\"")
  })
})
