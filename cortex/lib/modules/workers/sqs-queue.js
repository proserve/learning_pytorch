'use strict'

const _ = require('underscore'),
      MNS = require('@alicloud/mns'),
      SqsMessage = require('./sqs-message'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../utils'),
      config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      async = require('async'),
      modules = require('../../modules'),
      Startable = require('cortex-service/lib/startable'),
      Queue = require('./queue')

class MessageApi {

  constructor(sqsConfig) {
    this._sdk = config('isChina')
      ? new MNS(sqsConfig.accountId, {
        region: sqsConfig.region,
        accessKeyId: sqsConfig.accessKeyId,
        accessKeySecret: sqsConfig.secretAccessKey,
        secure: true // always
      })
      : modules.aws.newSQSInstance(sqsConfig)
  }

  static mnsResToSqs(mnsMethod, res) {
    switch (mnsMethod) {
      case 'listQueue':
        return {
          QueueUrls: res.body.map(q => q.QueueURL.replace('http', 'https'))
        }
      case 'batchReceiveMessage':
        return {
          Messages: res.body.map(message => ({
            ...message,
            Body: Buffer.from(message.MessageBody, 'base64').toString('utf-8'),
            ReceiptHandle: message.ReceiptHandle
          })),
          ResponseMetadata: res.headers
        }
      case 'changeMessageVisibility':
      case 'deleteMessage':
      default:
        return res
    }
  }

  listQueues(params, callback) {

    if (config('isChina')) {

      this._sdk.listQueue(undefined, 99, params.QueueNamePrefix)
        .then(res => callback(null, MessageApi.mnsResToSqs('listQueue', res)))
        .catch(err => callback(err))

    } else {

      return this._sdk.listQueues(params, callback)

    }

  }

  receiveMessage(params, callback) {

    if (config('isChina')) {

      this._sdk.batchReceiveMessage(params.name, params.MaxNumberOfMessages, params.WaitTimeSeconds)
        .then(res => callback(null, MessageApi.mnsResToSqs('batchReceiveMessage', res)))
        .catch(err => {
          // consider successful with empty message
          if (err.name === 'MNSMessageNotExisterror') {
            callback(null, MessageApi.mnsResToSqs('batchReceiveMessage', { body: [], headers: {} }))
          } else {
            callback(err)
          }
        })

    } else {

      delete params.name
      return this._sdk.receiveMessage(params, callback)

    }

  }

  deleteMessage(params, callback) {

    if (config('isChina')) {

      this._sdk.deleteMessage(params.name, params.ReceiptHandle)
        .then(res => callback(null, MessageApi.mnsResToSqs('deleteMessage', res)))
        .catch(err => callback(err))

    } else {

      delete params.name
      return this._sdk.deleteMessage(params, callback)

    }

  }

  changeMessageVisibility(params, callback) {

    if (config('isChina')) {

      this._sdk.changeMessageVisibility(params.name, params.ReceiptHandle, params.VisibilityTimeout)
        .then(res => callback(null, MessageApi.mnsResToSqs('changeMessageVisibility', res)))
        .catch(err => callback(err))

    } else {

      delete params.name
      return this._sdk.changeMessageVisibility(params, callback)

    }

  }

}

/**
 * sqs-queue-parallel 0.1.6 <https://github.com/bigluck/sqs-queue-parallel>
 * Create a poll of Amazon SQS queue watchers and each one can receive 1+ messages
 *
 * Available under MIT license <https://github.com/bigluck/sqs-queue-parallel/raw/master/LICENSE>
 */

class SqsQueueListener extends Startable {

  constructor(options) {

    super('sqs queue listener')
    this.config = _.extend({
      mdConnectRetryIntervalSecs: 5,
      mdOpRetries: 5,
      mdOpRetryIntervalMs: 500,
      visibilityTimeout: null,
      waitTimeSeconds: 20,
      maxNumberOfMessages: 1,
      name: '',
      concurrency: 1,
      debug: false
    }, options || {})

    this.client = new MessageApi(this.config)

    this.url = null
    this.calls = 0
    this.reqs = []

    this.on('connect', (e) => {
      if (e) {
        logger.error('SqsQueue ' + this.config.name + ': connection failed', e.toJSON())
      } else {
        logger.info('SqsQueue ' + this.config.name + ': connected with url: ' + this.url)
      }
    })
    this.on('error', (e) => {
      if (e) {
        logger.error('SqsQueue ' + this.config.name + ': error receiving messages', e.toJSON())
      }
    })
  }

  _waitStart(callback) {
    logger.silly('SqsQueueListener ' + this.config.name + ': new listener')
    this._tryConnect(err => {
      if (!err && this.url) {
        _.times(this.config.concurrency || 1, index => this._receiveMessages(index))
      }
    })
    super._waitStart(callback)
  }

  _waitStop(callback) {
    this._tryConnect(err => {
      void err
      // abort any receive requests.
      for (let i = 0; i < this.reqs.length; i++) {
        if (this.reqs[i]) {
          this.reqs[i].abort()
          this.reqs[i] = null
        }
      }
      // wait for current operations
      let current
      async.whilst(() => {
        return this.calls > 0
      }, callback => {
        if (current !== this.calls) {
          current = this.calls
          logger.info('waiting for ' + current + ' queue operation(s) to complete.')
        }
        setTimeout(callback, 100)
      }, () => {
        logger.info(this.config.name + ' queue is idle. stopping.')
        super._waitStop(callback)
      })
    })
  }

  _tryConnect(callback) {

    if (this.url) {
      return callback(null)
    } else if (this.connecting) {
      return this.once('connect', callback)
    }
    this.connecting = true

    // find the queue and keep trying forever
    let urls
    async.whilst(

      () => !urls && (this.state === 'starting' || this.state === 'started'),

      callback => {

        this.client.listQueues({
          QueueNamePrefix: this.config.name
        }, (err, data) => {
          if (err) {
            logger.error('error listing sqs queues. retrying in ' + this.config.mdConnectRetryIntervalSecs + ' seconds. error:', err.toJSON())
            return setTimeout(callback, this.config.mdConnectRetryIntervalSecs * 1000)
          } else {
            urls = utils.array(utils.path(data, 'QueueUrls'))
            callback()
          }
        })

      },

      () => {

        this.connecting = false
        let err

        if (this.state !== 'starting' && this.state !== 'started') {
          err = new Error('Queue is stopping')
        } else {
          let re, url, i

          re = config('isChina')
            ? new RegExp(`^https://(\\d+)\\.mns\\.(.+)\\.aliyuncs\\.com/queues/(${this.config.name})$`)
            : new RegExp('/[\\d]+/' + this.config.name + '$')

          for (i = 0; i < urls.length; i++) {
            url = urls[i]
            if (re.test(url)) {
              this.url = url
              break
            }
          }

          err = this.url
            ? null
            : new Error('Queue not found: ' + this.config.name)
        }

        callback(err)
        this.emit('connect', err)
      }
    )
  }

  _receiveMessages(index) {

    const options = {
      QueueUrl: this.url,
      AttributeNames: ['All'],
      MaxNumberOfMessages: this.config.maxNumberOfMessages,
      WaitTimeSeconds: this.config.waitTimeSeconds,
      name: this.config.name // for MNS
    }
    if (this.config.visibilityTimeout != null) {
      options.VisibilityTimeout = this.config.visibilityTimeout
    }

    logger.silly(`SqsQueue ${this.config.name}[${index}]: waiting messages`)

    async.whilst(
      () => this.state === 'starting' || this.state === 'started',
      callback => {
        this.calls++
        this.reqs[index] = this.client.receiveMessage(options, (err, response) => {
          this.calls--
          this.reqs[index] = null
          const messages = utils.array(utils.path(response, 'Messages'))

          if (err) {
            if (err.code === 'RequestAbortedError') {
              return callback()
            }
            const fault = Fault.create('kError', 'Queue receiveMessage failed. Retrying...')
            fault.add(Fault.from(err))
            this.emit('error', fault)
            return setTimeout(callback, this.config.mdOpRetryIntervalMs)
          } else if (!messages.length) {
            callback()
          } else {
            logger.silly('SqsQueueListener ' + this.config.name + '[' + index + ']: ' + messages.length + ' new messages')
            async.eachSeries(
              messages,
              (message, next) => {

                const [, data] = utils.tryCatch(() => utils.deserializeObject(message.Body, true))

                return this.emit('message', {
                  type: 'message',
                  data: data || message.Body,
                  message: message,
                  metadata: response.ResponseMetadata,
                  url: this.url,
                  name: this.config.name,
                  next: _.once(next),
                  deleteMessage: this.deleteMessage.bind(this, message.ReceiptHandle),
                  changeMessageVisibility: this.changeMessageVisibility.bind(this, message.ReceiptHandle)
                })
              },
              () => callback(null)
            )
          }
        })
      },
      err => {
        if (err) {
          this.emit('error', err)
        }
      }
    )

  }

  deleteMessage(receiptHandle, callback) {
    this.calls++
    callback = utils.ensureCallback(callback)
    this._tryConnect(err => {
      if (err) {
        this.calls--
        return callback(err)
      }
      logger.silly('SqsQueueListener ' + this.config.name + ': before deleteMessage ' + receiptHandle + ' for ' + this.url)
      async.retry(this.config.mdOpRetries, callback => {

        this.client.deleteMessage({
          QueueUrl: this.url,
          ReceiptHandle: receiptHandle,
          name: this.config.name // for MNS
        }, err => {
          if (err) {
            logger.silly('SqsQueueListener ' + this.config.name + ': FAILED deleteMessage ' + receiptHandle + ' for ' + this.url + '. Retrying...', err.toJSON())
            return setTimeout(() => {
              callback(err)
            }, this.config.mdOpRetryIntervalMs)
          } else {
            callback()
          }
        })

      }, err => {
        this.calls--
        callback(err)
      })
    })
  }

  changeMessageVisibility(receiptHandle, timeout, callback) {
    this.calls++
    callback = utils.ensureCallback(callback)
    this._tryConnect(err => {
      if (err) {
        this.calls--
        return callback(err)
      }
      logger.silly('SqsQueueListener ' + this.config.name + ': before changeMessageVisibility ' + receiptHandle + ' for ' + this.url)
      async.retry(this.config.mdOpRetries, callback => {

        this.client.changeMessageVisibility({
          QueueUrl: this.url,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: timeout,
          name: this.config.name // for MNS
        }, err => {
          if (err) {
            logger.silly('SqsQueueListener ' + this.config.name + ': FAILED changeMessageVisibility ' + receiptHandle + ' for ' + this.url + '. Retrying...', err.toJSON())
            return setTimeout(() => {
              callback(err)
            }, this.config.mdOpRetryIntervalMs)
          }
          callback()
        })

      }, err => {
        this.calls--
        callback(err)
      })
    })
  }

}

class SqsQueue extends Queue {

  constructor() {
    super('sqs message pump')
    this.queues = {}
    this._numProcessed = 0
  }

  _listen(queue, queueOptions) {

    let mochaTestUuid
    if (config('__is_mocha_test__')) {
      mochaTestUuid = require('../../../test/lib/server').__mocha_test_uuid__
    }

    const entry = this.queues[queue] || (this.queues[queue] = {
      started: false,
      instance: null,
      options: utils.extend({}, queueOptions, {
        accessKeyId: config('uploads.s3.accessKeyId'),
        secretAccessKey: config('uploads.s3.secretAccessKey')
      })
    })

    if (!entry.started) {
      if (!entry.instance) {
        entry.instance = new SqsQueueListener(entry.options)
      }
      entry.started = true
      entry.listeners = {
        message: event => {
          if (event.type === 'message' && event.name === queueOptions.name) {

            // skip message that aren't ours during tests.
            if (config('__is_mocha_test__')) {

              // check for correct test run upload event
              if (config('uploads.s3.uploadBucket') === queueOptions.name) {

                const Key = config('isChina')
                  ? event.data.events[0].oss.object.key
                  : event.data.Records[0].s3.object.key

                modules.aws.getInternalUploadInstance().headObject({ Key }, (err, awsFile) => {
                  if (err || utils.path(awsFile, 'Metadata.__mocha_test_uuid__') !== mochaTestUuid) {
                    event.next()
                  } else {
                    const message = new SqsMessage(this, queueOptions, event)
                    this._emitMessage(message)
                  }
                })

              } else if (utils.path(event, 'data.__mocha_test_uuid__') !== mochaTestUuid) {
                event.next()

              } else {
                const message = new SqsMessage(this, queueOptions, event)
                this._emitMessage(message)
              }
              return
            }

            const message = new SqsMessage(this, queueOptions, event)
            this._emitMessage(message)

          } else {
            event.deleteMessage(() => event.next())
          }
        }
      }
      entry.instance.on('message', entry.listeners.message)
    }
  }

  _waitStart(callback) {

    async.each(
      Object.keys(this.queues),
      (name, callback) => {
        this.queues[name].instance.start(() => callback())
      },
      () => super._waitStart(callback)
    )
  }

  _waitStop(callback) {

    async.each(
      Object.keys(this.queues),
      (name, callback) => {
        const entry = this.queues[name]
        if (entry.instance) {
          entry.instance.stop(() => callback())
        } else {
          callback()
        }
      },
      () => super._waitStop(callback)
    )

  }

  _processed(message, err, result, callback) {
    this._numProcessed++
    if (err) {
      logger.error('q._processed error', { worker: message.worker, org: message.org && message.org.toString(), error: err.stack || err })
      err = Fault.create('cortex.error.queueProcessError')
    }
    if (err) {
      this._error(err, message, () => {
        if (_.isFunction(message.event.next)) {
          message.event.next()
        }
        callback(err)
      })
      return
    }
    if (_.isFunction(message.event.deleteMessage)) {
      message.event.deleteMessage(() => {
        message.event.next()
        callback()
      })
    } else if (_.isFunction(message.event.next)) {
      message.event.next()
      callback()
    }

  }

  get numProcessed() {
    return this._numProcessed
  }

}

module.exports = SqsQueue
