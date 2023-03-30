const { object, trigger, route, log } = require('decorators')

@object('c_thing')
class Foo {

  @trigger('create.before', 'create.after', { object: 'c_ping', weight: 1 })
  @trigger('create.before', { object: 'c_test', weight: 1 })
  static beforeCreateOrUpdate({ memo, context, event, inline, dryRun, runtime, old, new: deprecatedNew }) {

    if (context.object === 'c_test') {
      throw new Error('no way!')
    }

    if (event === 'create.before') {

      context.update('c_pong', 'foo')

      // old style code still works
      script.arguments.new.update('c_pong', context.read('c_pong') + '.bar')

      // set a property on the memo to pass along to other triggers
      memo('x', '.baz')

    } else {

      // this is registered called for multiple event types.
      // this is registered called for multiple event types. it logs
      // "c_ping.create.before @Foo.beforeCreateOrUpdate 21:2"
      // TRACE
      //  String:beforeCreateOrUpdate:47
      //
      require('logger').info(`${context.object}.${event} ${runtime.metadata.resource}`)
    }
  }

}

class Ping extends CortexObject {

  // run first no api key set, will use that of the caller.
  @log({ traceError: true })
  @route('* *', { priority: 999 })
  static count({ req, res, next, runtime }) {

    try {
      res.setHeader('Content-Type', 'application/x-ndjson')
    } catch (err) {}

    res.write(JSON.stringify({ route: `${runtime.configuration.method} /routes/${runtime.configuration.path}`, key: req.client.key, principal: script.principal.email, resource: runtime.metadata.resource }) + '\n')

    next()
  }

  // run second, but only if pingCount is 1. pins the app to c_dashboard
  @log({ traceError: true })
  @route('POST pingCount/1', { apiKey: 'c_dashboard', priority: 2 })
  static countAgain({ req, res, next, runtime }) {

    try {
      res.setHeader('Content-Type', 'application/x-ndjson')
    } catch (err) {}

    res.write(JSON.stringify({ route: `${runtime.configuration.method} /routes/${runtime.configuration.path}`, key: req.client.key, principal: script.principal.email, resource: runtime.metadata.resource }) + '\n')

    next()

  }

  // run last
  @log({ traceError: true })
  @route('POST pingCount/:num', { priority: 1 })
  static countOnceMore({ req, res, runtime }) {

    try {
      res.setHeader('Content-Type', 'application/x-ndjson')
    } catch (err) {}

    res.write(JSON.stringify({ route: `${runtime.configuration.method} /routes/${runtime.configuration.path}`, key: req.client.key, principal: script.principal.email, resource: runtime.metadata.resource }) + '\n')

  }

}

module.exports = {
  Foo,
  Ping
}
