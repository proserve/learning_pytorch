const { route } = require('decorators')

class RouteCxtapi617 {

  @route('POST c_617_pin_login', {
    name: 'c_617_pin_login',
    weight: 1,
    acl: [ 'account.anonymous' ]
  })
  pinLogin617({ body }) {
    return org.objects.accounts.login({
      c_pin_example: body('pin')
    }, {
      identifierProperty: 'c_pin_example',
      passwordLess: true
    })
  }

}
module.exports = RouteCxtapi617
