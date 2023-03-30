const { route } = require('decorators')
class Ctxapi573Route {

  @route({
    weight: 1,
    method: 'POST',
    name: 'c_573_post',
    path: 'c_573_login',
    acl: [ 'account.anonymous' ]
  })
  ctxapi573method({ req, body }) {
    return org.objects.Account.login({
      username: body('username'),
      password: body('password')
    }, {
      verifyLocation: false
    }
    )
  }

}
module.exports = Ctxapi573Route
