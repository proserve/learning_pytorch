const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      { path: pathTo } = require('../../../../lib/utils'),
      should = require('should')

describe('Expressions - Operator$pathTo', function() {

  it('Operator$pathTo - ', async() => {

    let result

    const path = 'deep.path.in.the.object',
          value = true,
          { principals: { admin } } = server,
          ac = new AccessContext(admin)

    result = await expressions.createContext(
      ac,
      {
        $pathTo: ['$$ROOT', path, value]
      },
      {
        $$ROOT: {
          a: 1,
          b: 2,
          c: 3
        }
      }
    ).evaluate()

    should.equal(pathTo(result, path), value)

    result = await expressions.createContext(
      ac,
      {
        $pathTo: ['$$ROOT', path]
      },
      {
        $$ROOT: result
      }
    ).evaluate()

    should.equal(result, value)

  })

})
