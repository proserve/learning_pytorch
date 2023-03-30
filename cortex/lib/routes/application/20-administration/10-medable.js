'use strict'

const modules = require('../../../modules'),
      middleware = require('../../../middleware'),
      { equalIds, normalizeObjectPath, outputResults, promised, asyncHandler, toJSON, getIdOrNull, array: toArray } = require('../../../utils'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore'),
      acl = require('../../../acl'),
      fs = require('fs'),
      path = require('path'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        sandboxModules: () => require(`${__dirname}/../../../modules/sandbox/apis`).local.module
      }),
      // register patches ----------------------------------------------------------------------

      ThePatches = {
        medable: {},
        org: {}
      };
['medable', 'org'].forEach(type => {
  const basepath = path.join(__dirname, '..', '..', '..', 'patches', type)
  fs.existsSync(basepath) && fs.readdirSync(basepath).sort().forEach(file => {
    try {
      if (path.extname(file) === '.js') {

        const basename = path.basename(file, '.js'),
              command = require(path.join(basepath, file))

        if (!_.isFunction(command)) {
          return logger.error(`${type}.${basename} system command is not a function (${typeof command})`)
        }
        if ((type === 'medable' && command.length !== 1) || (type === 'org' && command.length !== 2)) {
          return logger.error(`${type}.${basename} system command arity is incorrect`)
        }
        ThePatches[type][basename] = command

      }
    } catch (err) {
      logger.error(`${file} system command load error`, toJSON(err, { stack: true }))
    }
  })
})

module.exports = function(express, router, service) {

  /**
   * Get Config
   */
  router.get('/sys/config',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    asyncHandler(async(req) => {

      const SysConfig = modules.db.models.SysConfig,
            _id = await SysConfig.getConfigId(),
            options = Object.assign(_.pick(req.query, 'paths', 'include', 'expand'), { req, grant: acl.AccessLevels.Read })

      return promised(SysConfig, 'aclReadOne', req.principal, { _id }, options)

    })
  )

  /**
   * Patch Config
   */
  router.patch('/sys/config',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    asyncHandler(async(req) => {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        throw Fault.create('cortex.accessDenied.scope', { path: 'admin.update' })
      }

      const SysConfig = modules.db.models.SysConfig,
            _id = await SysConfig.getConfigId(),
            options = Object.assign(_.pick(req.query, 'paths', 'include', 'expand'), { req, grant: acl.AccessLevels.Read })

      await SysConfig.updateConfig(req.principal, req.body)

      return promised(SysConfig, 'aclReadOne', req.principal, { _id }, options)

    })
  )

  /**
     * List Org
     */
  router.get('/sys/orgs/:orgId',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res, next) {
      const orgId = getIdOrNull(req.params.orgId)
      if (!orgId) {
        next()
      } else {
        const ac = new acl.AccessContext(req.principal, null, { req })
        modules.org.readOrg(ac, orgId, req.query, function(err, account) {
          outputResults(res, err, account)
        })
      }
    }
  )

  /**
     * List Orgs
     */
  router.get('/sys/orgs',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res) {

      const ac = new acl.AccessContext(req.principal, null, { req })

      modules.org.listOrgs(ac, null, req.query, function(err, list) {
        outputResults(res, err, list)
      })
    }
  )

  //   /**
  //    * sysCommand
  //    */
  // @route('GET sys/command/:command*', {
  //   name: 'c_sys_command', acl: 'role.developer', apiKey: 'c_status_monitoring'
  // })
  //   static sysGetCommand({ req: { params }, res }) {
  //
  //     const { command } = params,
  //       args = params[0].split('/').slice(1),
  //       result = sys[command](...args)
  //
  //     if (result && result.object === 'stream') {
  //       res.setHeader('Content-Disposition', 'attachment; filename="file.dat"')
  //     }
  //
  //     return result
  //
  //   }
  //
  //   /**
  //    * sysCommand
  //    */
  // @route('POST sys/command/:command', {
  //   name: 'c_sys_command', acl: 'role.developer', apiKey: 'c_status_monitoring'
  // })
  //   static sysPostCommand({ body, req: { params: { command } } }) {
  //
  //     return sys[command](...body())
  //
  //   }

  router.get('/sys/commands',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    asyncHandler(async() => {
      return Object.keys(lazy.sandboxModules.system)
    })
  )

  router.get('/sys/commands/:command*',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    asyncHandler(async(req) => {

      const { params, principal } = req,
            ac = new acl.AccessContext(principal),
            script = {
              ac,
              locale: ac.getLocale()
            },
            message = {},
            { command } = params,
            args = params[0].split('/').slice(1),
            result = await lazy.sandboxModules.system[command](script, message, args)

      return result

    })
  )

  router.post('/sys/commands/:command',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    asyncHandler(async(req) => {

      const { params, principal, body } = req,
            ac = new acl.AccessContext(principal),
            script = {
              ac,
              locale: ac.getLocale()
            },
            message = {},
            { command } = params,
            result = await lazy.sandboxModules.system[command](script, message, toArray(body))

      return result

    })
  )

  /**
     * List Available Commands
     */
  router.get('/sys/orgs/commands/:org',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.read')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.read' }))
      }

      let commands = Object.keys(ThePatches.org)
      if (equalIds(req.params.org, acl.BaseOrg)) {
        commands = commands.concat(Object.keys(ThePatches.medable))
      }
      outputResults(res, null, commands.sort())

    }
  )

  /**
     * Run command
     */
  router.post('/sys/orgs/:orgId/commands/:command',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res, next) {

      let patch, command = req.params.command.trim()

      const orgId = getIdOrNull(req.params.orgId),
            start = Date.now(),
            done = _.once((err, result) => {
              if (!err) {
                if (result == null) {
                  result = 'Ran system command "' + command + '" in ' + (Date.now() - start) + 'ms'
                }
              }
              outputResults(res, err, result)
            })

      if (!orgId) {
        return next()
      }

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      patch = ThePatches.org[command]
      if (!patch) {
        if (equalIds(orgId, acl.BaseOrg)) {
          patch = ThePatches.medable[command]
        }
      }
      if (!patch) {
        return next(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Unsupported Command' }))
      }

      try {
        switch (patch.length) {
          case 1:
            patch(done)
            break
          default:
            patch(orgId, done)
            break
        }
      } catch (err) {
        done(err)
      }

    }
  )

  /**
     * Update Org
     */
  router.put('/sys/orgs/:orgId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res) {

      modules.org.updateOrg(
        new acl.AccessContext(req.principal, null, { req }),
        req.params.orgId,
        req.body,
        req.query,
        (err, result) => outputResults(res, err, result)
      )

    }
  )

  /**
   * Patch Org
   */
  router.patch('/sys/orgs/:orgId',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.medable_admin_only,
    middleware.client_limits({ includeOrgs: 'medable', whitelist: config('administration.whitelist'), blacklist: config('administration.blacklist') }),
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'admin.update')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'admin.update' }))
      }

      const updatable = modules.hub.updatableEnvironmentPaths(req.org, [acl.OrgAdminRole]),
            options = {
              req: req,
              includeAccess: false,
              override: true,
              crossOrg: true,
              opCheck: function(ac, op) {
                const path = op.singlePath || op.path
                if (!path || !updatable.includes(normalizeObjectPath(path, true, true, true))) {
                  throw Fault.create('cortex.accessDenied.unspecified', { reason: `org path not accessible to sys admin`, path: path })
                }
              }
            }

      modules.db.models.org.aclPatch(req.principal, req.params.orgId, req.body, options, function(err) {
        if (err) next(err)
        else {
          modules.org.readOrg(req, req.params.orgId, function(err, account) {
            outputResults(res, err, account)
          })
        }
      })
    }
  )

}
