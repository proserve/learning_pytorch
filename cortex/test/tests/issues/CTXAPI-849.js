'use strict'

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-849 printableString should work ok with extended unicode data', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        label: 'c_ctxapi_849',
        name: 'c_ctxapi_849',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            name: 'c_string',
            label: 'String',
            type: 'String',
            validators: [
              {
                name: 'printableString',
                definition: {
                  min: 1,
                  max: 100
                }
              },
              {
                name: 'required'
              }]
          }, {
            name: 'c_string2',
            label: 'String',
            type: 'String',
            validators: [
              {
                name: 'printableString',
                definition: {
                  allowNumberAsFirstLetter: true,
                  min: 1,
                  max: 64
                }
              }]
          }]
      }).execute()
    }))
  })

  it('printableString should validate properly unicode chars', async function() {
    const result = await promised(null, sandboxed(function() {
      const ids = []
      ids.push(org.objects.c_ctxapi_849.insertOne({
        c_string: 'ગ્રૂપ'
      }).execute())
      ids.push(org.objects.c_ctxapi_849.insertOne({
        c_string: 'खाता'
      }).execute())
      ids.push(org.objects.c_ctxapi_849.insertOne({
        c_string: 'ಖಾತೆ'
      }).execute())

      ids.push(org.objects.c_ctxapi_849.insertOne({
        c_string: 'ସାଇଟ୍ ଆପ୍‍ ସେଟିଂସ୍'
      }).execute())

      ids.push(org.objects.c_ctxapi_849.insertOne({
        c_string: '’n Mensvriendelike beskrywing van die groep, sal wys in studiebouer.'
      }).execute())

      return ids
    }))

    should(result.length).equal(5)

  })

  it('printableString should fail in a property with allowNumberAsFirstLetter', async function() {
    try {
      await promised(null, sandboxed(function() {
        return org.objects.c_ctxapi_849.insertOne({
          c_string: 'ok',
          c_string2: '$%ગ્રૂપ'
        }).execute()
      }))
    } catch (ex) {
      should(ex.faults[0].path).equal('c_ctxapi_849.c_string2')
      should(ex.faults[0].errCode).equal('cortex.invalidArgument.invalidString')
    }

  })

  it('printableString should fail on control characters', async() => {
    try {
      await promised(null, sandboxed(function() {
        return org.objects.c_ctxapi_849.insertOne({
          c_string: '\t\n\r'
        }).execute()
      }))
    } catch (ex) {
      should(ex.faults[0].path).equal('c_ctxapi_849.c_string')
      should(ex.faults[0].errCode).equal('cortex.invalidArgument.invalidString')
    }
  })

})
