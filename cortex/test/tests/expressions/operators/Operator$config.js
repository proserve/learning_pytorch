const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$config', function() {

  before((done) => {
    modules.config.set(server.org, 'test_conf_key', 'my value', done)
  })

  it('Operator$config', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $config: 'test_conf_key'
            }
          )

    should(await ec.evaluate()).equal('my value')

  })

  it('Operator$configs any other input should return undefined', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $config: { $literal: { key: 'my_key' } }
            }
          )

    should(await ec.evaluate()).equal(undefined)

  })

})
