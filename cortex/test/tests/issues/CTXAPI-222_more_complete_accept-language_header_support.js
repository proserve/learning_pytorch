'use strict'

/* global script */

const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      server = require('../../lib/server'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-222 - Accept-Language Header Support.', function() {

  const strings = {
    en_US: 'howdy',
    en_GB: 'cheerio',
    fr_CA: 'salut'
  }
  let instanceId

  before(async() => {

    instanceId = await promised(null, sandboxed(function() {

      /* global org */

      const { Objects, c_ctxapi_222: Model } = org.objects,
            { arguments: { strings } } = script

      Objects.insertOne({
        label: 'CTXAPI-222',
        name: 'c_ctxapi_222',
        defaultAcl: 'owner.delete',
        createAcl: 'account.public',
        properties: [
          {
            label: 'String',
            name: 'c_string',
            type: 'String',
            localization: {
              enabled: true,
              fallback: false
            }
          }
        ]
      }).execute()

      return Model.insertOne({
        locales: {
          c_string: Object.keys(strings).reduce((memo, locale) => memo.concat({ locale, value: strings[locale] }), [])
        }
      }).execute()

    },
    {
      runtimeArguments: {
        strings
      }
    }))

  })

  after(sandboxed(function() {

    /* global org */

    const { Objects } = org.objects
    Objects.deleteOne({ name: 'c_ctxapi_222' }).execute()

  }))

  async function getLocalizedValue(acceptLanguage = '') {

    return new Promise((resolve, reject) => {

      const headers = server.getSessionHeaders()

      if (acceptLanguage) {
        headers['Accept-Language'] = acceptLanguage
      }
      server.sessions.admin
        .get(server.makeEndpoint(`/c_ctxapi_222/${instanceId}/c_string`))
        .set(headers)
        .done(function(err, result) {
          return err ? reject(err) : resolve(result && result.data)
        })
    })

  }

  async function runLocalizedScript(acceptLanguage = '', code) {

    return new Promise((resolve, reject) => {

      const headers = server.getSessionHeaders(),
            script = code.toString().replace(/^function[\s]{0,}\(\)[\s]{0,}\{([\s\S]*)\}$/, '$1')

      if (acceptLanguage) {
        headers['Accept-Language'] = acceptLanguage
      }

      server.sessions.admin
        .post(server.makeEndpoint('/sys/script_runner'))
        .set(headers)
        .send({
          script,
          arguments: { strings, instanceId } })
        .done((err, result) => {
          return err ? reject(err) : resolve(result && result.data)
        })
    })

  }

  it('rest api accepted header variations', async() => {

    ;(await getLocalizedValue('en-gb, en;q=0.9')).should.equal(strings.en_GB)
    ;(await getLocalizedValue('en;q=0.9, fr-CA;q=0.8')).should.equal(strings.en_US)
    ;(await getLocalizedValue('en;q=0.8, fr-CA;q=0.9')).should.equal(strings.fr_CA)
    ;(await getLocalizedValue('en-us')).should.equal(strings.en_US)
    ;(await getLocalizedValue('en')).should.equal(strings.en_US)
    ;(await getLocalizedValue('en-gb')).should.equal(strings.en_GB)
    ;(await getLocalizedValue('en, fr')).should.equal(strings.en_US)
    ;(await getLocalizedValue('fr')).should.equal(strings.fr_CA)
    ;(await getLocalizedValue('fr, en')).should.equal(strings.fr_CA)

    should.not.exist(await getLocalizedValue('de'))

  })

  it('script accepted header variations', async() => {

    async function getLocalizedValueFromScript(acceptLanguage = '') {

      return runLocalizedScript(acceptLanguage, function() {

        const { c_ctxapi_222: Model } = org.objects,
              { arguments: { instanceId: _id } } = script

        return Model.find({ _id }).pathRead('c_string')
      })

    }

    ;(await getLocalizedValueFromScript('en-gb, en;q=0.9')).should.equal(strings.en_GB)
    ;(await getLocalizedValueFromScript('en;q=0.9, fr-CA;q=0.8')).should.equal(strings.en_US)
    ;(await getLocalizedValueFromScript('en;q=0.8, fr-CA;q=0.9')).should.equal(strings.fr_CA)
    ;(await getLocalizedValueFromScript('en-us')).should.equal(strings.en_US)
    ;(await getLocalizedValueFromScript('en')).should.equal(strings.en_US)
    ;(await getLocalizedValueFromScript('en-gb')).should.equal(strings.en_GB)
    ;(await getLocalizedValueFromScript('en, fr')).should.equal(strings.en_US)
    ;(await getLocalizedValueFromScript('fr')).should.equal(strings.fr_CA)
    ;(await getLocalizedValueFromScript('fr, en')).should.equal(strings.fr_CA)

    should.not.exist(await getLocalizedValueFromScript('de'))

  })

  it('explicit overrides for script and request', async() => {

    await runLocalizedScript('en-gb, en;q=0.9', function() {

      const should = require('should'),
            { c_ctxapi_222: Model } = org.objects,
            req = require('request'),
            { arguments: { strings, instanceId: _id } } = script

      function getLocalizedValue(locale = null) {
        if (locale) {
          script.locale = locale
        }
        return Model.find({ _id }).pathRead('c_string')
      }

      getLocalizedValue().should.equal(strings.en_GB)

      req.locale = 'en_US'
      getLocalizedValue().should.equal(strings.en_US)

      getLocalizedValue('en_US').should.equal(strings.en_US)
      getLocalizedValue('fr_CA').should.equal(strings.fr_CA)
      getLocalizedValue('en_GB').should.equal(strings.en_GB)

      should.not.exist(getLocalizedValue('en'))
      should.not.exist(getLocalizedValue('fr'))
      should.not.exist(getLocalizedValue('de'))

    })

  })

  it('null accept-language header', async() => {

    await runLocalizedScript(null, function() {

      require('should')

      const { c_ctxapi_222: Model } = org.objects,
            { arguments: { strings, instanceId: _id } } = script

      function getLocalizedValue(locale = null) {
        if (locale) {
          script.locale = locale
        }
        return Model.find({ _id }).pathRead('c_string')
      }

      getLocalizedValue().should.equal(strings.en_US)

    })

  })

  it('wildcard accept-language header', async() => {

    await runLocalizedScript('*', function() {

      require('should')

      const { c_ctxapi_222: Model } = org.objects,
            { arguments: { strings, instanceId: _id } } = script

      function getLocalizedValue(locale = null) {
        if (locale) {
          script.locale = locale
        }
        return Model.find({ _id }).pathRead('c_string')
      }

      getLocalizedValue().should.equal(strings.en_US)

    })

  })

})
