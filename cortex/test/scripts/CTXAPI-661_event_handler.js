const { on, trigger } = require('decorators'),
      cache = require('cache')

class EventHandler661 {

  @on('c_ctxapi_661_event')
  static triggerNow(param, runtime) {
    cache.set(`${runtime.context.key}`, param, 10000)
  }

  @trigger('err.events.failed')
  handleError({ context, params }) {
    cache.set('ctxapi_661_error', true, 10000)
  }

}

module.exports = EventHandler661
