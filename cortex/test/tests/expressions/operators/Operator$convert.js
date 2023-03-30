const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$convert', function() {

  it('Operator$convert - natural null', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $convert: {
                input: null,
                to: 'String'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal(null)

  })

  it('Operator$convert - onNull', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $convert: {
                input: null,
                to: 'String',
                onNull: 'null'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('null')

  })

  it('Operator$convert - conversion', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $convert: {
                input: 123,
                to: 'String'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('123')

  })

  it('Operator$convert - onError', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $convert: {
                input: '1',
                to: 'Object',
                onError: 'error'
              }
            }
          ),
          result = await ec.evaluate()

    should(result).equal('error')

  })

})
