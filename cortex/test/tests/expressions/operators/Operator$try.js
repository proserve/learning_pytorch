const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should'),
      sandboxed = require('../../../lib/sandboxed')

let Undefined

describe('Expressions - Operator$try', function() {

  it('Operator$try - scripting should catch error.', sandboxed(function() {

    const should = require('should'),
          errCode = 'cortex.accessDenied.role',
          { run } = require('expressions'),
          result = run({
            $try: {
              input: { $throw: errCode },
              in: { $concat: ['caught ', '$$err.errCode'] }
            }
          })

    should(result).equal(`caught ${errCode}`)

  }))

  it('Operator$try - scripting should re-throw same error and rename $$err variable.', sandboxed(function() {

    const should = require('should'),
          { tryCatch } = require('util.values'),
          errCode = 'cortex.accessDenied.role',
          { run } = require('expressions'),

          [err] = tryCatch(
            () => run({
              $try: {
                input: { $throw: errCode },
                as: 'fault',
                in: { $throw: '$$fault' }
              }
            }))

    should(err.errCode).equal(errCode)

  }))

  it('Operator$try - scripting should ignore missing input.', sandboxed(function() {

    const should = require('should'),
          { tryCatch } = require('util.values'),
          { run } = require('expressions'),

          [err, result] = tryCatch(
            () => run({
              $try: {
              }
            }))

    should(err).be.Undefined()
    should(result).be.Null()

  }))

  it('Operator$try - scripting should ignore missing input/as/in', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $try: {
              }
            }
          )

    should(await ec.evaluate()).equal(Undefined)

  })

})
