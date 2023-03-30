'use strict'

const utils = require('../utils'),
      { promised } = utils,
      Fault = require('cortex-service/lib/fault'),
      crypto = require('crypto'),
      fs = require('fs')

class StreamsModule {

  constructor() {
    return StreamsModule
  }

  static encodeRequestMeta(req) {

    const meta = {}
    if (req) {
      const clientId = utils.path(req, 'orgClient._id')
      if (clientId) {
        meta.cid = clientId
      }
      meta.req = req._id
      meta.rte = utils.path(req, 'scriptRoute') || utils.path(req, 'route.path') || '/' // record the route for report aggregation.
    }
    return Object.keys(meta).length > 0 ? 'v2.' + Buffer.from(JSON.stringify(meta), 'utf8').toString('base64') : null
  }

  static decodeRequestMeta(meta) {
    if (String(meta).indexOf('v2.') === 0) {
      try {
        return JSON.parse(Buffer.from(meta.substr(3), 'base64').toString('utf8'))
      } catch (e) {}
    }
    return null
  }

  static getPointerUrl(ac, pointer, callback) {

    const pointerJSON = pointer.aclRead(ac.principal)
    if (!pointerJSON) {
      return callback(Fault.create('cortex.accessDenied.privateFacet'))
    }
    pointerJSON.object = 'facet'

    if (pointer.ac && pointer.ac.objectName === 'export' && pointer.ac.org.configuration.localExportStreams) {
      return callback(null, pointerJSON)
    }

    pointer.url({ meta: StreamsModule.encodeRequestMeta(ac.req) }, function(err, url) {
      if (err && err.errCode === 'cortex.notImplemented.pointerUrl') {
        err = url = null
      }
      if (err) {
        return callback(err)
      }
      pointerJSON.url = url
      callback(null, pointerJSON)
    })

  }

  static async stream(req, res, pointer) {

    if (!pointer || !req) {
      throw Fault.create('cortex.notFound.file', { reason: 'The media was not found.' })

    }

    // assume the client wants details if asking for application/json.
    let pointerJSON

    // add meta so that any redirected urls can be traced back.
    const forceLocalStream = pointer.ac && pointer.ac.objectName === 'export' && pointer.ac.org.configuration.localExportStreams,
          meta = !forceLocalStream && StreamsModule.encodeRequestMeta(req)

    if ((req.header('accept') || '').indexOf('application/json') === 0) {
      pointerJSON = pointer.aclRead(req.principal)
      if (pointerJSON) {
        pointerJSON.object = 'facet'
      }
    }

    if (forceLocalStream) {

      if (pointerJSON) {
        pointerJSON.url = req.protocol + '://' + req.get('host') + req.originalUrl
        return pointerJSON
      } else {
        return promised(pointer, 'stream')
      }

    } else {

      let url, err
      try {
        url = await promised(pointer, 'url', { meta: meta })
      } catch (e) {
        err = e
      }

      if (err && err.errCode === 'cortex.notImplemented.pointerUrl') {
        err = url = null
      }

      if (pointerJSON) {
        pointerJSON.url = url || (req.protocol + '://' + req.get('host') + req.originalUrl)
        return pointerJSON
      }

      if (err) {
        throw err
      } else if (url) {
        return url
      }
      return promised(pointer, 'stream')

    }

  }

  static hashStream(stream, algo, callback) {

    let shasum = crypto.createHash(algo)
    stream.on('data', function(d) {
      shasum.update(d)
    })
    stream.on('error', function(err) {
      callback(err, null)
    })
    stream.on('end', function() {
      callback(null, shasum.digest('hex'))
    })
  }

  static hashFile(filename, algo, callback) {

    StreamsModule.hashStream(fs.ReadStream(filename), algo, callback)

  }

}

module.exports = StreamsModule
