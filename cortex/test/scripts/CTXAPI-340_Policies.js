const { policy, route, log } = require('decorators'),
      { Transform } = require('runtime.transform'),
      { transform } = require('decorators-transform')

class RoutePolicies {

  @policy
  static redirectPolicy = {
    name: 'c_redirect',
    priority: 1,
    methods: 'get',
    paths: '/routes/test-policy-redirect',
    action: 'Redirect',
    redirectUrl: '/routes/test-policy-after-redirect',
    weight: 1
  }

  @log({ traceError: true })
  @route('POST test-route', { priority: 1 })
  testRoute({ body }) {
    return { text: 'Hi!', ...body() }
  }

  @log({ traceError: true })
  @route('GET test-route-halt', { priority: 1 })
  testHaltRoute() {
    return 'Hello!'
  }

  @log({ traceResult: true, traceError: true })
  @policy({ methods: ['post'], paths: '/routes/test-route', action: 'Script', weight: 1 })
  testRoutePolicy({ body }) {
    if (body('end')) {
      return 'ended!'
    }
    if (body('end_throw')) {
      throw Fault.create('cortex.accessDenied.policy', { reason: 'Because!' })
    }
    if (body('end_response')) {
      return require('response').end()
    }
    body('param', 'this is a param from policy')
  }

  @log({ traceResult: true, traceError: true })
  @policy({ methods: ['get'], paths: '/routes/test-route-halt', priority: 1 })
  routeHaltPolicy({ halt }) {
    return halt()
  }

  @log({ traceResult: true, traceError: true })
  @policy({ methods: ['get'], paths: '/routes/test-route-halt' })
  routeHaltPolicy2({ halt }) {
    const res = require('response')
    res.setStatusCode(404)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(new RangeError('no way, jesus maria!').toJSON()))
  }

  @route('GET get-all-accounts')
  getAllAccounts({ req, res, body, runtime }) {
    return org.objects.accounts.find().sort({ created: 1 }).limit(4).skipAcl(true).grant(8)
  }

  @policy
  static accountsTransform = {
    name: 'c_340_accounts_transform_policy',
    priority: 999,
    methods: 'get',
    paths: '/routes/get-all-accounts',
    action: 'Transform',
    transform: 'c_340_accounts_transform',
    environment: 'development'
  }

}

@transform('c_340_accounts_transform', { environment: 'development' })
class AccountsTransform extends Transform { // eslint-disable-line no-unused-vars

  each(object, memo, { cursor }) {
    if (object.email !== script.principal.email) {
      object.name.first = '*******'
      object.name.last = '*******'
    }
    return object
  }

  afterAll(memo, { cursor }) {
    cursor.push('Transform completed!')
  }

}

module.exports = RoutePolicies
