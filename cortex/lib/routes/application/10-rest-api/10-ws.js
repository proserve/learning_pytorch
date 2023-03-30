'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      { AccessContext } = require('../../../acl'),
      AccessPrincipal = require('../../../access-principal'),
      { asyncHandler, promised } = require('../../../utils')

module.exports = function(express, router) {

  /**
   * this callback happens in the base environment context.
   */
  router.post('/integrations/ws/callback',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    asyncHandler(async(req) => {

      const { org, bearerToken, body: { event, room, message } = {} } = req,
            ac = new AccessContext(AccessPrincipal.synthesizeAnonymous(org)),
            { principal } = await promised(
              modules.authentication,
              'authenticateToken',
              ac,
              bearerToken,
              {
                clockTolerance: 60 // to enable processing of expiration.
              }
            ),
            scriptAc = new AccessContext(principal)

      if (['room.join', 'room.leave'].includes(event)) {
        const inScope =
          modules.authentication.authInScope(principal.scope, `ws.subscribe.${room}`) ||
          modules.authentication.authInScope(principal.scope, `ws.publish.${room}`)

        if (inScope) {
          return promised(
            modules.sandbox,
            'triggerScript',
            `ws.${event}.after`,
            null,
            scriptAc,
            { object: 'system' },
            { room, message, bearerToken }
          )
        }
      }

      return null

    })
  )

}
