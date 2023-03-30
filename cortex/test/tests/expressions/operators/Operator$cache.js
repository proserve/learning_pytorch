const server = require('../../../lib/server'),
      { expressions, cache } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$cache', function() {

  before((callback) => {
    cache.set(server.org, 'Operator$cache_key', 'my cache value ', callback)
  })

  it('Operator$cache', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $cache: 'Operator$cache_key'
            }
          )

    should(await ec.evaluate()).equal('my cache value ')

  })

  it('Operator$cache any other input should return undefined', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $cache: { $literal: { key: 'my_key' } }
            }
          )

    should(await ec.evaluate()).equal(undefined)

  })

})
