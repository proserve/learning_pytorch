/* global consts, script, performance */

const { decorate } = require('decorator-utils'),
      { array: toArray, isSet } = require('util.values'),
      { equalIds } = require('util.id'),
      targets = {
        logger: {
          levels: new Set(['warn', 'error', 'info', 'debug', 'trace']),
          module: () => require('logger')
        },
        console: {
          levels: new Set(['warn', 'error', 'info']),
          module: () => console
        }
      }

function log(...args) {

  const lineNumber = script.getCurrentLineNumber(-3) // decorator declaration

  return decorate(
    (Class, methodName, descriptor, options) => {

      const fn = descriptor.value,
            className = Class.name || Class.constructor.name,
            {
              environment = '*',
              target = 'console',
              roles = ['*'],
              level = 'info',
              traceError = false,
              traceOnlyErrors = false,
              traceResult = false,
              format = null
            } = options[0] || {},
            acceptRoles = toArray(roles, isSet(roles)),
            anyRole = acceptRoles.includes('*'),
            isTargetFunction = (typeof target === 'function')

      if (typeof fn !== 'function') {
        throw new TypeError('@log can only be used on class functions')
      }
      // trivial rejection
      if (!['*', script.env.name].includes(environment)) {
        return descriptor
      } if (!isTargetFunction && (!targets[target] || (targets[target].level))) {
        return descriptor
      }

      return {
        ...descriptor,
        value: function value(...params) {

          // trivial rejection - re-test in case of changes
          if (
            (!['*', script.env.name].includes(environment)) ||
            (!isTargetFunction && (!targets[target] || (targets[target].level))) ||
            (!(anyRole || acceptRoles.find((accepted) => script.principal.roles.find((id) => equalIds(id, accepted) || equalIds(consts.roles[accepted], id)))))) {
            return fn.call(this, ...params)
          }

          let err,
              logged = false,
              result

          const start = performance.now(),
                log = {
                  className,
                  methodName,
                  lineNumber
                },
                post = () => {

                  if (logged) {
                    return
                  }

                  logged = true

                  if (traceOnlyErrors && !err) {
                    return
                  }

                  log.ms = performance.now() - start
                  if (err && traceError) {
                    log.err = err.toJSON()
                  }
                  if (!err && traceResult) {
                    log.result = result
                  }

                  try {
                    const input = typeof format === 'function' ? format(log) : log
                    if (isTargetFunction) {
                      target(input, level, ...params)
                    } else {
                      targets[target].module()[level](input)
                    }
                  } catch (err) {
                    void err
                  }

                }

          script.on('exit', post)

          try {
            result = fn.call(this, ...params)
          } catch (e) {
            err = e
          }

          script.removeListener('exit', post)
          post()

          if (err) {
            throw (err)
          }
          return result

        }
      }

    },
    args
  )
}

module.exports = log
