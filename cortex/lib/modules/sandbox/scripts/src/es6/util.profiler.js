/* global performance */

import clone from 'clone'

let profiled = {},
    running = {},
    enabled = false

const profiler = {

  get enabled() {
    return enabled
  },

  set enabled(v) {
    enabled = !!v
  },

  start(what) {
    const now = performance.now()
    if (enabled) {
      running[what] = now
    }
    return now
  },

  end(what, record = true) {

    if (enabled) {
      const start = running[what]
      if (start) {
        delete running[what]
        const ms = performance.now() - start
        if (record) {
          let section = profiled[what]
          if (!section) {
            section = {
              count: 0,
              total: 0,
              avg: 0,
              max: 0,
              min: 0
            }
            profiled[what] = section
          }
          section.count += 1
          section.total += ms
          section.avg = section.total / section.count
          section.max = section.count === 1 ? ms : Math.max(section.max, ms)
          section.min = section.count === 1 ? ms : Math.min(section.min, ms)
        }
        return ms
      }
    }
    return 0

  },

  profile(what, fn, scope = null) {

    if (!enabled) {
      return fn.call(scope)
    }

    let err,
        result

    profiler.start(what)
    try {
      result = fn.call(scope)
    } catch (e) {
      err = e
    }

    profiler.end(what, true)

    if (err) {
      throw err
    }
    return result

  },

  reset() {
    profiled = {}
    running = {}
  },

  report(formatted = false) {

    return formatted
      ? Object.entries(profiled)
        .map(([what, section]) => ({
          what,
          ...section
        }))
        .sort((a, b) => b.what - a.what)
        .map((v) => `${v.what} - avg: ${v.avg.toFixed(3)}, min: ${v.min.toFixed(3)}, max: ${v.max.toFixed(3)}, count: ${v.count}, total: ${v.total.toFixed(3)}`)
      : clone(profiled)
  }

}

module.exports = profiler
