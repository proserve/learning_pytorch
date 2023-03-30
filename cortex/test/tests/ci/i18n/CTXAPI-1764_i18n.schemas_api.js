const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      should = require('should'),
      { waitForWorker } = require('../../../lib/utils')()
describe('Schema API translations using i18n bundles', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      global.org.objects.i18n.insertMany([
        {
          locale: 'fr_FR',
          namespace: 'cortex',
          name: 'test__fr_FR_cortex',
          data: {
            object: {
              c_car: {
                label: 'voiture',
                description: 'description de la voiture',
                properties: {
                  c_horsepower: {
                    label: 'chevaux',
                    description: 'nombre des chevaux'
                  },
                  c_mileage: {
                    label: 'kilomètrage',
                    description: 'nombre de kilomètre'
                  }
                }
              },
              account: {
                label: 'compte',
                description: 'compte de l\'utilisateur',
                properties: {
                  c_firstname: {
                    label: 'Prénom',
                    description: 'Prénom de l\'utilisateur'
                  },
                  c_lastname: {
                    label: 'Nom',
                    description: 'Nom de l\'utilisateur'
                  }
                }
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()

      const i18n = require('i18n')
      i18n.buildBundles()

      global.org.objects.object.insertOne({
        localized: true,
        useBundles: true,
        name: 'c_car',
        label: 'Car',
        description: 'Object used to store cars specs',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [{
          type: 'String',
          name: 'c_brand',
          label: 'Brand',
          description: 'car brand'
        }, {
          type: 'Number',
          name: 'c_horsepower',
          label: 'Horsepower',
          description: 'car horsepower'
        }, {
          type: 'Number',
          name: 'c_mileage',
          label: 'Mileage',
          description: 'car mileage'
        }]
      }).execute()

      global.org.objects.object.insertOne({
        localized: true,
        useBundles: true,
        name: 'account',
        label: 'Account',
        properties: [{
          type: 'String',
          name: 'c_firstname',
          label: 'Firstname',
          description: 'account firstname'
        }, {
          type: 'String',
          name: 'c_lastname',
          label: 'Lastname',
          description: 'account lastname'
        }]
      }).execute()
    }))
  })
  after(async() => {
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const action1 = global.org.objects.objects.deleteOne({ name: 'c_car' }).execute(),
              action2 = global.org.objects.objects.updateOne({ name: 'account' }, { $set: { useBundles: false } }).skipAcl().grant(8).execute(),
              action3 = global.org.objects.i18n.deleteMany({ name: 'fr_FR_cortex' }).skipAcl().grant(8).execute(),
              action4 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [action1, action2, action3, action4]
      })), { forceWorkerRun: true })
  })

  it("Given useBundle is true, object definition schema should be pulled from bundles instead of schema's locales ", async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body.data.find(({ name }) => name === 'c_car')

    should(object.label).equal('voiture')
    should(object.description).equal('description de la voiture')

  })

  it('Given useBundle is true, object definition schema properties should be translated as per the bundles definitions', async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body.data.find(({ name }) => name === 'c_car')

    const horsepower = object.properties.find(property => property.name === 'c_horsepower')
    should(horsepower.label).equal('chevaux')
    should(horsepower.description).equal('nombre des chevaux')

    const mileage = object.properties.find(property => property.name === 'c_mileage')
    should(mileage.label).equal('kilomètrage')
    should(mileage.description).equal('nombre de kilomètre')
  })

  it('Given a filed is not translated, object definition schema return default value', async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body.data.find(({ name }) => name === 'c_car')

    const brand = object.properties.find(property => property.name === 'c_brand')
    should(brand.label).equal('Brand')
    should(brand.description).equal('car brand')
  })

  it('Given useBundle is true, native object schema Label and description should be translated using bundles', async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body.data.find(({ name }) => name === 'account')

    should(object.label).equal('compte')
    should(object.description).equal('compte de l\'utilisateur')

  })
  it('Given useBundle is true, properties added to native object definition schema should translated using bundles', async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body.data.find(({ name }) => name === 'account')

    const firstname = object.properties.find(property => property.name === 'c_firstname')
    should(firstname.label).equal('Prénom')
    should(firstname.description).equal('Prénom de l\'utilisateur')

    const lastname = object.properties.find(property => property.name === 'c_lastname')
    should(lastname.label).equal('Nom')
    should(lastname.description).equal('Nom de l\'utilisateur')

  })

  it('Given useBundle is true, properties added to native object definition schema should translated using bundles with one instance as well', async function() {

    const resp = await server.sessions.admin
      .get(server.makeEndpoint('/schemas/c_car'))
      .set({
        ...server.getSessionHeaders(),
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7,it-IT'
      }).expect(200)

    let object = resp.body

    const horsepower = object.properties.find(property => property.name === 'c_horsepower')
    should(horsepower.label).equal('chevaux')
    should(horsepower.description).equal('nombre des chevaux')

    const mileage = object.properties.find(property => property.name === 'c_mileage')
    should(mileage.label).equal('kilomètrage')
    should(mileage.description).equal('nombre de kilomètre')

  })

})
