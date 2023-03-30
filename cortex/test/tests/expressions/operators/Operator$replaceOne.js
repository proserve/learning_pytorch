const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$replaceOne', function() {

  it('Operator$replaceOne', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          ec = expressions.createContext(
            ac,
            {
              $replaceOne: {
                input: 'this is my name',
                find: 'me',
                replacement: { $literal: '$' }
              }
            }
          )

    should(await ec.evaluate()).equal('this is my na$')

  })

})
