'use strict'

const NotificationBaseWorker = require('../notification-base-worker'),
      util = require('util'),
      config = require('cortex-service/lib/config'),
      async = require('async'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      { isBSONTypeOf } = utils,
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules'),
      { Driver } = modules.driver,
      consts = require('../../../consts'),
      sendgrid = require('sendgrid'),
      acl = require('../../../acl'),
      parseAttachments = async(principal, org, attachments = []) => {
        const atts = [],
              { maxAttachmentSize } = org.configuration.notification.email
        let totalSize = 0
        for (let att of attachments) {
          let content, data
          switch (att.content.type) {
            case 'buffer':
              content = att.content.buffer
              break
            case 'path':
              const pathParts = utils.normalizeObjectPath(att.content.path.replace(/\//g, '.')).split('.'),
                    driver = new Driver(principal, await org.createObject(pathParts[0])),
                    result = await driver.readOne({
                      where: { _id: pathParts[1] },
                      path: pathParts.slice(2).join('.')
                    }, { grant: acl.AccessLevels.Script }, { returnPointers: true })

              if (!result) {
                throw Fault.create('cortex.error.unspecified', { reason: 'Missing data reading path.' })
              }
              if (modules.storage.isPointer(result)) {
                att.filename = result.filename
                att.type = result.mime
                att.content.encode = true // always encode a downloaded file

                if (result.state !== consts.media.states.ready) {
                  throw Fault.create('cortex.invalidArgument.state', { reason: 'Facet is not ready to be attached' })
                }
                content = await new Promise((resolve, reject) => {
                  result.stream((err, s) => {
                    if (err) {
                      return reject(err)
                    }
                    const chunks = []
                    s.on('data', d => chunks.push(d))
                      .on('end', () => {
                        resolve(Buffer.concat(chunks))
                      }).on('error', e => reject(e))
                  })
                })
              } else {
                content = result
              }
              break
            case 'cache':
              content = await new Promise((resolve, reject) => {
                modules.cache.get(org, att.content.cache, (err, result) => {
                  if (err) {
                    return reject(err)
                  }
                  if (!result) {
                    return reject(Fault.create('cortex.error.unspecified', { reason: 'Missing data reading cache.' }))
                  }
                  return resolve(result)
                })
              })
              break
            case 'config':
              content = await new Promise((resolve, reject) => {
                modules.config.get(org, att.content.config, (err, result) => {
                  if (err) {
                    return reject(err)
                  }
                  if (!result) {
                    return reject(Fault.create('cortex.error.unspecified', { reason: 'Missing data reading config.' }))
                  }
                  return resolve(result)
                })
              })
              break
          }

          if (isBSONTypeOf(content, 'Binary')) {
            data = content.buffer
          } else if (content instanceof Buffer) {
            data = content
          } else if (Object(content) === content || utils.isPlainObject(content)) {
            if (content.type && content.type === 'Buffer') {
              // Means this is a sandbox Buffer
              data = Buffer.from(content.data)
            } else {
              // These are just regular objects
              data = Buffer.from(JSON.stringify(content))
            }
          } else {
            data = Buffer.from(content.toString())
          }

          totalSize += data.length

          if (!att.type) {
            throw Fault.create('cortex.invalidArgument.required', { reason: 'Mime type is required when is not a facet object.' })
          }
          if (!att.filename) {
            throw Fault.create('cortex.invalidArgument.required', { reason: 'Filename is required when is not a facet object.' })
          }

          const attItem = {
            content: att.content.encode ? data.toString('base64') : data.toString('utf8'),
            type: att.type,
            filename: att.filename,
            disposition: att.disposition
          }
          if (att.disposition === 'inline') {
            attItem.content_id = att.contentId
          }

          atts.push(attItem)
        }

        if (totalSize > maxAttachmentSize) {
          throw Fault.create('cortex.tooLarge.unspecified', { reason: `Total attachment size is bigger than allowed: ${maxAttachmentSize}` })
        }

        return atts
      }

function EmailWorker() {
  NotificationBaseWorker.call(this)
}
util.inherits(EmailWorker, NotificationBaseWorker)

EmailWorker.prototype.getTemplateType = function() {
  return 'email'
}

EmailWorker.prototype.getPayloadOptions = function() {
  return ['from', 'fromName', 'subject', 'html', 'recipients', 'attachments']
}

/**
 * @param payload
 *     from
 *     fromName
 *
 *     recipients (overrides account if present)
 *     subject
 *     message (plain text)
 *     html
 *
 * @param callback
 */
EmailWorker.prototype.parsePayload = function(payload, callback) {

  NotificationBaseWorker.prototype.parsePayload.call(this, payload, function(err, payload) {
    if (!err) {

      const emailConfig = utils.path(payload.org, 'configuration.email') || {},
            replyTo = emailConfig.replyTo

      payload.from = emailConfig.from || config('emailer.default_from')
      payload.fromName = emailConfig.fromName || utils.path(payload.org, 'name') || config('emailer.default_from_name')

      if (modules.validation.isEmail(replyTo)) {
        payload.replyTo = replyTo
      } else {
        delete payload.replyTo
      }

      payload.provider = emailConfig.provider || 'SendGrid'
      payload.api_key = emailConfig.api_key || config('emailer.api_key')

      if (!payload.template) {

        const subject = utils.rString(payload.subject, null),
              html = utils.rString(payload.html, null)

        if (_.isString(subject) && subject.length) {
          payload.subject = subject
        } else {
          delete payload.subject
        }
        if (_.isString(html) && html.length) {
          payload.html = html
        } else {
          delete payload.html
        }

      }

      if (payload.recipients) {
        payload.recipients = utils.array(payload.recipients, true)
      }

      parseAttachments(payload.principal, payload.org, payload.attachments).then((attachments) => {
        if (attachments && attachments.length > 0) {
          payload.attachments = attachments
        }
        callback(null, payload)
      }).catch(e => {
        if (config('__is_mocha_test__')) {
          require('../../../../test/lib/server').events.emit('worker.emailer', e)
        }
        callback(e, payload)
      })
    } else {
      callback(err, payload)
    }
  })

}

/**
 * @param message
 * @param payload
 * @param options
 * @param callback
 * @private
 */
EmailWorker.prototype._process = function(message, payload, options, callback) {

  async.waterfall([

    // render message or template.
    function(callback) {
      if (payload.message) {
        return callback(null, payload.subject, payload.message, payload.html)
      }
      this.renderTemplate(payload, function(err, result) {
        callback(err, utils.path(result, 'subject'), utils.path(result, 'plain'), utils.path(result, 'html'))
      })

    }.bind(this),

    function(subject, plain, html, callback) {

      if (!plain && !html) {
        return callback()
      }

      // only Medable and SendGrid support for now anyway.
      const sq = sendgrid(payload.api_key),
            request = sq.emptyRequest({
              method: 'POST',
              path: '/v3/mail/send',
              body: {
                personalizations: [{
                  to: (payload.recipients || utils.array(utils.path(payload, 'account.email') || payload.account, true)).map(v => ({
                    email: v
                  })),
                  subject: subject || ''
                }],
                from: {
                  email: payload.from,
                  name: payload.fromName
                },
                reply_to: (() => {
                  if (payload.replyTo) {
                    return {
                      email: payload.replyTo
                    }
                  }
                })(),
                attachments: payload.attachments,
                content: (() => {
                  const v = []
                  if (plain) {
                    v.push({
                      type: 'text/plain',
                      value: plain
                    })
                  }
                  if (html) {
                    v.push({
                      type: 'text/html',
                      value: html
                    })
                  }
                  return v
                })()
              }
            })

      if (config('__is_mocha_test__')) {
        require('../../../../test/lib/server').events.emit('worker.emailer', null, request.body, message, payload, options)
        return callback(null)
      }

      if (config('debug.doNotSendEmails')) {
        return callback(null)
      }

      async.retry(
        {
          times: 5,
          interval: function(retryCount) {
            return 50 * Math.pow(2, retryCount)
          }
        },
        callback => {
          sq.API(request, callback)
        },
        (err, response) => {
          if (err) {
            const body = utils.path(response, 'body') || {}
            body.errors = body.errors || [{ message: body.message || err.message }]

            err = Fault.create(
              'cortex.error.unspecified',
              {
                reason: 'Email send failure',
                faults: utils.array(body.errors).map(v => Fault.create('cortex.error.unspecified', {
                  path: v.field,
                  reason: v.message,
                  statusCode: response.statusCode
                }))
              })
            logger.warn(`Email send failure for '${payload.org.code}': ${JSON.stringify(err)}`)
          } else {
            // All good let's clean up cache if has to for attachments
            if (payload.attachments) {
              const disposeCacheItems = payload.attachments.filter(a => a.dispose && a.content.type === 'cache')
              for (const item of disposeCacheItems) {
                modules.cache.del(item.org, item.content._key)
              }
            }
          }

          callback(err)
        }
      )

    }

  ], callback)

}

module.exports = EmailWorker
