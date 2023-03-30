const { route } = require('decorators'),
      { Transform } = require('runtime.transform'),
      { transform } = require('decorators-transform')

@transform({
  name: 'c_ctxapi_661_rt_transform',
  if: {
    $eq: [ '$$CONTEXT.principal.email', 'james+provider@medable.com' ]
  }
})
class ConditionalRTTransforms661 extends Transform {

  each(object, memo, { cursor }) {
    object.c_string = '*****'
    return object
  }

  afterAll(memo, { cursor }) {
    cursor.push({ completed: true })
    cursor.push('Transform completed!')
  }

}

class UtilityRoutes661 {

  @route({
    method: 'GET',
    path: 'get-accounts-as-rtcaller',
    weight: 1,
    principal: null
  })
  getAllAccountsRTCaller() {
    return org.objects.c_ctxapi_661_transforms_object.find()
      .transform('c_ctxapi_661_rt_transform')
  }

  @route({
    method: 'GET',
    path: 'get-accounts-as-provider',
    weight: 1,
    principal: {
      email: 'james+provider@medable.com'
    }
  })
  getAllAccountsAsProvider() {
    return org.objects.c_ctxapi_661_transforms_object.find()
      .skipAcl()
      .grant('read')
      .transform('c_ctxapi_661_rt_transform')
  }

}

module.exports = { ConditionalRTTransforms661, UtilityRoutes661 }
