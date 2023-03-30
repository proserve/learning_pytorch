'use strict'

const sandboxed = require('../../lib/sandboxed')

describe('Issues', function() {

  describe('CTXAPI-93 - __proto__ vulnerabilities', function() {

    it('should not allow __proto__ to be used anywhere as a property.', sandboxed(function() {

      /* global org, script */

      const tryCatch = require('util.values').tryCatch

      require('should')

      // read invalid path
      script.principal.read('name.__proto__.first').should.equal(script.principal.name.first)

      // insert bogus property
      JSON.stringify(
        org.objects.accounts
          .aggregate()
          .match({
            _id: script.principal._id
          })
          .project({
            _id: 1,
            __proto__: 'name.first'
          })
          .next()
      )
        .should.equal(JSON.stringify({ _id: script.principal._id }))

      // read bogus property path
      tryCatch(
        () => org.objects.accounts
          .aggregate()
          .match({
            _id: script.principal._id
          })
          .project({
            _id: 1,
            firstName: 'name.__proto__'
          })
          .next(),
        (err, result) => {
          if (!err || err.errCode !== 'cortex.invalidArgument.query' || err.path !== 'firstName') {
            throw new Error('this should have thrown an kUnsupportedOperation (Invalid field name: (name.__proto__) Error')
          }
        }
      )

    }))

  })

})
