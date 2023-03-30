const server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should'),
      { ObjectID } = require('cortex-service/lib/utils/ids')

describe('Expressions - Operator$equals', function() {

  it('Operator$equals', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          oId = new ObjectID(),
          result = await Promise.all([
            expressions.createContext(ac, { $equals: { input: ['a', 'a'], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [2, 'a'], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [{ $toObjectId: '5f6d041f0000000000000000' }, { $toObjectId: '5f6d041f0000000000000000' }], cast: false } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [true, 1], cast: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: ['1', 1], cast: false, strict: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [oId, oId], cast: false, strict: true } }).evaluate(),
            expressions.createContext(ac, { $equals: { input: [oId, new ObjectID()], cast: false, strict: true } }).evaluate()
          ])

    should(result).deepEqual([true, false, true, true, false, true, false])

  })

})
