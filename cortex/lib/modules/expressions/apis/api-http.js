const Api = require('../api'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault')

class Api$http extends Api {

  static sandboxModule = 'http'

  parse(value, expression) {

    if (config('app.env') !== 'development' || config('app.domain') === 'market') {
      throw Fault.create('cortex.invalidArgument.query', { reason: `$http is not available in this environment.`, path: expression.fullPath })
    }

    super.parse(
      value,
      expression
    )
  }

  // this is temporary until we convert everything to contexts.
  getSandboxParams(ec, instance) {

    void instance

    const { ac } = ec,
          script = {
            ac,
            stats: {
              callouts: 0,
              bytesIn: 0,
              bytesOut: 0,
              calloutsMs: 0
            },
            start_time: new Date(),
            timeoutMs: 1000000,
            configuration: {
              isInline: false,
              limits: {
                maxCallouts: 1,
                maxCalloutRequestSize: 10000000,
                maxCalloutRequestTimeout: 100000,
                maxCalloutResponseSize: 1000000
              }
            }
          },
          message = {}

    return { script, message }
  }

}

module.exports = Api$http
