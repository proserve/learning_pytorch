const sandboxed = require('../../../lib/sandboxed')

describe('Expressions - Operator$throw', function() {

  it('Operator$try - scripting re-throw same error.', sandboxed(function() {
    const should = require('should'),
          { tryCatch } = require('util.values'),
          errCode = 'cortex.accessDenied.role',
          reason = 'able',
          { run } = require('expressions'),

          [err] = tryCatch(
            () => run({
              $try: {
                input: {
                  $try: {
                    input: { $throw: { errCode, reason } },
                    in: { $throw: '$$err' }
                  }
                },
                as: 'fault',
                in: { $throw: '$$fault' }
              }
            }))

    should(err.errCode).equal(errCode)
    should(err.reason).equal(reason)

  }))

  it('Operator$throw - scripting throw an errCode.', sandboxed(function() {

    const should = require('should'),
          { tryCatch } = require('util.values'),
          errCode = 'cortex.accessDenied.role',
          { run } = require('expressions'),

          [err] = tryCatch(
            () => run({
              $throw: errCode
            }))

    should(err.errCode).equal(errCode)

  }))

})
