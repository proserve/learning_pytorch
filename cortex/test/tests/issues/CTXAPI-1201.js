'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils'),
      should = require('should')

describe('Issues - CTXAPI-1201 - Adding invalid locale to error message.', function() {

  it('import invalid template locale should throw error with invalid locale', async() => {
    try {
      const result = await promised(null, sandboxed(function() {
        const { environment } = require('developer'),
              data = [
                { 'object': 'manifest', 'templates': { 'includes': ['email.dt__execution_status'] } },
                {
                  'description': 'Email to user when an data transfer completes or fails',
                  'label': 'Data Transfer Execution Status',
                  'localizations': [{
                    'locale': 'en_US',
                    'content': [{
                      'data': '{{#extend "layout"}}\n    {{#replace "title"}}\n    Data transfer execution: {{id}}\n    {{/replace}}\n    {{#replace "body"}}\n    {{#if completed}}\n        <p>Your transfer has been executed successfully.</p>\n    {{else}}\n        <p>There was en error executing the transfer.</p>\n        <p>{{{details}}}</p>\n    {{/if}}\n    {{/replace}}\n{{/extend}}',
                      'name': 'html'
                    }, {
                      'data': '{{#extend "layout"}}\n{{#replace "title"}}Data transfer execution: {{id}}{{/replace}}\n{{#replace "body"}}\n{{#if completed}}\nYour transfer has been executed successfully.\n{{else}}\nThere was en error executing the transfer.\n\n{{{details}}}\n{{/if}}\n{{/replace}}\n{{/extend}}',
                      'name': 'plain'
                    }, { 'data': 'Data Transfer execution {{id}}: {{status}}', 'name': 'subject' }]
                  }, {
                    'locale': 'ms_Latin_SG',
                    'content': [{
                      'data': '{{#extend "layout"}}\n    {{#replace "title"}}\n    Data transfer execution: {{id}}\n    {{/replace}}\n    {{#replace "body"}}\n    {{#if completed}}\n        <p>Your transfer has been executed successfully.</p>\n    {{else}}\n        <p>There was en error executing the transfer.</p>\n        <p>{{{details}}}</p>\n    {{/if}}\n    {{/replace}}\n{{/extend}}',
                      'name': 'html'
                    }, {
                      'data': '{{#extend "layout"}}\n{{#replace "title"}}Data transfer execution: {{id}}{{/replace}}\n{{#replace "body"}}\n{{#if completed}}\nYour transfer has been executed successfully.\n{{else}}\nThere was en error executing the transfer.\n\n{{{details}}}\n{{/if}}\n{{/replace}}\n{{/extend}}',
                      'name': 'plain'
                    }, { 'data': 'Data Transfer execution {{id}}: {{status}}', 'name': 'subject' }]
                  }],
                  'name': 'dt__execution_status',
                  'object': 'template',
                  'partial': false,
                  'type': 'email'
                }
              ]
        return environment.import(data, { backup: false, triggers: false }).toArray()
      }))
    } catch (ex) {
      should.equal(ex.reason, 'invalid locale: ms_Latin_SG')
    }
  })
})

/*

 */
