const { on, trigger } = require('decorators'),
      cache = require('cache')

class EventHandler1262 {

  @on('c_ctxapi_1262_event')
  static triggerNow(param, runtime) {
    cache.set(`${runtime.context.key}`, param, 10000)
  }

  @trigger('err.events.failed')
  handleError({ context, params }) {
    cache.set('ctxapi_1262_error', true, 10000)
  }

}

module.exports = EventHandler1262
