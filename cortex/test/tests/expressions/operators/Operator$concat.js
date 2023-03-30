const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$concat', function() {

  it('Operator$concat', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $concat: ['something', ' - ', 'valuable']
            }
          )

    should(await ec.evaluate()).equal('something - valuable')

  })

  it('Operator$concat with undefined item', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $concat: ['something', undefined, 'valuable']
            }
          )

    should(await ec.evaluate()).equal(null)

  })

})
