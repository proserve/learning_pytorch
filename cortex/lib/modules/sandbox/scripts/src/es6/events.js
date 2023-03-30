const pEvents = Symbol('events')

export class Emitter {

  on(name, fn) {
    if (!this[pEvents]) {
      this[pEvents] = {}
    }
    if (!this[pEvents][name]) {
      this[pEvents][name] = fn
    } else if (Array.isArray(this[pEvents][name])) {
      this[pEvents][name].push(fn)
    } else {
      this[pEvents][name] = [this[pEvents][name], fn]
    }
    return this
  }

  once(name, fn) {
    const self = this
    this.on(name, function() {
      self.removeListener(name, fn)
      fn.apply(this, arguments)
    })
    return this
  }

  addListener(...args) {
    return this.on(...args)
  }

  removeListener(name, fn) {
    if (this[pEvents] && this[pEvents][name]) {
      const list = this[pEvents][name]
      if (Array.isArray(list)) {
        let pos = -1
        for (let i = 0, l = list.length; i < l; i++) {
          if (list[i] === fn) {
            pos = i
            break
          }
        }
        if (pos < 0) {
          return this
        }
        list.splice(pos, 1)
        if (!list.length) {
          delete this[pEvents][name]
        }
      } else if (list === fn) {
        delete this[pEvents][name]
      }
    }
    return this
  }

  removeAllListeners(name) {
    if (name === undefined) {
      this[pEvents] = {}
      return this
    }
    if (this[pEvents] && this[pEvents][name]) {
      this[pEvents][name] = null
    }
    return this
  }

  listeners(name) {
    if (!this[pEvents]) {
      this[pEvents] = {}
    }
    if (!this[pEvents][name]) {
      this[pEvents][name] = []
    }
    if (!Array.isArray(this[pEvents][name])) {
      this[pEvents][name] = [this[pEvents][name]]
    }
    return this[pEvents][name].slice()
  }

  emit(name, ...args) {
    if (!this[pEvents]) {
      return false
    }
    const handler = this[pEvents][name]
    if (!handler) {
      return false
    }
    if (typeof handler === 'function') {
      handler.apply(this, args)
    } else if (Array.isArray(handler)) {
      const listeners = handler.slice()
      for (let i = 0, l = listeners.length; i < l; i++) {
        listeners[i].apply(this, args)
      }
    } else {
      return false
    }
    return true
  }

}
