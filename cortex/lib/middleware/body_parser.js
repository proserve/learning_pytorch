'use strict'

const config = require('cortex-service/lib/config'),
      Fault = require('cortex-service/lib/fault'),
      bodyParser = require('body-parser'),
      async = require('async'),
      utils = require('../utils'),
      acl = require('../acl'),
      modules = require('../modules'),
      Busboy = require('busboy'),
      _ = require('underscore'),
      qs = require('qs')

function isEmptyObject(obj) {
  if (!utils.isPlainObject(obj)) {
    return false
  }
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false
    }
  }
  return true
}

module.exports = {

  strict: bodyParser.json({
    limit: config('requests.limit'),
    strict: true
  }),

  loose: bodyParser.json({
    limit: config('requests.limit'),
    strict: false
  }),

  urlencoded: bodyParser.urlencoded({
    limit: config('requests.limit'),
    extended: true
  }),

  runtime: {

    strict: function(req, res, next) {
      bodyParser.json({
        limit: req.org.configuration.maxRequestSize,
        strict: true
      })(req, res, next)
    },

    loose: function(req, res, next) {
      bodyParser.json({
        limit: req.org.configuration.maxRequestSize,
        strict: false
      })(req, res, next)
    },

    urlencoded: function(req, res, next) {
      bodyParser.urlencoded({
        limit: req.org.configuration.maxRequestSize,
        extended: true
      })(req, res, next)
    },

    text: function(req, res, next) {
      bodyParser.text({
        limit: req.org.configuration.maxRequestSize,
        type: 'text/*'
      })(req, res, next)
    },

    form_data: function(req, res, next) {

      if (!((req.body === undefined || isEmptyObject(req.body)) && req.org.configuration.allowStreamingUploads && ~(req.headers['content-type'] || '').indexOf('multipart/form-data') && ['PATCH', 'PUT', 'POST'].includes(req.method))) {
        return next()
      } else if (!req.object) {
        return next(Fault.create('cortex.notFound.object'))
      } else if (!modules.authentication.authInScope(req.principal.scope, 'upload', false)) {
        return next(Fault.create('cortex.accessDenied.scope', { path: 'upload' }))
      }

      const principal = req.principal.deScoped()

      req.body = req.body || {}

      async.waterfall([

        // attempt to load an access context
        callback => {
          if (req.params.id) {
            req.object.getAccessContext(principal, req.params.id, { req }, (err, ac) => {
              callback(err, ac)
            })
          } else {
            callback(null, null)
          }
        },

        // we may or may not have an id. start the upload
        (ac, callback_) => {

          let finished = false,
              files = new Set(),
              model = ac ? ac.object : null,
              callback = _.once(err => {
                callback = null
                callback_(err)
              }),
              checkFinished = (err) => {
                // ack the error but swallow if there are files, allowing individual files to handle errors.
                if (finished && files.size === 0 && callback) {
                  callback(err)
                }
              }

          try {

            const busboy = new Busboy({ headers: req.headers })

            busboy.on('field', function(fieldname, val, fieldNameTruncated, valTruncated, encoding, mimetype) {

              if (callback) {
                try {
                  if (mimetype === 'application/json') {
                    utils.extend(true, req.body, { [fieldname]: JSON.parse(val) })
                  } else {
                    utils.extend(true, req.body, qs.parse(`${fieldname}=${val}`))
                  }
                } catch (err) {
                  callback(err)
                }
              }
            })

            busboy.on('file', function(fieldName, file, filename, encoding, mimetype) {

              // a streaming error may be caught by busboy, who will think it's a premature
              // end to the file. ensure that this kind of error does not allow a c_upload to
              // continue to exist.
              let uploadRequest

              files.add(file)

              function done(err, resume = true) {
                const logged = Fault.from(err, null, true)
                logged.trace = logged.trace || 'Error\n\tformdata uploader:0'
                if (err) {
                  try {
                    modules.db.models.Log.logApiErr(
                      'api',
                      logged,
                      new acl.AccessContext(principal, null, { req })
                    )
                  } catch (err) {
                    void err
                  }
                }

                if (resume) {
                  try {
                    file.resume()
                  } catch (err) {
                    void err
                  }
                }
                if (callback) {
                  callback(err)
                }
              }

              file.on('error', function(err) {
                if (uploadRequest) {
                  uploadRequest.cancel(err)
                }
              })

              if (!callback) {
                return done()
              }

              if (!model) {
                if (req.object.schema.node.typed && !req.body.type) {
                  return done(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Type must be specified before file data' }))
                }
                model = req.object.getModelForType(req.body.type)
              }

              const q = qs.parse(`${fieldName}=1`),
                    flat = utils.flattenObjectPaths(q),
                    fullPath = utils.normalizeObjectPath(Object.keys(flat)[0], true, true, true),
                    { propertyPath, facetName, numParts } = ((path) => {
                      const parts = path.split('.'),
                            numParts = parts.length,
                            propertyPath = parts.slice(0, numParts - 1).join('.'),
                            facetName = parts[numParts - 1]
                      return { propertyPath, facetName, numParts }
                    })(fullPath),
                    nodes = model.schema.node.findNodes(propertyPath, []).filter(node => node.getTypeName() === 'File'),
                    node = nodes[0],
                    processor = node && Array.isArray(node.processors) ? node.processors.find(processor => processor.name === facetName) : null,
                    onAborted = () => {
                      if (uploadRequest) {
                        uploadRequest.cancel(Fault.create('cortex.error.clientDisconnect', { reason: 'The client disconnected before the request completed.' }))
                      }
                    }

              if (numParts < 2) {
                return done(Fault.create('cortex.invalidArgument.unspecified', { path: fullPath, reason: 'Upload path must include both the property and facet name.' }))
              } else if (nodes.length > 1) {
                return done(Fault.create('cortex.invalidArgument.unspecified', { path: fullPath, reason: 'Uploads for similarly named File properties across Sets is unsupported.' }))
              } else if (!node) {
                return done(Fault.create('cortex.invalidArgument.unspecified', { path: fullPath, reason: 'Upload File property not found.' }))
              } else if (!processor) {
                return done(Fault.create('cortex.invalidArgument.unspecified', { path: fullPath, reason: 'Facet processor not found.' }))
              }

              if (req.aborted) {
                return done(Fault.create('cortex.error.uploadIncomplete', {
                  reason: 'A file upload did not complete.'
                }))
              }

              req.on('aborted', onAborted)

              uploadRequest = modules.db.models.Upload.createUpload(principal, file, filename, mimetype, encoding, processor, (err, ac) => {

                req.removeListener('aborted', onAborted)

                // if we cancelled it's because there was a file upload error.
                if (uploadRequest.err) {
                  err = Fault.create('cortex.error.uploadIncomplete', {
                    reason: 'A file upload did not complete.',
                    faults: [uploadRequest.err]
                  })
                } else {
                  err = Fault.from(err)
                }

                if (err) {
                  return done(err)
                }

                ac.subject.aclRead(ac, (err, doc) => {
                  if (err) {
                    return done(err)
                  }
                  const q = qs.parse(`${fieldName}=facet://${doc.dataFile.path}`)
                  utils.extend(true, req.body, q)

                  files.delete(file)
                  checkFinished()

                })

              })

            })

            busboy.on('finish', function() {
              finished = true
              checkFinished()
            })

            busboy.on('error', function(err) {
              finished = true
              checkFinished(err)
            })

            req.pipe(busboy)

          } catch (err) {

            if (callback) {
              callback(err)
            }

          }

        }

      ], err => {
        next(err)
      })

    }

  }

}
