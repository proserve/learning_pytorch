'use strict'

const _ = require('underscore'),
      async = require('async')

function Hook(name) {
  this.name = name
  this.$__beforeI = {}
  this.$__beforeE = {}
  this.$__afterI = {}
  this.$__afterE = {}
  this.$__failI = {}
  this.$__failE = {}
  this.interceptors = {}
}

Hook.prototype._add = function(name, inline, fn, taskId, overwrite) {

  const prop = this['$__' + name + (inline ? 'I' : 'E')]

  if (prop) {

    if (this.interceptors[name]) {
      fn = this.interceptors[name](inline, fn, taskId, overwrite)
    }

    if (!taskId) taskId = '$__anonymous'
    const list = prop[taskId]
    if (overwrite || !list) {
      prop[taskId] = [fn]
    } else if (!overwrite) {
      prop[taskId].push(fn)
    }
  }

  return this

}

Hook.prototype.intercept = function(name, interceptor) {

  this.interceptors[name] = null
  if (_.isFunction(interceptor)) {
    this.interceptors[name] = interceptor
  }

}

Hook.prototype.before = function(fn, taskId, overwrite) {
  return this._add('before', fn.length > 1, fn, taskId, overwrite)
}

Hook.prototype.after = function(fn, taskId, overwrite) {
  return this._add('after', fn.length > 1, fn, taskId, overwrite)
}

Hook.prototype.fail = function(fn, taskId, overwrite) {
  return this._add('fail', fn.length > 2, fn, taskId, overwrite)
}

Hook.prototype._flatten = function(object) {
  const flat = []
  for (const id in object) {
    if (object.hasOwnProperty(id)) {
      for (let i = 0; i < object[id].length; i++) {
        flat.push(object[id][i])
      }
    }
  }
  return flat
}

Hook.prototype.getRunnable = function(name, inline) {
  const prop = this['$__' + name + (inline ? 'I' : 'E')]
  return prop ? this._flatten(prop) : []
}

function Hooks(specs) {

  this.$__hooks = {}

  if (specs) {
    specs = _.isArray(specs) ? specs : [specs]
    for (let i = 0; i < specs.length; i++) {
      this.register(specs[i])
    }
  }

}

Hooks.prototype.register = function(name, before, after, fail) {

  if (_.isObject(name)) {
    before = name.before
    after = name.after
    fail = name.fail
    name = name.name
  }

  let hook = this.$__hooks[name]
  if (!hook) {
    hook = this.$__hooks[name] = new Hook(name)
  }
  if (before != null) {
    hook.before(before)
  }
  if (after != null) {
    hook.after(after)
  }
  if (fail != null) {
    hook.fail(fail)
  }
  return hook
}

Hooks.prototype.fire = function(scope, hookName, err, vars, callback) {

  if (err && !(err instanceof Error)) {
    err = new Error(err)
  }

  const parts = hookName.split('.'),
        name = _.initial(parts).join('.'), // so we can have things like post.create.before
        event = _.last(parts),
        self = this,
        hook = this.$__hooks[name]

  if (!hook) {
    setImmediate(callback, err)
    return
  }

  if (err) {
    async.eachSeries(hook.getRunnable('fail', true), function(handler, callback) {
      handler.call(scope, err, vars, function(e) {
        if (e !== err) {
          err = e
        }
        callback()
      })
    }, function() {
      hook.getRunnable('fail', false).forEach(function(fn) {
        fn.call(scope, err, vars)
      })
      callback(err)
    })
  } else {
    async.eachSeries(hook.getRunnable(event, true), function(handler, callback) {
      handler.call(scope, vars, callback)
    }, function(err) {
      if (err) {
        vars.event = event
        self.fire(scope, name + '.fail', err, vars, callback)
      } else {
        hook.getRunnable(event, false).forEach(function(fn) {
          fn.call(scope, vars)
        })
        callback(null)
      }
    })
  }
}

Hooks.prototype.findHook = function(name) {
  return this.$__hooks[name]
}

module.exports = Hooks
