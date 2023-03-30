const sandboxed = require('../../../lib/sandboxed'),
      should = require('should'),
      loadScript = require('../../../lib/script.loader'),
      { promised } = require('../../../../lib/utils')

describe('Expressions - Usage on runtime triggers', function() {

  before(async function() {
    const lib = loadScript('CTXAPI-689_expressions_trigger.js')
    await promised(null, sandboxed(function() {
      /* global org, script */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_689_band',
        name: 'c_ctxapi_689_band',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'c_band',
          name: 'c_band',
          indexed: true,
          type: 'String',
          array: true
        }, {
          label: 'Beatle',
          name: 'c_beatle',
          defaultValue: {
            type: 'static',
            value: false
          },
          indexed: true,
          type: 'Boolean'
        }]
      }).execute()

      org.objects.objects.insertOne({
        label: 'c_ctxapi_689_phrase',
        name: 'c_ctxapi_689_phrase',
        defaultAcl: 'role.administrator.delete',
        createAcl: 'account.public',
        properties: [{
          label: 'c_phrase',
          name: 'c_phrase',
          indexed: true,
          type: 'String',
          array: true
        }, {
          label: 'string',
          name: 'c_manager',
          indexed: true,
          type: 'String'
        }]
      }).execute()

      org.objects.scripts.insertOne({
        label: 'c_ctxapi_689_expressions_trigger_lib',
        name: 'c_ctxapi_689_expressions_trigger_lib',
        description: 'c_ctxapi_689_expressions_trigger_lib',
        script: script.arguments.lib,
        type: 'library',
        configuration: {
          export: 'c_ctxapi_689_expressions_trigger_lib'
        }
      }).execute()
    }, {
      runtimeArguments: { lib }
    }))
  })

  after(sandboxed(function() {
    org.objects.scripts.deleteOne({ name: 'c_ctxapi_689_expressions_trigger_lib' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_689_phrase' }).execute()
    org.objects.objects.deleteOne({ name: 'c_ctxapi_689_band' }).execute()
  }))

  it('should run a trigger only if $find expression matches', async() => {
    let result

    result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_689_band.insertOne({
        c_band: ['John', 'Paul']
      }).lean(false).execute()
    }))

    should.exist(result)
    should.equal(result.c_band.length, 2)
    should.equal(result.c_band[0], 'John')
    should.equal(result.c_band[1], 'Paul')
    should.equal(result.c_beatle, true)

    result = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_689_band.insertOne({
        c_band: ['Bob']
      }).lean(false).execute()
    }))

    should.exist(result)
    should.equal(result.c_band.length, 1)
    should.equal(result.c_band[0], 'Bob')
    should.equal(result.c_beatle, false)

  })

  it('should run a trigger only if $reduce expression matches', async() => {
    let correctPhrase,
        correctManager,
        incorrectPhrase,
        error

    correctPhrase = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_689_phrase.insertOne({
        c_phrase: ['RD', 'WO', 'ET', 'CR', 'SE', 'THE'],
        c_manager: 'William'
      }).lean(false).execute()
    }))

    should.exist(correctPhrase)
    should.equal(correctPhrase.c_phrase.length, 6)
    should.equal(correctPhrase.c_phrase[0], 'RD')
    should.equal(correctPhrase.c_phrase[1], 'WO')
    should.equal(correctPhrase.c_phrase[2], 'ET')
    should.equal(correctPhrase.c_phrase[3], 'CR')
    should.equal(correctPhrase.c_phrase[4], 'SE')
    should.equal(correctPhrase.c_phrase[5], 'THE')
    should.equal(correctPhrase.c_manager, 'William')

    correctManager = await promised(null, sandboxed(function() {
      return org.objects.c_ctxapi_689_phrase.insertOne({
        c_phrase: ['THIS', 'IS', 'NOT', 'RIGHT'],
        c_manager: 'Brian'
      }).lean(false).execute()
    }))

    should.exist(correctManager)
    should.equal(correctManager.c_phrase.length, 4)
    should.equal(correctManager.c_phrase[0], 'THIS')
    should.equal(correctManager.c_phrase[1], 'IS')
    should.equal(correctManager.c_phrase[2], 'NOT')
    should.equal(correctManager.c_phrase[3], 'RIGHT')
    should.equal(correctManager.c_manager, 'Brian')

    try {
      incorrectPhrase = await promised(null, sandboxed(function() {
        return org.objects.c_ctxapi_689_phrase.insertOne({
          c_phrase: ['THIS', 'IS', 'NOT', 'RIGHT'],
          c_manager: 'Charles'
        }).lean(false).execute()
      }))
    } catch (e) {
      error = e
    }

    should.not.exist(incorrectPhrase)
    should.exist(error)
    error.should.containDeep({
      object: 'fault',
      name: 'error',
      code: 'kAccessDenied',
      errCode: 'cortex.accessDenied.phrase',
      statusCode: 403,
      reason: 'The phrase is wrong!',
      message: 'Access to this resource is denied',
      index: 0
    })
  })
})
