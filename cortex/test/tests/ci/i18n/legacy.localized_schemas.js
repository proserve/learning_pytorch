const should = require('should'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      server = require('../../../lib/server')

describe('Features - CTXAPI-463 Localized Schemas', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org */
      org.objects.objects.insertOne({
        localized: true, // has to be first
        label: 'CTXAPI-463',
        name: 'c_ctxapi_463',
        defaultAcl: ['owner.delete'],
        createAcl: ['account.public'],
        properties: [{
          label: 'My Label',
          name: 'c_my_label',
          type: 'String',
          indexed: true
        }]
      }).execute()

      org.objects.objects.updateOne({ name: 'c_ctxapi_463' }, { $set: { properties: { name: 'c_my_label', label: 'Mi Etiqueta' } } }).locale('es_AR').execute()
    }))
  })

  after(async() => {
    await promised(null, sandboxed(function() {
      org.objects.objects.deleteOne({ name: 'c_ctxapi_463' }).execute()
    }))
  })

  it('check all schemas translations', async() => {
    const promises = []
    promises.push(new Promise((resolve, reject) => {
      server.sessions.provider
        .get(server.makeEndpoint('/schemas'))
        .set({
          ...server.getSessionHeaders(),
          'Accept-Language': 'en-US,en;q=0.9,en;q=0.7,it-IT;q=0.6,it;q=0.5,la;q=0.4'
        })
        .done(function(err, result) {
          try {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)

            const obj = result.data.filter(obj => obj.name === 'c_ctxapi_463')[0],
                  prop = obj.properties.filter(p => p.name === 'c_my_label')[0]
            should.equal(prop.label, 'My Label')
            resolve()
          } catch (e) {
            reject(e)
          }
        })
    }))
    promises.push(new Promise((resolve, reject) => {
      server.sessions.provider
        .get(server.makeEndpoint('/schemas'))
        .set({
          ...server.getSessionHeaders(),
          'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7,it-IT;q=0.6,it;q=0.5,la;q=0.4'
        })
        .done(function(err, result) {
          try {
            should.not.exist(err)
            should.exist(result)
            should.equal(result.object, 'list')
            should.exist(result.data)

            const obj = result.data.filter(obj => obj.name === 'c_ctxapi_463')[0],
                  prop = obj.properties.filter(p => p.name === 'c_my_label')[0]
            should.equal(prop.label, 'Mi Etiqueta')
            resolve()
          } catch (e) {
            reject(e)
          }
        })
    }))
    await Promise.all(promises)
  })

  it('check single schema translations', async() => {
    const promises = []
    promises.push(new Promise((resolve, reject) => {
      server.sessions.provider
        .get(server.makeEndpoint('/schemas/c_ctxapi_463'))
        .set({
          ...server.getSessionHeaders(),
          'Accept-Language': 'en-US,en;q=0.9,en;q=0.7,it-IT;q=0.6,it;q=0.5,la;q=0.4'
        })
        .done(function(err, result) {
          try {
            should.not.exist(err)
            should.exist(result)
            const prop = result.properties.filter(p => p.name === 'c_my_label')[0]
            should.equal(prop.label, 'My Label')
            resolve()
          } catch (e) {
            reject(e)
          }
        })
    }))
    promises.push(new Promise((resolve, reject) => {
      server.sessions.provider
        .get(server.makeEndpoint('/schemas/c_ctxapi_463'))
        .set({
          ...server.getSessionHeaders(),
          'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7,it-IT;q=0.6,it;q=0.5,la;q=0.4'
        })
        .done(function(err, result) {
          try {
            should.not.exist(err)
            should.exist(result)
            const prop = result.properties.filter(p => p.name === 'c_my_label')[0]
            should.equal(prop.label, 'Mi Etiqueta')
            resolve()
          } catch (e) {
            reject(e)
          }
        })
    }))
    await Promise.all(promises)
  })

})
