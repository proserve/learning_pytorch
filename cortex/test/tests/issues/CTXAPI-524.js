const should = require('should'),
      sandboxed = require('../../lib/sandboxed'),
      { promised } = require('../../../lib/utils')

describe('Issues - CTXAPI-524 script.as(script.principal) fails for role or service account', function() {

  before(async() => {
    await promised(null, sandboxed(function() {
      /* global org, consts */
      const contextObject = 'c_ctxapi_524_object',
            { [contextObject]: Model,
              objects: Objects
            } = org.objects

      if (Objects.find({ name: contextObject }).count() === 0) {

        Objects.insertOne({
          label: 'CTX-524 object',
          name: contextObject,
          defaultAcl: 'role.administrator.delete',
          createAcl: 'account.public',
          properties: [
            {
              name: 'c_string',
              label: 'A string',
              type: 'String',
              indexed: true
            }]
        }).execute()
      }

      Model.insertMany([
        { c_string: 'Adriane' },
        { c_string: 'Leia' },
        { c_string: 'Timi' }
      ]).execute()

      org.push('serviceAccounts', { name: 'c_ctxapi_524_sa', label: 'c_ctxapi_524_sa', roles: [consts.roles.admin] })

    }))
  })

  after(sandboxed(function() {
    org.objects.objects.deleteOne({ name: 'c_ctxapi_524_object' }).execute()
  }))

  it('Script should be run with script.as(service_account)', async() => {
    const result = await promised(null, sandboxed(function() {
      /* global org, script */
      const sa = org.read('serviceAccounts').find(sa => sa.name === 'c_ctxapi_524_sa')
      return script.as(sa, () => { return org.objects.c_ctxapi_524_objects.find().toArray() })
    }))
    should.exists(result)
    should.exist(result[0].c_string, 'Adriane')
    should.exist(result[1].c_string, 'Leila')
    should.exist(result[2].c_string, 'Timi')
  })

  it('Script should be run with script.as(serviceAccount name)', async() => {
    const result = await promised(null, sandboxed(function() {
      /* global org, script */
      return script.as({ name: 'c_ctxapi_524_sa' }, () => { return org.objects.c_ctxapi_524_objects.find().toArray() })
    }))
    should.exists(result)
    should.exist(result[0].c_string, 'Adriane')
    should.exist(result[1].c_string, 'Leila')
    should.exist(result[2].c_string, 'Timi')
  })

  it('Script should be run with script.as(role)', async() => {
    const result = await promised(null, sandboxed(function() {
      /* global org, script */
      const rol = org.read('roles').find(r => r.code === 'administrator')
      return script.as(rol, () => { return org.objects.c_ctxapi_524_objects.find().toArray() })
    }))
    should.exists(result)
    should.exist(result[0].c_string, 'Adriane')
    should.exist(result[1].c_string, 'Leila')
    should.exist(result[2].c_string, 'Timi')
  })

  it('Script should be run with script.as(role code)', async() => {
    const result = await promised(null, sandboxed(function() {
      /* global org, script */
      return script.as({ code: 'administrator' }, () => { return org.objects.c_ctxapi_524_objects.find().toArray() })
    }))
    should.exists(result)
    should.exist(result[0].c_string, 'Adriane')
    should.exist(result[1].c_string, 'Leila')
    should.exist(result[2].c_string, 'Timi')
  })

})
