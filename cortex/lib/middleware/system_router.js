'use strict'

const modules = require('../modules'),
      utils = require('../utils'),
      {
        isCustomName, promised, rString, array: toArray, equalIds, outputResults
      } = utils,
      acl = require('../acl'),
      AccessPrincipal = require('../access-principal')

module.exports = function(express, { allowSystemObjects = false } = {}) {

  return function systemRouter(req, res, next) {

    if (!(allowSystemObjects || isCustomName(req.object?.objectName)) || !req.org.configuration.scripting.scriptsEnabled) {
      return next()
    }

    let err, pass = false

    Promise.resolve(null)
      .then(async() => {

        // create/load router ------------------------------------------------

        const runtime = await req.org.getRuntime(),
              method = req.method.toLowerCase(),
              methods = [method, '*'],
              cacheKey = `${req.org._id}.system.${method}`,
              routerCache = modules.cache.memory.get('cortex.sandbox.routers'),
              filtered = toArray(runtime.routes).filter(route => route.configuration.system && methods.includes(route.configuration.method))

        if (filtered.length === 0) {
          pass = true
          return
        }

        // build or select route
        let { router, build: { _id, sequence } = {} } = routerCache.get(cacheKey) || {}

        if (!router || runtime.build.sequence !== sequence || !equalIds(runtime.build._id, _id)) {
          router = createRouter(method, filtered)
          routerCache.set(cacheKey, { router, build: runtime.build })
        }

        return new Promise((resolve, reject) => {

          // loop through each possible route, passing to the next one. this may be called several times.
          router(req, res, (err, { path, route, next } = {}) => {

            // no route pass to native routes.
            if (err) {
              return reject(err)
            } else if (!route) {
              pass = true
              return resolve()
            }

            Promise.resolve(null)
              .then(async() => {

                let principal = req.principal || AccessPrincipal.synthesizeAnonymous(req.org),
                    ac = new acl.AccessContext(principal, null, { req }),
                    willPass = false,
                    response

                req.scriptRoute = path // other modules require this property.
                req.script = await modules.sandbox.getRuntimeModel(req.org, runtime, route)

                // check conditions based on source principal and pass to next if they aren't met.
                if (!(await modules.sandbox.fulfillsConditions(ac, route, { runtime }))) {
                  return next()
                }

                // run the script
                response = await promised(
                  modules.sandbox,
                  'executeModel',
                  ac,
                  null,
                  req.script,
                  {
                    runtime,
                    api: {
                      route: {
                        next: function(script, message, err, callback) {
                          script.closeAllResourcesOnExit = true
                          willPass = true
                          return callback()
                        }
                      }
                    }
                  },
                  {}
                )

                if (willPass) {
                  return next()
                }
                resolve(response.results)

              })

              .catch(err => reject(err))

          })

        })

      })

      .catch(e => {
        err = e
      })
      .then(result => {
        if (err || pass) {
          next(err)
        } else {
          outputResults(res, null, result)
        }
      })

  }

  function createRouter(method, routes) {
    const router = express.Router()
    let callback
    for (const route of routes) {
      const routePath = rString(route.configuration.path, '').replace(/^\/+/, ''),
            path = '/' + routePath,
            handler = function(req, res, next) {
              callback(null, { path, route, next })
            }
      router[method](path, [handler])
      if (!routePath) {
        const path = '/routes'
        router[method](path, [handler])
      }
    }
    return function(req, res, next) {
      callback = next
      router.handle(req, res, function() {
        callback(null, {})
      })
    }
  }

}
