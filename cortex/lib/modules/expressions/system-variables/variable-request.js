const SystemVariable = require('../system-variable'),
      Fault = require('cortex-service/lib/fault'),
      { pathParts, getClientIp, path: pathTo } = require('../../../utils')

class SystemVariable$REQUEST extends SystemVariable {

  parse(value, expression) {

    expression.root.registerVariable('$$REQUEST')

    const [root, path = ''] = pathParts(value)

    if (root !== '$$REQUEST') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$$REQUEST must start with $$REQUEST.`, path: expression.fullPath })
    }

    super.parse(
      path,
      expression
    )

  }

  async evaluate(ec) {

    const { ac: { req } } = ec

    let value = ec.root.getVariable('$$REQUEST')
    if (!value) {
      value = SystemVariable$REQUEST.toObject(req)
      ec.root.setVariable('$$REQUEST', value)
    }

    return ec.readObject(value, this.value)

  }

  static toObject(req) {

    req = req || {}

    const headers = Object.keys(req.headers || {}).reduce(function(copy, key) {
            if (key === 'cookie') {
              // remove md and medable cookies
              copy['cookie'] = (req.headers['cookie'] || '').split(';').filter(function(str) {
                str = str.trim()
                return !(str.indexOf('md') === 0 || str.indexOf('medable') === 0)
              }).join(';').trim()
            } else if (~['cookie', 'x-forwarded-for', 'x-real-ip', 'medable-csrf-token'].indexOf(key)) {
              // skip
            } else if (key === 'authorization' && pathTo(req, 'authToken.cortex/spt')) {
              // skip showing bearer token when any way privileged.
            } else {
              copy[key] = req.headers[key]
            }
            return copy
          }, {}),
          params = (() => {
            const { params = {} } = req
            return Object.keys(params).reduce((memo, key) => {
              memo[key] = params[key]
              return memo
            }, {})
          })(),
          ipv4 = getClientIp(req),
          {
            _id, method, hostname: host, url, path, query, locale,
            orgApp: { name: clientName } = {},
            orgClient: { _id: clientId, key: clientKey } = {},
            object: { objectName: object } = {}
          } = req

    return {
      _id,
      method,
      headers,
      ip: ipv4,
      ipv4,
      host,
      url,
      path,
      query,
      params,
      locale,
      object,
      client: {
        _id: clientId,
        key: clientKey,
        name: clientName
      }
    }

  }

}

module.exports = SystemVariable$REQUEST
