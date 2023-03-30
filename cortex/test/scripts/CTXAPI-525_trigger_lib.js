const { trigger, on } = require('decorators'),
      cache = require('cache'),
      debug = require('debug'),
      should = require('should')

class Trigger525Object {

  // This is inline
  @trigger('ctx525__the_event.before', {
    object: 'system',
    weight: 1
  })
  before525Event({ context, runtime }) {
    debug.sleep(1000)
    should.not.exist(context)
    cache.set('ctxapi-525-before-runtime', runtime, 3000)
  }

  // This is not inline
  @trigger('ctx525__the_event.after', {
    object: 'system',
    weight: 1
  })
  after525Event({ context }) {
    debug.sleep(500)
    cache.set('ctxapi-525-after', 'After is done!', 3000)
  }

  @on('ctx525__the_event.name')
  on525Completed(name, age) {
    debug.sleep(500)
    cache.set('ctxapi-525-name', `Completed! ${name} is ${age} years old.`)
  }

}

module.exports = Trigger525Object
