const { route } = require('decorators')

class CTXAPI932Route {

  @route({
    method: 'GET',
    name: 'c_ctxapi_932_anonymous',
    path: 'c_ctxapi_932_anonymous',
    acl: [{ target: '000000000000000000000001', type: 1, access: 1 }],
    weight: 1
  })
  anonymousRoute({ req, body }) {
    return `Cool! you can access this ${script.principal.isAnonymous() ? 'anonymously' : script.principal.email}`
  }

  @route({
    method: 'GET',
    name: 'c_ctxapi_932',
    path: 'c_ctxapi_932',
    weight: 1,
    authValidation: 'all',
    acl: [ 'account.anonymous' ]
  })
  loggedRoute({ req, body }) {
    return `You are ${script.principal.email}!`
  }

  @route({
    method: 'GET',
    name: 'c_ctxapi_932_with_specific_acl',
    path: 'c_ctxapi_932_with_specific_acl',
    weight: 1,
    acl: [{ target: 'james+admin@medable.com', type: 1, allow: 1 }]
  })
  loggedPrincipalRoute({ req, body }) {
    return `You are James Admin!`
  }

  @route({
    method: 'GET',
    name: 'c_ctxapi_932_more_acl',
    path: 'c_ctxapi_932_more_acl',
    weight: 1,
    authValidation: 'all',
    acl: [
      'account.public',
      'account.anonymous'
    ]
  })
  moreAcls({ req, body }) {
    return `This can be accessed by org or anonymous`
  }

}

module.exports = CTXAPI932Route
