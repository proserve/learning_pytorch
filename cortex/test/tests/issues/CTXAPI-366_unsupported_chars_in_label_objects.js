'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues - CTXAPI-366 - allow special chars in label property', function() {

  it('allow labels starting with special chars', sandboxed(function() {

    /* global org, consts */
    const should = require('should'),
          result = org.objects.objects.insertOne({
            defaultAcl: [
              {
                type: consts.accessPrincipals.owner,
                allow: consts.accessLevels.delete
              }
            ],
            createAcl: [
              { type: consts.accessTargets.account, target: consts.principals.public }
            ],
            label: 'Label with unsupported characters',
            name: 'c_unsupported_label',
            properties: [
              {
                label: '# Does not support this',
                name: 'c_label_1',
                type: 'String'
              },
              {
                label: '- Does not support this',
                name: 'c_label_2',
                type: 'String'
              },
              {
                label: '> Does not support this',
                name: 'c_label_3',
                type: 'String'
              },
              {
                label: '$ Does not support this',
                name: 'c_label_4',
                type: 'String'
              },
              {
                label: '% Does not support this',
                name: 'c_label_5',
                type: 'String'
              },
              {
                label: '@ Does not support this',
                name: 'c_label_6',
                type: 'String'
              },
              {
                label: '1 Does not support this',
                name: 'c_label_7',
                type: 'String'
              },
              {
                label: 'just text',
                name: 'c_label_8',
                type: 'String'
              }
            ]
          }).execute()
    should.notEqual(result, null)

  }))

})
