const sandboxed = require('../../../lib/sandboxed'),
      should = require('should')

describe('Expressions - api$templates', function() {

  it('api$templates - load template', async() => {

    const result = await sandboxed(function() {

      const { run } = require('expressions')

      return run(
        {

          $templates: {
            load: [
              'email',
              'account-welcome'
            ]
          }

        }
      )

    })()

    should(result.name).equal('account-welcome')

  })

  it('api$templates - render template', async() => {

    const result = await sandboxed(function() {

      const { script } = global,
            { run } = require('expressions')

      return run(
        {
          $pathTo: [
            {
              $find: {
                input: {
                  $templates: {
                    render: [
                      'email',
                      'account-welcome',
                      {
                        $literal: {
                          account: script.principal
                        }
                      }
                    ]
                  }
                },
                cond: { $eq: ['$$this.name', 'plain'] }
              }
            },
            'output'
          ]

        }
      )

    })()

    should(result).be.a.String()

  })

})
