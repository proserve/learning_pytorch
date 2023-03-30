'use strict'

const Fault = require('cortex-service/lib/fault'),
      _ = require('underscore'),
      { promised, diffIdArrays } = require('../../../../utils'),
      { defaultRoleIds } = require('../../../../consts'),
      { isReadableStream } = require('cortex-service/lib/utils/values'),
      modules = require('../../../../modules'),
      Memo = require('../../../../classes/memo'),
      { Driver, CursorOperation } = modules.driver,
      getCursorRequestData = async(script, apiKey, objectName, payloadOptions) => {
        try {
          const object = await promised(script.ac.org, 'createObject', objectName),
                { ac } = script,
                { req } = ac,
                driver = new Driver(script.ac.principal, object, { req, script }),
                options = new CursorOperation(driver).getOptions(payloadOptions, payloadOptions), // privileged
                { skipAcl, grant, roles } = script.ac.principal,
                { token } = await promised(modules.authentication, 'createToken', ac, ac.principal, apiKey, {
                  skipAcl,
                  grant,
                  roles: diffIdArrays(roles, defaultRoleIds.slice()), // a claim cannot include a default role.
                  includeEmail: true,
                  isPrivileged: true, // allow skipAcl, grant, and roles in user driver options.
                  expiresIn: 86400,
                  policy: {
                    method: 'POST',
                    path: `/${object.objectName}/db/cursor` // restrict the token to a cursor call.
                  },
                  scope: ['*']
                })
          // Delete none needed objects
          delete options.req
          delete options.script
          // Just get only data from memo
          if (options.transform) {
            options.transform.memo = Memo.to(options.transform.memo)
          }
          return {
            endpoint: script.environment.script.env.url,
            env: script.environment.script.org.code,
            options,
            token,
            objectName
          }
        } catch (e) {
          throw Fault.from(e)
        }
        // expiresIn:
      },
      getBulkRequestData = async(script, apiKey, payloadOptions) => {
        try {
          const { ac } = script,
                { skipAcl, grant, roles } = script.ac.principal,
                { token } = await promised(modules.authentication, 'createToken', ac, ac.principal, apiKey, {
                  skipAcl,
                  grant,
                  roles: diffIdArrays(roles, defaultRoleIds.slice()), // a claim cannot include a default role.
                  includeEmail: true,
                  isPrivileged: true, // allow skipAcl, grant, and roles in user driver options.
                  expiresIn: 86400,
                  policy: {
                    method: 'POST',
                    path: `/org/db/bulk` // restrict the token to a cursor/bulk call.
                  },
                  scope: ['*']
                })
          // Delete none needed objects
          return {
            endpoint: script.environment.script.env.url,
            env: script.environment.script.org.code,
            options: payloadOptions,
            token,
            objectName: 'org'
          }
        } catch (e) {
          throw Fault.from(e)
        }
      },
      prepareInputs = async(script, apiKey, inputs) => {
        const results = {}
        for (const k of Object.keys(inputs)) {
          if (inputs[k].type === 'cursor') {
            results[k] = Object.assign({ type: inputs[k].type, ...await getCursorRequestData(script, apiKey, inputs[k].name, inputs[k].options) })
          } else if (inputs[k].type === 'bulk') {
            results[k] = Object.assign({ type: inputs[k].type, ...await getBulkRequestData(script, apiKey, inputs[k].options) })
          } else {
            results[k] = inputs[k]
          }
        }
        return results
      },
      loadTemplate = async(script, template, results, isPartial = false) => {
        const tpl = await promised(modules.db.models.template, 'loadTemplate', script.ac.principal, template.locale, 'html', template.name),
              content = tpl.content[0]
        results.push({
          name: tpl.name,
          content: content.data,
          locale: tpl.locale,
          isPartial
        })
        if (content.includes.length) {
          for (const tplInc of content.includes) {
            const alreadyLoaded = _.find(results, r => r.name === tplInc.name)
            if (!alreadyLoaded) {
              await loadTemplate(script, { locale: tpl.locale, ...tplInc }, results, true)
            }
          }
        }
      },
      prepareTemplates = async(script, templates) => {
        const results = []
        for (const template of templates) {
          let tpl = template
          if (!tpl.content) {
            await loadTemplate(script, tpl, results)
          } else {
            results.push(tpl)
          }
        }
        return results
      }

module.exports = {

  version: '1.0.0',

  start: async function(script, message, payload) {

    const { apiKey, inputs, templates, outputs, targets, callback, options } = payload || {},
          data = await prepareInputs(script, apiKey, inputs),
          tpls = await prepareTemplates(script, templates),
          opts = {
            json: true,
            body: { data, templates: tpls, outputs, targets, callback, options }
          }
    if (!targets || targets.length < 1) {
      opts.stream = true
    }

    return new Promise((resolve, reject) => {
      modules.services.renderer.post('/start', opts, (err, res) => {
        if (isReadableStream(res)) {
          res.pause() // stop flowing mode.
        }
        err ? reject(err) : resolve(res)
      })
    })

  },

  status: function(script, message, jobId, callback) {

    return modules.services.renderer.post('/status', { json: true, body: { jobId } }, callback)
  },

  cancel: function(script, message, jobId, callback) {

    return modules.services.renderer.post('/cancel', { json: true, body: { jobId } }, callback)
  },

  getVersion: function(script, message, callback) {

    return modules.services.renderer.get('/version', callback)
  }

}
