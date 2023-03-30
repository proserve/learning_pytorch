'use strict'

const Worker = require('./worker'),
      util = require('util'),
      async = require('async'),
      _ = require('underscore'),
      modules = require('../../modules'),
      consts = require('../../consts'),
      config = require('cortex-service/lib/config'),
      utils = require('../../utils'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../access-principal'),
      acl = require('../../acl')

function NotificationBaseWorker() {
  Worker.call(this)
}
util.inherits(NotificationBaseWorker, Worker)

NotificationBaseWorker.prototype.getTemplateType = function() {
  return null
}

NotificationBaseWorker.prototype.process = function(message, payload, options, callback) {

  if (_.isFunction(payload)) {
    callback = payload
    payload = message.payload
    options = message.options
  } else if (_.isFunction(options)) {
    callback = options
    options = message.options
  } else if (arguments.length === 1) {
    callback = utils.nullFunc
    payload = message.payload
    options = message.options
  }

  const logError = (err) => {
    var logged = Fault.from(err, null, true)
    logged.trace = logged.trace || 'Error\n\tnative notification:0'
    modules.db.models.Log.logApiErr(
      'api',
      logged,
      new acl.AccessContext(payload.principal, null, { req: message.req })
    )
  }

  this.parsePayload(payload, function(err, payload) {
    if (err) {
      logError(err)
      return callback(err)
    }
    this._process(message, payload, options, function(err) {
      if (err) {
        logError(err)
      }
      callback(err)
    })
  }.bind(this))

}

NotificationBaseWorker.prototype.getRequiredRecipientPrincipalPaths = function() {
  return ['locale', 'name']
}

NotificationBaseWorker.prototype.getPayloadOptions = function() {
  return []
}

NotificationBaseWorker.prototype.hasAllRequiredRecipientAccountPrincipalPaths = function(principal) {

  if (ap.is(principal)) {
    return _.every(this.getRequiredRecipientPrincipalPaths(), function(path) { return utils.path(principal.account, path) !== undefined })
  }
  return false

}

NotificationBaseWorker.prototype.renderTemplate = function(payload, callback) {

  modules.db.models.Template.renderTemplate(payload.principal, payload.locale, this.getTemplateType(), payload.template, payload.variables, function(err, results) {

    const output = {}

    if (!err) {

      results = utils.array(utils.path(results, 'output'))

      utils.array(payload.templateParts).forEach(function(name) {

        const rendered = _.find(results, function(result) {
          return result.name === name
        })

        let renderErr
        if (!rendered) {
          renderErr = Fault.create('cortex.error.renderTemplate', { path: name })
        } else if (rendered.err) {
          renderErr = Fault.from(rendered.err)
          renderErr.path = name
        } else {
          output[name] = rendered.output
        }

        if (renderErr) {
          if (!err) {
            err = Fault.create('cortex.error.renderTemplate')
          }
          err.add(renderErr)
        }

      })
    }

    callback(err, output)

  })

}

/**
 *
 * @param payload
 *      notification: notification object or id.
 *      count: total number of notifications for the user.,
 *      org: orgContext,
 *      template: endpoint.template,
 *      message: optional message. required if template is missing.
 *      account: recipientPrincipal || email,
 *      principal: payload.principal,
 *      locale: payload.locale,
 *      variables: variables to pass to each various templates. merged with certain key top level payload arguments (account, org, notification, principal, locale)
 *
 * @param callback
 */
NotificationBaseWorker.prototype.parsePayload = function(payload, callback) {

  var tasks = []

  if (!utils.isPlainObject(payload)) {
    return callback(Fault.create('cortex.invalidArgument.missingNotificationPayload'))
  }

  if (!utils.equalIds(payload.notification.type, consts.emptyId) && !_.isString(payload.message) && !_.isString(payload.template)) {
    return callback(Fault.create('cortex.invalidArgument.missingTemplateOrMessage'))
  }

  if (ap.is(payload.account) && payload.principal == null) {
    payload.principal = payload.account
  } else if (ap.is(payload.principal) && payload.account == null) {
    payload.account = payload.principal
  }

  if (!modules.db.models.Org.isAclReady(payload.org)) {
    tasks.push(function(callback) {
      modules.db.models.Org.loadOrg(utils.getIdOrNull(payload.org, true), function(err, org) {
        payload.org = org
        callback(err)
      })
    })
  }

  // the account must be a principal (with all required paths loaded), or an email address.
  if (!this.hasAllRequiredRecipientAccountPrincipalPaths(payload.account)) {
    if (ap.is(payload.account)) {
      payload.account = payload.account._id
    }
    tasks.push(function(callback) {
      ap.create(payload.org, utils.path(payload.account, 'email') || payload.account, { include: this.getRequiredRecipientPrincipalPaths() }, function(err, principal) {
        if (err && err.code && err.code === 'kNotFound') {
          if (modules.validation.isEmail(payload.account)) {
            err = null
          } else if (modules.validation.isEmail(utils.path(payload.account, 'email'))) {
            err = null
            payload.account = payload.account.email
          }
        }
        if (!err && principal) {
          payload.account = principal
        }
        callback(err)
      })
    }.bind(this))
  }

  // the render principal must exist.
  if (!this.hasAllRequiredRecipientAccountPrincipalPaths(payload.principal)) {
    if (ap.is(payload.principal)) {
      payload.principal = payload.principal._id
    }
    tasks.push(function(callback) {
      ap.create(payload.org, payload.principal, function(err, principal) {
        if (!err) {
          payload.principal = principal
        }
        callback(err)
      })
    })
  }

  // notification, if an id, loads the notification.
  if ((utils.isId(payload.notification) || utils.isIdFormat(payload.notification))) {
    tasks.push(function(callback) {
      var principal = ap.is(payload.principal) ? payload.principal : ap.synthesizeAnonymous(payload.org)
      modules.db.models.Notification.nodeList(principal, { _id: utils.getIdOrNull(payload.notification), org: payload.org._id }, { single: true, scoped: false }, function(err, doc) {
        if (!err && doc) {
          payload.notification = doc
        } else {
          delete payload.notification
        }
        callback()
      })
    })
  }

  // resolve the count. send a number or remove it.
  if (!utils.isInt(payload.count)) {
    if (payload.count !== null && ap.is(payload.account)) {
      tasks.push(function(callback) {
        modules.db.models.Notification.countDocuments({ account: payload.account._id }, function(err, count) {
          if (!err) {
            payload.count = count
          }
          callback()
        })

      })
    }
    delete payload.count
  }

  // resolve locale.
  tasks.push(function(callback) {
    payload.locale = payload.locale || utils.path(payload.account, 'account.locale') || payload.org.locale
    if (!modules.locale.isValid(payload.locale)) {
      payload.locale = config('locale.defaultLocale')
    }
    callback()
  })

  // prepare and check variables against template, and add templateParts (array of content names to use when  rendering)
  if (payload.template) {
    tasks.push(function(templateType, callback) {

      const variables = utils.extend(_.clone(payload.variables), {
        account: payload.account,
        principal: payload.principal,
        notification: payload.notification,
        org: payload.org,
        locale: payload.locale
      })

      modules.db.models.Template.findOne({ org: payload.org._id, type: templateType, name: payload.template, locale: { $in: [null, []] } }, function(err, template) {
        if (!err) {
          if (!template) {
            return callback(Fault.create('cortex.notFound.notificationTemplateSpec', { path: payload.template + '.' + templateType }))
          }
          utils.array(utils.path(template, 'spec.0.variables')).forEach(function(variable) {
            if (variables[variable.name] == null) {
              if (!err) {
                err = Fault.create('cortex.invalidArgument.notificationTemplateVariable')
              }
              err.add(Fault.create('cortex.notFound.notificationTemplateVariable', { path: variable.name }))
            }
          })
          if (!err) {
            payload.templateParts = utils.array(utils.path(template, 'spec.0.content')).map(function(content) {
              return content.name
            })
          }
        }
        callback(err)
      })
    }.bind(null, this.getTemplateType()))
  }

  async.series(tasks, function(err) {
    callback(err, payload)
  })

}

module.exports = NotificationBaseWorker
