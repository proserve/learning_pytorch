'use strict'

const sandboxed = require('../../../lib/sandboxed'),
      { promised } = require('../../../../lib/utils'),
      should = require('should')

describe('Features - CTXAPI-997 - Add expression in templates', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      // create templates
      /* global org */
      const { environment } = require('developer'),
            data = [
              { 'object': 'manifest', 'objects': [{ 'name': 'c_object_test' }], 'templates': { 'includes': ['email.c_template_simple_expression', 'email.c_template_iterator_expression'] } },
              {
                name: 'c_object_test',
                label: 'c_object_test',
                object: 'object',
                createAcl: ['account.public'],
                defaultAcl: ['owner.delete'],
                properties: [{
                  name: 'c_first_name',
                  label: 'c_first_name',
                  type: 'String',
                  indexed: true
                }, {
                  name: 'c_last_name',
                  label: 'c_last_name',
                  type: 'String',
                  indexed: true
                }]
              },
              {
                'description': 'Template with simple expression',
                'label': 'Template with simple expression',
                'localizations': [{
                  'locale': 'en_US',
                  'content': [{
                    'data': `<p>{{#expression simpleExp}}<label>First Name:</label><b>{{this.c_first_name}}</b><br /><label>Last Name</label><b>{{this.c_last_name}}</b>{{/expression}}</b>`,
                    'name': 'html'
                  }, {
                    'data': 'Plain text',
                    'name': 'plain'
                  }, { 'data': 'Subject', 'name': 'subject' }]
                }
                ],
                'name': 'c_template_simple_expression',
                'object': 'template',
                'partial': false,
                'type': 'email'
              },
              {
                'description': 'Template with iterator expression',
                'label': 'Template with iterator expression',
                'localizations': [{
                  'locale': 'en_US',
                  'content': [{
                    'data': `<ul>{{#each (expression iterableExp)}}<li>{{this.c_first_name}} {{this.c_last_name}}</li>{{/each}}</ul>`,
                    'name': 'html'
                  }, {
                    'data': 'Plain text',
                    'name': 'plain'
                  }, { 'data': 'Subject', 'name': 'subject' }]
                }
                ],
                'name': 'c_template_iterator_expression',
                'object': 'template',
                'partial': false,
                'type': 'email'
              }
            ]
      environment.import(data, { backup: false, triggers: false }).toArray()

      org.objects.c_object_test.insertMany([{
        c_first_name: 'Gaston',
        c_last_name: 'Robledo'
      }, {
        c_first_name: 'Joaquin',
        c_last_name: 'Lencinas'
      }]).execute()
    }))
  })

  it('should return a template with a simple expression result', async function() {

    const result = await promised(null, sandboxed(function() {
      // return template render
      const templates = require('templates'),
            renderResult = templates.render('email', 'c_template_simple_expression', {
              simpleExp: {
                $dbNext: {
                  operation: 'cursor',
                  object: 'c_object_test',
                  sort: { _id: 1 },
                  skipAcl: true,
                  grant: 4,
                  limit: 1
                }
              }
            })
      return renderResult

    }))

    should.exists(result)
    should.deepEqual(result, [
      {
        name: 'html',
        output: '<p><label>First Name:</label><b>Gaston</b><br /><label>Last Name</label><b>Robledo</b></b>'
      },
      {
        output: 'Plain text',
        name: 'plain'
      },
      {
        output: 'Subject',
        name: 'subject'
      }
    ])

  })

  it('should return a template with an iterable expression result', async function() {

    const result = await promised(null, sandboxed(function() {
      // return template render
      const templates = require('templates'),
            renderResult = templates.render('email', 'c_template_iterator_expression', {
              iterableExp: [
                {
                  $cursor: {
                    operation: 'cursor',
                    object: 'c_object_test',
                    skipAcl: true,
                    grant: 4,
                    sort: { _id: 1 }
                  }
                }
              ]
            })
      return renderResult
    }))

    should.exists(result)
    should.deepEqual(result, [
      {
        name: 'html',
        output: '<ul><li>Gaston Robledo</li><li>Joaquin Lencinas</li></ul>'
      },
      { name: 'plain', output: 'Plain text' },
      { name: 'subject', output: 'Subject' }
    ])

  })

})
