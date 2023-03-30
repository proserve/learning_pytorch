const server = require('../../../lib/server'),
      sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      { waitForWorker } = require('../../../lib/utils')(),
      modules = require('../../../../lib/modules'),
      should = require('should')

describe('Templates i18n helper', function() {

  before(async() => {

    await promised(null, sandboxed(function() {
      // create templates
      /* global org */
      const { environment } = require('developer'),
            data = [
              { 'object': 'manifest', 'templates': { 'includes': ['*'] } },
              {
                'description': 'Template with i18n',
                'label': 'Template with i18n',
                'localizations': [{
                  'locale': ['en_US'],
                  'content': [{
                    'data': `<p dir="{{lngDir}}">{{i18n "app_templates:com.medable.my_string_app" data=data }}</p>`,
                    'name': 'html'
                  }, {
                    'data': 'Plain text',
                    'name': 'plain'
                  }, { 'data': 'Subject', 'name': 'subject' }]
                }
                ],
                'name': 'c_template_i18n',
                'object': 'template',
                'partial': false,
                'type': 'email'
              },
              {
                'description': 'Template with i18n',
                'label': 'Template with i18n - all locales',
                'localizations': [{
                  'locale': ['*'],
                  'content': [{
                    'data': `<div dir="{{lngDir}}">{{i18n "app_templates:com.medable.my_string_app" data=data }}</div>`,
                    'name': 'html'
                  }, {
                    'data': '{{i18n "app_templates:com.medable.my_string_app" }}',
                    'name': 'plain'
                  }, { 'data': 'Subject', 'name': 'subject' }]
                }],
                'name': 'c_template_i18n_all_locales',
                'object': 'template',
                'partial': false,
                'type': 'email'
              }
            ]
      return environment.import(data, { backup: false, triggers: false }).toArray()

    }))
    // create some bundles
    await promised(null, sandboxed(function() {
      // create i18n objects to then after create the bundles.
      global.org.objects.i18n.insertMany([
        {
          locale: 'en_US',
          namespace: 'app_templates',
          assets: [{
            key: 'com.medable.my_asset_file',
            value: {
              content: {
                source: 'buffer',
                buffer: 'my_asset_file'
              }
            }
          }],
          name: 'test__en_US_app_templates',
          data: {
            com: {
              medable: {
                my_string_app: 'app1 my string {{data.value}}'
              }
            }
          }
        },
        {
          locale: 'es_ES',
          namespace: 'app_templates',
          name: 'test__es_ES_app_templates',
          data: {
            com: {
              medable: {
                my_string_app: 'app1 texto {{ data.value }}'
              }
            }
          }
        },
        {
          locale: 'he_IL',
          namespace: 'app_templates',
          name: 'test__he_IL_app_templates',
          data: {
            com: {
              medable: {
                my_string_app: 'հավելված 1 տեքստ {{ data.value }}'
              }
            }
          }
        }
      ]).skipAcl().grant(8).execute()
      const i18n = require('i18n')
      return i18n.buildBundles()
    }))
  })

  after(async() => {
    // delete bundles / i18n objects.
    await waitForWorker(server, 'instance-reaper',
      () => promised(null, sandboxed(function() {
        const action1 = global.org.objects.i18n.deleteMany().skipAcl().grant(8).execute(),
              action2 = global.org.objects.i18nbundle.deleteMany().skipAcl().grant(8).execute()
        return [action1, action2]
      })), { forceWorkerRun: true })
  })

  it('should return a translated template', async function() {

    const result = await promised(null, sandboxed(function() {
      // return template render
      const templates = require('templates'),
            renderResult = templates.render('email', 'c_template_i18n', { data: { value: '123456' } })
      return renderResult
    }))

    should(result[0].output).equal('<p dir="ltr">app1 my string 123456</p>')

  })

  it('should return a translated template rtl', async function() {

    const result = await promised(null, sandboxed(function() {
      // return template render
      global.script.locale = 'he_IL'
      const templates = require('templates'),
            renderResult = templates.render('email', 'c_template_i18n_all_locales', { data: { value: '123456' } })
      return renderResult
    }))

    should(result[0].output).equal('<div dir="rtl">հավելված 1 տեքստ 123456</div>')

  })

  it('should return a translated template for all locales', async function() {

    const result = await promised(null, sandboxed(function() {
      // return template render
      const templates = require('templates'),
            renderResult = templates.render('email', 'c_template_i18n_all_locales', { data: { value: '12345' } }, { locale: 'es_ES' }),
            renderResult2 = templates.render('email', 'c_template_i18n_all_locales', { data: { value: '54321' } }, { locale: 'en_US' })
      return [renderResult, renderResult2]
    }))
    should(result[0][0].output).equal('<div dir="ltr">app1 texto 12345</div>')
    should(result[1][0].output).equal('<div dir="ltr">app1 my string 54321</div>')

  })

  it('should precompile again the template if versions does not match', async function() {

    const template = await modules.db.models.template.findOneAndUpdate({
            name: 'c_template_i18n_all_locales', locale: { $in: ['*'] }
          }, { $set: { 'current.compiled.async_compiler_version': '0.0.1' } }, { new: true }),
          // let's precompile on flight and assing new version
          renderedTemplate = await promised(null, sandboxed(function() {
            return require('templates').render('email', 'c_template_i18n_all_locales')
          })),
          templateAfter = await modules.db.models.template.findOne({
            name: 'c_template_i18n_all_locales', locale: { $in: ['*'] }
          }),
          secondRenderedTemplate = await promised(null, sandboxed(function() {
            return require('templates').render('email', 'c_template_i18n_all_locales')
          })),
          templateAfterSecond = await modules.db.models.template.findOne({
            name: 'c_template_i18n_all_locales', locale: { $in: ['*'] }
          })
    should.exist(template)
    template.current.compiled.async_compiler_version.should.equal('0.0.1')
    should.exist(renderedTemplate)
    templateAfter.current.compiled.async_compiler_version.should.not.equal('0.0.1')
    templateAfter.sequence.should.equal(1)
    should.exist(secondRenderedTemplate)
    // meaning no precompile again
    templateAfterSecond.sequence.should.equal(1)
  })

})
