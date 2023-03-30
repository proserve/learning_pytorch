const sandboxed = require('../../../lib/sandboxed'),
      server = require('../../../lib/server'),
      modules = require('../../../../lib/modules'),
      { expressions } = modules,
      { AccessContext } = require('../../../../lib/acl'),
      should = require('should')

describe('Expressions - Operator$function', function() {

  before(sandboxed(function() {
    /* global org */
    org.objects.objects.insertOne({
      name: 'c_operator_function_test',
      label: 'Test Obj',
      defaultAcl: 'owner.delete',
      createAcl: 'account.public',
      properties: [
        {
          name: 'c_string',
          label: 'String',
          type: 'String'
        }
      ]
    }).execute()
  }))

  it('Operator$function', async() => {

    const { principals: { admin } } = server,
          ac = new AccessContext(admin),
          result = await expressions.createContext(ac,
            {
              $function: {
                body: `return org.objects.objects.find({name: 'c_operator_function_test'}).next()`
              }
            }).evaluate()

    should(result.name).equal('c_operator_function_test')

  })

})
