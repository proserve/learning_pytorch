'use strict'

const middleware = require('../../middleware'),
      modules = require('../../modules'),
      Fault = require('cortex-service/lib/fault'),
      {
        path: pathTo, array: toArray, findIdInArray, equalIds, rString, promised, asyncHandler
      } = require('../../utils'),
      acl = require('../../acl'),
      ap = require('../../access-principal'),
      routerCache = modules.cache.memory.add('cortex.sandbox.routers')

module.exports = function(express, router) {

  ['/routes', '/routes/*'].forEach(path => {
    router.all(
      path,
      middleware.body_parser.runtime.loose,
      asyncHandler(layeredRuntimeRouter)
    )
  })

  async function layeredRuntimeRouter(req, res) {

    if (!req.org.configuration.scripting.scriptsEnabled) {
      throw Fault.create('cortex.accessDenied.scriptsDisabled')
    }

    // 1. create a router from env runtime. each pass handles it's own client detection, auth, policy checking and script route.
    return Promise.resolve(null)

      .then(async() => {

        const runtime = await req.org.getRuntime(),
              method = req.method.toLowerCase(),
              methods = [method, '*'],
              cacheKey = `${req.org._id}.router.${method}`

        // build or select route
        let { router, build: { _id, sequence } = {} } = routerCache.get(cacheKey) || {}

        if (!router || runtime.build.sequence !== sequence || !equalIds(runtime.build._id, _id)) {
          router = createRouter(
            method,
            toArray(runtime.routes).filter(route => !route.configuration.system && methods.includes(route.configuration.method))
          )
          routerCache.set(cacheKey, { router, build: runtime.build })
        }

        return { router, runtime }

      })
      .then(({ router, runtime }) => {

        return new Promise((resolve, reject) => {

          // loop through each possible route, passing to the next one. this may be called several times.
          router(req, res, (err, { path, route, next } = {}) => {

            let routingError = err,
                orgApp,
                orgClient

            Promise.resolve(null)

              // hold on to the routing error and pass to output after client detection and authentication.
              .then(async() => {

                if (!routingError) {

                  req.scriptRoute = path // other modules require this property.
                  req.script = await modules.sandbox.getRuntimeModel(req.org, runtime, route)

                  const { configuration } = route,
                        apiKey = pathTo(findIdInArray(req.org.apps, '_id', configuration.apiKey), 'clients.0.key')

                  if (apiKey) {
                    req.headers['medable-client-key'] = apiKey
                    if (req.orgClient && apiKey !== req.orgClient.key) {
                      orgApp = req.orgApp
                      orgClient = req.orgClient
                      delete req.orgApp
                      delete req.orgClient
                    }
                  }

                }

              })

              // client detection. if it fails, revert back to the last good one.
              .then(async() => {
                //
                try {
                  await promised(middleware.client_detection, 'default', req, res)
                } catch (err) {
                  if (orgClient) {
                    req.orgApp = orgApp
                    req.orgClient = orgClient
                  }
                  throw err
                }

              })

              //  route auth and policy runners.
              .then(() => promised(null, routeAuthorizer, req, res))
              .then(() => promised(middleware, 'policy', req, res))

              // throw holdover routing error (maintaining legacy compatibility)
              .then(() => {
                if (routingError) {
                  throw (routingError)
                }
              })

              .then(async() => {

                let principal = req.principal,
                    ac = new acl.AccessContext(principal, null, { req }),
                    willPass = false,
                    response

                // check conditions based on source principal and pass to next if they aren't met.
                if (!(await modules.sandbox.fulfillsConditions(ac, route, { runtime }))) { // { parentScript, context, runtimeArguments } - none here
                  return next()
                }

                // body parsing options
                if (route.configuration.urlEncoded) {
                  await promised(middleware.body_parser.runtime, 'urlencoded', req, res)
                }

                if (route.configuration.plainText) {
                  await promised(middleware.body_parser.runtime, 'text', req, res)
                }

                // adjust principal for current route and check scoping.

                try {

                  principal = route.principal
                    ? await ap.create(req.org, route.principal)
                    : req.principal

                } catch (err) {
                  err.resource = `${route.metadata.resource}.principal`
                  throw err
                }

                const requiredScope = `script.execute.route.${route.metadata.scriptId}`,
                      runAc = new acl.AccessContext(principal, req.script, { req }),
                      access = runAc.resolveAccess({ acl: route.configuration.acl })

                ac = new acl.AccessContext(principal, null, { req })

                if (!modules.authentication.authInScope(principal.scope, requiredScope)) {
                  throw Fault.create('cortex.accessDenied.scope', { path: requiredScope })
                } else if (!access.hasAccess(acl.AccessLevels.Public)) {
                  throw Fault.create('cortex.accessDenied.route')
                }

                ac.option('originalPrincipal', req.principal._id)

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
      .then(result => {

        return result

      })
      .catch(err => {

        throw err

      })

  }

  function createRouter(method, routes) {

    const router = express.Router()

    let callback

    for (const route of routes) {

      const routePath = rString(route.configuration.path, '').replace(/^\/+/, ''),
            path = '/routes/' + routePath,
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
        callback(Fault.create('cortex.notFound.route', { path: req.path }))
      })

    }

  }

  /**
   * @defines req.principal
   */
  function routeAuthorizer(req, res, next) {

    const { org, script } = req,
          { principal: scriptPrincipal, runtimeContext } = script || {},
          configuration = runtimeContext?.configuration || script?.configuration || {},
          { authValidation = 'legacy', acl: routeAcl = [] } = configuration || {},
          anonAcl = routeAcl?.find(entry => entry.type === acl.AccessTargets.Account && equalIds(entry.target, acl.AnonymousIdentifier)),
          allowAnonymous = (routeAcl?.length === 0 || anonAcl),
          authorizeMiddleware = middleware.authorize({ allowAnonymous, passFault: true })

    if (runtimeContext && runtimeContext.principal) {
      req.principal = ap.synthesizeAccount({ org: req.org, accountId: runtimeContext.principal })
    }

    // if there's an account load error but the route runs as a specific principal, skip errors.
    authorizeMiddleware(req, res, err => {

      err = err || req.fault

      if (err) {

        req.principal = ap.synthesizeAccount({ org, accountId: acl.AnonymousIdentifier })

        if (
          scriptPrincipal ||
          authValidation === 'none' ||
          (authValidation === 'legacy' && err.errCode === 'cortex.accessDenied.sessionExpired')) {
          err = null
        }

      }

      next(err)
    })
  }

}
