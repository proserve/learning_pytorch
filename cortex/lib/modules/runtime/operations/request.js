
const RuntimeOperation = require('./runtime-operation'),
      onFinished = require('on-finished'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      { sleep, rInt, clamp, getClientIp, OutputCursor } = require('../../../utils'),
      privatesAccessor = require('../../../classes/privates').createAccessor()

module.exports = class extends RuntimeOperation {

  /**
   *
   * @param req
   * @param options
   *  maxWait = 30000 // wait for a maximum of 10 seconds before giving up on stopping. Normally, requests have associated
   *  operations that _can_ be cancelled and will signal the request to finish.
   */
  constructor(req, options) {

    options = options || {}

    super(
      req.org,
      'request',
      {
        ...options,
        _id: req._id
      }
    )

    const privates = privatesAccessor(this)

    Object.assign(
      privates,
      {
        req,
        finished: false,
        maxWait: clamp(rInt(options.maxWait, 30 * 1000), 0, 60 * 1000)
      }
    )

    req.on('org', org => {
      this.org = org
    })

    req.on('principal', principal => {
      if (principal) {
        this.org = principal.org
      }
    })

    req.once('aborted', () => {
      privates.finished = true
      this.cancel(Fault.create('cortex.error.aborted', { reason: 'Client aborted request operation.', path: this.context }))
    })

    onFinished(req.res, (err) => {
      privates.finished = true
      err ? this.cancel(err) : this.stop(() => {})
    })

  }

  get req() {

    return privatesAccessor(this).req

  }

  get activeCursor() {

    const { req: { res } } = privatesAccessor(this)
    return res && res.cursor instanceof OutputCursor && !res.cursor.isClosed() && res.cursor

  }

  cancel(err, callback = () => {}) {

    // attempt to cancel any cursors
    const { activeCursor } = this

    if (activeCursor) {
      activeCursor.abort(() => {})
    }

    super.cancel(err, callback)

  }

  _waitStop(callback) {

    // cannot cancel. wait until the request is aborted.
    Promise
      .resolve(null)
      .then(async() => {

        const privates = privatesAccessor(this),
              { maxWait } = privates,
              interval = 100,
              waitStart = Date.now()

        while ((Date.now() - waitStart) < maxWait) {
          if (privates.finished) {
            break
          }
          await sleep(interval)
        }

        if (!privates.finished) {
          logger.warn('timed out waiting for request operation to complete', this.context)
        }

        super._waitStop(callback)

      })

  }

  _getInsertDocument() {

    return {
      ...super._getInsertDocument(),
      ...this._getRequestDocument()
    }

  }

  _getRequestDocument() {

    const { req } = privatesAccessor(this),
          ipv4 = getClientIp(req),
          { method, hostname: host, url, path, query, params = {}, orgClient } = req,
          client = orgClient ? { _id: orgClient._id, key: orgClient.key } : null, // might not yet be assigned.
          headers = Object.keys(req.headers || {}).reduce(function(copy, key) {
            if (key === 'cookie') {
              // remove md and medable cookies
              copy['cookie'] = (req.headers['cookie'] || '').split(';').filter(function(str) {
                str = str.trim()
                return !(str.indexOf('md') === 0 || str.indexOf('medable') === 0)
              }).join(';').trim()
            } else if (~['cookie', 'x-forwarded-for', 'x-real-ip', 'medable-csrf-token'].indexOf(key)) {
              // skip
            } else {
              copy[key] = req.headers[key]
            }
            return copy
          }, {})

    return {
      method,
      headers,
      ip: ipv4,
      ipv4,
      host,
      url,
      path,
      query,
      params,
      client
    }
  }

  export() {

    return {
      ...super.export(),
      ...this._getRequestDocument()
    }

  }

}
