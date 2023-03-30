const server = require('../../../lib/server'),
      { expressions } = require('../../../../lib/modules'),
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$cmp', function() {

  it('Operator$cmp', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          result = await Promise.all([
            expressions.createContext(ac, { $cmp: ['a', 'a'] }).evaluate(),
            expressions.createContext(ac, { $cmp: ['b', 'a'] }).evaluate(),
            expressions.createContext(ac, { $cmp: ['a', 'b'] }).evaluate(),
            expressions.createContext(ac, { $cmp: [ { $toObjectId: '5ab9d2d331c2ab715d4212b3' }, { $toObjectId: '5ab9d2d331c2ab715d4212b3' } ] }).evaluate(),
            expressions.createContext(ac, { $cmp: [ { $toObjectId: '5ab9d2d331c2ab715d4212b3' }, { $toObjectId: '5ab9d2d331c2ab715d4212fa' } ] }).evaluate(),
            expressions.createContext(ac, { $cmp: [ { $toObjectId: '5ab9d2d331c2ab715d4212fa' }, { $toObjectId: '5ab9d2d331c2ab715d4212b3' } ] }).evaluate()
          ])

    should(result).deepEqual([
      0,
      1,
      -1,
      0,
      -1,
      1
    ])

  })

})
