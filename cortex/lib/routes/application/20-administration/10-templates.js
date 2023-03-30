'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      utils = require('../../../utils')

module.exports = function(express, router) {

  // only developers allowed in here.

  /**
     * Create Template
     * @description Create a new template specification and en_US version 0 template
     * @param req.params.type
     * @param req.body.name
     * @param req.body.label
     * @param req.body.summary
     * @param req.body.paritla
     * @param req.body.variables
     */
  router.post('/templates/:type',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.create.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.create.template' }))
      }

      let specContent, payload = _.isObject(req.body) ? req.body : {}

      const name = modules.validation.formatCustomName(req.org.code, String(payload.name))

      try {
        specContent = modules.templates.getTemplateSpec(req.params.type, payload.partial)
      } catch (err) {
        return next(err)
      }

      async.waterfall([

        // install template spec. here, we will only support a single content entry.
        function(callback) {

          const spec = {
            nickname: payload.label,
            summary: payload.summary,
            content: specContent,
            variables: utils.array(payload.variables)
          }
          modules.db.models.template.installTemplateSpec(req.org, req.params.type, name, spec, { builtin: false, overwrite: false }, function(err) {
            callback(err)
          })
        },

        // install blank template content
        function(callback) {

          const content = specContent.map(function(content) {
            return {
              name: content.name,
              data: ''
            }
          })
          modules.db.models.template.updateTemplate(req.principal, 'en_US', req.params.type, name, content, { createOnly: true, activate: true, builtin: false }, function(err) {
            callback(err)
          })
        },

        // load template
        function(callback) {
          modules.db.models.template.listTemplates(req.principal, req.params.type, name, function(err, template) {
            callback(err, template)
          })
        }

      ], function(err, result) {
        utils.outputResults(res, err, result)
      })
    }
  )

  /**
     * List Templates
     * @param req.params.type
     * @param req.params.name
     */
  router.get('/templates/:type?/:name?',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.developer_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.read.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.read.template' }))
      }

      modules.db.models.template.listTemplates(req.principal, req.params.type, req.params.name, function(err, list) {
        utils.outputResults(res, err, list)
      })
    }
  )

  /**
     * Load Template
     * @param req.params.locale
     * @param req.params.type
     * @param req.params.name
     * @param req.query.version If set, returns a specific version instead of the current version. overridden by "latest". Exclusive of "fallback"
     * @param req.query.latest (Boolean=true) If false, returns the currently active version, instead of the latest version (the default).
     * @param req.query.fallback (Boolean=false) If set, returns the default locale content (en_US) if the requested locale was not found. Exclusive of "version".
     */
  router.get('/templates/:locale/:type/:name',
    middleware.client_detection.default,
    middleware.authorize.default,
    middleware.role_restricted.developer_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.read.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.read.template' }))
      }

      const options = {
              version: req.query.version,
              fallback: utils.stringToBoolean(req.query.fallback),
              latest: (req.query.latest === null || req.query.latest === undefined) ? (req.query.version === null || req.query.version === undefined) : utils.stringToBoolean(req.query.latest),
              spec: true,
              versions: true
            },
            locale = req.query.locale ?? req.params.locale

      modules.db.models.template.loadTemplate(req.principal, locale, req.params.type, req.params.name, options, function(err, result) {
        utils.outputResults(res, err, result)
      })
    }
  )

  /**
     * Update Template
     * @description Update template content. If the locale does not exist, it is created
     * @param req.params.locale
     * @param req.params.type
     * @param req.params.name
     * @param req.query.edit If set, edits the content of that version of the template, without creating a new revision
     * @param req.query.current Can be used to ensure no other process has versioned the template when updating by throwing cortex.conflict.staleDocument if the server version does not match the "current" argument
     * @param req.query.activate (Boolean=false) If true, activates the newly saved version
     */
  router.put('/templates/:locale/:type/:name',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.update.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.update.template' }))
      }

      const options = { edit: req.query.edit, current: req.query.current, activate: utils.stringToBoolean(req.query.activate), locale: req.body.locale },
            locale = req.body.original ?? [req.params.locale],
            { templates } = Array.isArray(req.body) ? { templates: req.body } : req.body
      modules.db.models.template.updateTemplate(req.principal, locale, req.params.type, req.params.name, templates, options, function(err) {
        if (err) next(err)
        else {
          const options = { version: req.query.edit, fallback: false, latest: false, spec: true, versions: true },
                locales = req.body.locale || [req.params.locale]
          modules.db.models.template.loadTemplate(req.principal, locales, req.params.type, req.params.name, options, function(err, result) {
            utils.outputResults(res, err, result)
          })
        }
      })
    }
  )

  /**
     * Activate Template
     * @description Set the active version of a template
     * @param req.params.locale
     * @param req.params.type
     * @param req.params.name
     * @param req.params.version
     */
  router.post('/templates/:locale/:type/:name/:version',
    middleware.body_parser.strict,
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.update.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.update.template' }))
      }

      modules.db.models.template.setActiveVersion(req.principal, req.params.locale, req.params.type, req.params.name, req.params.version, function(err) {
        if (err) next(err)
        else {
          const options = { version: req.params.version, fallback: false, latest: false, spec: true, versions: true }
          modules.db.models.template.loadTemplate(req.principal, req.params.locale, req.params.type, req.params.name, options, function(err, result) {
            utils.outputResults(res, err, result)
          })
        }
      })
    }
  )

  /**
     * Delete Localization
     * @description Delete a template localization. If version is omitted, the entire localization is deleted.
     * @param req.params.locale
     * @param req.params.type
     * @param req.params.name
     * @param req.params.version
     */
  router.delete('/templates/:locale/:type/:name/:version?',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.template' }))
      }

      modules.db.models.template.deleteTemplate(req.principal, req.params.locale, req.params.type, req.params.name, req.params.version, function(err) {
        utils.outputResults(res, err, true)
      })
    }
  )

  /**
     * Delete Template
     * @description Completely delete a template.
     * @param req.params.locale
     * @param req.params.type
     * @param req.params.name
     * @param req.params.version
     */
  router.delete('/templates/:type/:name',
    middleware.client_detection.default,
    middleware.authorize.default,
    config('app.env') === 'development' ? middleware.role_restricted.developer_only : middleware.role_restricted.org_admin_only,
    middleware.policy,
    function(req, res, next) {

      if (!modules.authentication.authInScope(req.principal.scope, 'object.delete.template')) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'object.delete.template' }))
      }

      modules.db.models.template.deleteTemplateType(req.principal, req.params.type, req.params.name, function(err) {
        utils.outputResults(res, err, true)
      })
    }
  )

}
