'use strict'

const Worker = require('../worker'),
      async = require('async'),
      logger = require('cortex-service/lib/logger'),
      config = require('cortex-service/lib/config'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      acl = require('../../../acl'),
      mime = require('mime'),
      split2 = require('split2'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules'),
      ExpansionQueue = require('../../db/definitions/classes/expansion-queue'),
      SelectionTree = require('../../db/definitions/classes/selection-tree'),
      ZipStream = require('zip-stream'),
      stream = require('stream'),
      mississippi = require('mississippi'),
      ap = require('../../../access-principal'),
      fastcsv = require('fast-csv'),
      FormatExtensions = {
        'application/x-ndjson': 'ndjson',
        'application/json': 'json',
        'text/csv': 'csv'
      }

let Undefined

// @todo if already running, it means the job was probably shut down during execution. try to figure out where the job left off?

class ExportInstance {

  constructor(message, principal, doc, location) {

    this.ac = new acl.AccessContext(principal, doc, { req: message.req, grant: acl.AccessLevels.Script })

    this.message = message
    this.principal = principal
    this.export = doc
    this.fileIndex = 0
    this.headers = new Set()
    this.created = new Date()
    this.location = location
    this.internalLocation = modules.aws.getLocationSync(this.ac, consts.LocationTypes.AwsS3)

    this.stats = {
      docs: {
        count: 0
      },
      files: {
        count: 0,
        size: 0
      }
    }

    this.selectionTree = new SelectionTree({
      paths: doc.paths,
      include: doc.include,
      expand: doc.expand,
      nodeFilter: n => !n.virtual,
      ignoreMissing: true,
      ignoreMixedPaths: true
    })
    this.selectionTree.setOption('deferGroupReads', true)
    this.selectionTree.setOption('forgiving', true)

    this.parser = this.model = this.selections = null

    const propertyId = modules.db.models.export.schema.node.findNode('dataFile')._id

    this.facets = []

    this.contentFacet = {
      pid: utils.createId(),
      creator: this.principal._id,
      private: false,
      name: 'content',
      mime: 'application/zip',
      _pi: propertyId,
      _kl: false,
      _up: this.created,
      filename: this.contentFilename,
      meta: [{
        name: 'awsId',
        value: `${this.exportRoot}/export-${this.created.toISOString().replace(/:/g, '_')}.zip`,
        pub: false
      }],
      location: consts.LocationTypes.AwsS3,
      storageId: this.location.storageId,
      state: consts.media.states.pending
    }
    this.facets.push(this.contentFacet)

    // store a file manifest
    if (this.isFileExport) {
      this.manifestFacet = {
        pid: utils.createId(),
        creator: this.principal._id,
        private: false,
        name: 'manifest',
        mime: 'application/x-ndjson',
        _pi: propertyId,
        _kl: false,
        _up: this.created,
        filename: 'manifest.ndjson',
        meta: [{
          name: 'awsId',
          value: `${this.internalRoot}/manifest.ndjson`,
          pub: false
        }],
        location: consts.LocationTypes.AwsS3,
        storageId: 'medable',
        state: consts.media.states.pending
      }
      this.facets.push(this.manifestFacet)
    }

    // store an intermediary nd-json file of all results in order to stream back and transform once all headers are captured.
    if (this.isCsv) {
      this.intermediaryFacet = {
        pid: utils.createId(),
        creator: this.principal._id,
        private: false,
        name: 'intermediary',
        mime: 'application/x-ndjson',
        _pi: propertyId,
        _kl: false,
        _up: this.created,
        filename: 'intermediary.ndjson',
        meta: [{
          name: 'awsId',
          value: `${this.internalRoot}/intermediary.ndjson`,
          pub: false
        }],
        location: consts.LocationTypes.AwsS3,
        storageId: 'medable',
        state: consts.media.states.pending
      }
      this.facets.push(this.intermediaryFacet)
    }

  }

  get pids() {
    return this.facets.map(v => v.pid)
  }

  get contentDate() {
    return this.created
  }

  get contentFilename() {
    return `export-${this.created.toISOString().replace(/:/g, '_')}.${this.contentExtension}`
  }

  get contentExtension() {
    return FormatExtensions[this.export.format]
  }

  get _id() {
    return this.export ? this.export._id : null
  }

  get org() {
    return this.principal ? this.principal.org : null
  }

  get isCsv() {
    return this.export ? this.export.format === 'text/csv' : false
  }

  get isJson() {
    return this.export ? this.export.format === 'application/json' : false
  }

  get isFileExport() {
    return this.export ? this.export.exportFiles : false
  }

  get zipFiles() {
    return this.export && this.isFileExport && this.export.zipFiles
  }

  get exportRoot() {
    return this.location.buildKey(`exports/${this.export._id}`)
  }

  get internalRoot() {
    return this.internalLocation.buildKey(`exports/${this.export._id}`)
  }

  assertExists(callback) {

    modules.db.models.export.findOne({ _id: this._id, reap: false }).select({ _id: 1 }).lean().exec((err, doc) => {
      if (!err && !doc) {
        err = Fault.create('cortex.notFound.instance', { reason: `Export ${this._id} has disappeared.`, path: `export.${this._id}` })
      }
      callback(err)
    })

  }

  logEvent(name, event = {}) {

    modules.db.models.export.logEvent(
      this._id,
      name,
      {
        message: this.message._id,
        ...event
      }
    )

  }

  process(callback) {

    const sFinished = Symbol('finished'), // set on contentZip when finished.
          sError = Symbol('error'), // set on contentZip on error.
          Definitions = modules.db.definitions

    if (this.message.cancelled) {
      this.logEvent('aborted', { source: 'cortex', willRestart: false })
      return callback(Fault.create('cortex.error.aborted'))
    }

    // reset for attempt
    this._reset('running', null, err => {

      if (err) {
        return callback(err) // already running. do not update state.
      }

      this.logEvent('started')

      if (config('__is_mocha_test__')) {
        require('../../../../test/lib/server').events.emit('export.running', this)
      }

      async.waterfall([

        // create cursor
        callback => {

          if (this.message.cancelled) {
            this.logEvent('aborted', { source: 'cortex', willRestart: false })
            return callback(Fault.create('cortex.error.aborted'))
          }
          this.parser.exec({ cursor: { batchSize: 100 } }, (err, cursor) => callback(err, cursor))
        },

        (cursor, callback) => this.assertExists(err => callback(err, cursor)),

        // process documents
        (cursor, callback) => {

          if (this.message.cancelled) {
            this.logEvent('aborted', { source: 'cortex', willRestart: false })
            return callback(Fault.create('cortex.error.aborted'))
          }

          callback = _.once(callback)

          let manifestStream, manifestUpload, manifestComplete = true,
              contentStream, contentUpload, contentComplete = false,
              contentZip, contentFacet, contentLocation

          const checkComplete = err => {
            if (err) {
              callback(err)
              try {
                if (manifestUpload) manifestUpload.abort()
              } catch (e) {}
              try {
                if (contentUpload) contentUpload.abort()
              } catch (e) {}
              try {
                contentStream.end() // this'll trigger checkComplete in the aws upload callback or in the zip stream entry callback
              } catch (e) {}
              try {
                if (manifestStream) {
                  manifestStream.end() // this'll trigger checkComplete in the aws upload callback
                }
              } catch (e) {}
            } else if (manifestComplete && contentComplete) {
              callback(err, contentZip)
            }
          }

          cursor.setReadPreference('secondaryPreferred')
          cursor.on('close', (err) => {
            logger.debug(`[exporter] ${this.export._id} cursor closed.`, err)
          })

          // when exporting files, store file translation data in a manifest that will be used to later upload the files.
          if (this.isFileExport) {
            manifestComplete = false
            manifestStream = createNdJsonStream()
            manifestUpload = this._createUpload(manifestStream, awsFile(this.manifestFacet), this.manifestFacet.mime, this.internalLocation, null, (err, data) => {
              manifestComplete = true
              logger.debug('[exporter] manifestUpload complete')
              if (!err) {
                this.manifestFacet.ETag = String(utils.option(data, 'ETag', '')).replace(/"/g, '')
              }
              checkComplete(err)
            }, info => {
              this.manifestFacet.size = utils.rInt(info.total, 0)
            })
          }

          // when exporting as csv, an intermediary is used instead of the final file destination.
          contentStream = this.isJson ? createJsonStream() : createNdJsonStream()

          if (!this.isCsv) {
            contentZip = new ZipStream()
            contentZip[sFinished] = false
            contentZip.entry(contentStream, { name: this.contentFilename }, err => {
              contentComplete = true
              logger.debug('[exporter] contentZip.entry complete')
              checkComplete(err)
            })
            contentZip.once('finish', () => {
              contentZip[sFinished] = true
            })
            contentZip.once('error', err => {
              contentZip[sFinished] = true
              contentZip[sError] = err
            })
          }

          // for csv, the upload is the intermediary. otherwise, it's a zip file.
          contentFacet = this.isCsv ? this.intermediaryFacet : this.contentFacet
          contentLocation = this.isCsv ? this.internalLocation : this.location

          contentUpload = this._createUpload(contentZip || contentStream, awsFile(contentFacet), contentFacet.mime, contentLocation, null, (err, data) => {
            // this'll just get swallowed if the content stream is a zip file. that's fine because we handle that case when the cursor is exhausted.
            if (!err) {
              contentFacet.ETag = String(utils.option(data, 'ETag', '')).replace(/"/g, '')
            }
            if (!contentZip) {
              contentComplete = true
              logger.debug('[exporter] contentUpload complete')
              checkComplete(err)
            }
          }, info => {
            contentFacet.size = utils.rInt(info.total, 0)
          })

          this.logEvent('cursor.started')

          async.during(

            callback => {

              if (this.message.cancelled) {
                this.logEvent('aborted', { source: 'cortex', willRestart: false })
                return callback(Fault.create('cortex.error.aborted'))
              }
              if (cursor.isClosed()) {
                return callback(null, false)
              }

              this.assertExists(err => {
                if (err) {
                  return callback(err)
                }
                cursor.hasNext((err, hasNext) => callback(err, hasNext))
              })

            },

            callback => {

              const batchSize = 100,
                    docs = [],
                    eq = new ExpansionQueue(this.exportPrincipal)

              async.during(

                callback => {

                  if (this.message.cancelled) {
                    this.logEvent('aborted', { source: 'cortex', willRestart: false })
                    return callback(Fault.create('cortex.error.aborted'))
                  }
                  if (docs.length >= batchSize || cursor.isClosed()) {
                    return callback(null, false)
                  }
                  cursor.hasNext((err, hasNext) => callback(err, hasNext))
                },

                callback => {

                  cursor.next((err, raw) => {

                    if (err) {
                      return callback(err)
                    }

                    const lightweight = !config('runtime.useHeavyReader'),
                          Model = this.parser.discernDocumentModel(raw)

                    let ac, doc

                    if (lightweight) {
                      doc = Definitions.makeLightweightSubject(raw, Model, this.selections)
                    } else {
                      doc = new Model(Undefined, this.selections, true)
                      doc.init(raw)
                      doc.$raw = raw
                    }

                    ac = new acl.AccessContext(this.exportPrincipal, doc, { req: this.message.req, grant: this.export.principal ? null : acl.AccessLevels.Delete, eq: eq })
                    ac.option('Read_File_Pids_As', 'pid')

                    doc.aclRead(ac, this.selectionTree, (err, json) => {
                      if (!err) {
                        docs.push({ doc: doc, json: json })
                      }
                      if (config('debug.exporter.cursorSlowdown')) {
                        setTimeout(callback, config('debug.exporter.cursorSlowdown'))
                      } else {
                        callback(err)
                      }
                    })

                  })

                },

                err => {

                  if (err) {
                    return callback(err)
                  }
                  this.model.schema.node.readGrouped(this.exportPrincipal, docs.map(entry => entry.json), null, null, err => {
                    if (err) {
                      return callback(err)
                    }
                    eq.expand(docs.map(entry => entry.json), err => {
                      if (err) {
                        return callback(err)
                      }
                      async.eachSeries(docs, (entry, callback) => {

                        if (this.message.cancelled) {
                          this.logEvent('aborted', { source: 'cortex', willRestart: false })
                          return callback(Fault.create('cortex.error.aborted'))
                        }

                        const doc = entry.doc,
                              json = entry.json

                        let uploads

                        this.stats.docs.count++

                        // store headers for csv.
                        if (this.isCsv) {
                          collectHeaders(this.headers, json)
                        }

                        // rewrite facets and store in manifest for upload stage.
                        uploads = this._processFacets(doc, json)
                        if (manifestStream && uploads.length) {
                          async.eachSeries(
                            uploads,
                            (upload, callback) => {
                              callback = _.once(callback)
                              try {
                                writeToStream(manifestStream, upload, callback)
                              } catch (err) {
                                callback(err)
                              }
                            },
                            err => {
                              if (err) {
                                return callback(err)
                              }
                              callback = _.once(callback)
                              try {
                                writeToStream(contentStream, json, callback)
                              } catch (err) {
                                callback(err)
                              }
                            }
                          )
                        } else {
                          callback = _.once(callback)
                          try {
                            writeToStream(contentStream, json, callback)
                          } catch (err) {
                            callback(err)
                          }
                        }

                      }, callback)
                    })
                  })

                }
              )

            },

            err => {

              this.logEvent('cursor.completed')

              logger.debug(`[exporter] ${this.export._id} cursor portion complete`, err)

              try {
                cursor.close(() => {})
              } catch (e) {}

              if (err) {
                checkComplete(err)
              } else {
                try {
                  contentStream.end() // this'll trigger checkComplete in the aws upload callback or in the zip stream entry callback
                } catch (e) {}
                try {
                  if (manifestStream) {
                    manifestStream.end() // this'll trigger checkComplete in the aws upload callback
                  }
                } catch (e) {}

              }

            }

          )

        },

        // wait a bit for it to become available.
        (contentZip, callback) => {

          setTimeout(() => {
            callback(null, contentZip)
          }, config('messages.exporter.awsReadWait'))

        },

        // process intermediary if csv: stream out each entry in the intermediary
        // using collected headers.
        (contentZip, callback_) => {

          let contentStream,
              contentUpload,
              notExistsErr = null,
              existenceTimer = setInterval(() => {
                this.assertExists(err => {
                  if (err) {
                    notExistsErr = err
                    clearInterval(existenceTimer)
                    existenceTimer = null
                  }
                })
              }, 10000),
              callback = _.once(err => {
                if (existenceTimer) {
                  clearInterval(existenceTimer)
                  existenceTimer = null
                }
                if (err) {
                  try {
                    if (contentUpload) contentUpload.abort()
                  } catch (e) {}
                }
                callback_(err, contentZip)
              })

          if (!this.isCsv) {
            return callback()
          }

          if (this.message.cancelled) {
            this.logEvent('aborted', { source: 'cortex', willRestart: false })
            return callback(Fault.create('cortex.error.aborted'))
          }

          contentStream = mississippi.pipeline(
            this._createAwsReadStream(awsFile(this.intermediaryFacet), this.internalLocation),
            split2(),
            fastcsv.format({
              headers: ['_id', ...Array.from(this.headers).sort().filter(path => path !== '_id')] // put _id in front
            }).transform((str, callback) => {

              if (notExistsErr) {
                return callback(notExistsErr)
              }
              if (this.message.cancelled) {
                this.logEvent('aborted', { source: 'cortex', willRestart: false })
                return callback(Fault.create('cortex.error.aborted'))
              }

              let err = null, json = null
              try {
                json = JSON.parse(str)
              } catch (e) {
                err = e
              }
              callback(err, err ? null : json2Csv(json))

            })
          )

          contentZip = new ZipStream()
          contentZip[sFinished] = false
          contentZip.entry(contentStream, { name: this.contentFilename }, err => {
            logger.debug('[exporter] csv contentZip.entry complete')
            callback(err)
          })
          contentZip.once('finish', () => {
            contentZip[sFinished] = true
          })

          this.logEvent('csv.started')
          contentUpload = this._createUpload(contentZip, awsFile(this.contentFacet), this.contentFacet.mime, this.location, null, (err, data) => {
            // if there's no error, this'll called later on (we might be adding things to the archive).
            logger.debug('[exporter] csv contentUpload complete')
            if (err) {
              callback(err)
            } else {
              this.contentFacet.ETag = String(utils.option(data, 'ETag', '')).replace(/"/g, '')
              this.logEvent('csv.completed')
            }
          }, info => {
            this.contentFacet.size = utils.rInt(info.total, 0)
          })

        },

        // process manifest (upload files)
        (contentZip, callback_) => {

          let notExistsErr = null,
              existenceTimer = setInterval(() => {
                this.assertExists(err => {
                  if (err) {
                    notExistsErr = err
                    clearInterval(existenceTimer)
                    existenceTimer = null
                  }
                })
              }, 10000),
              callback = _.once(err => {
                if (existenceTimer) {
                  clearInterval(existenceTimer)
                  existenceTimer = null
                }
                callback_(err, contentZip)
              })

          if (!this.isFileExport) {
            return callback(null, contentZip)
          }

          // because there may be many files to upload, finalize the zip file here to avoid a stream timeout.
          if (!this.zipFiles) {
            contentZip.finish()
          }

          if (this.message.cancelled) {
            this.logEvent('aborted', { source: 'cortex', willRestart: false })
            return callback(Fault.create('cortex.error.aborted'))
          }

          this.logEvent('files.started')
          mississippi.each(

            mississippi.pipeline(
              this._createAwsReadStream(awsFile(this.manifestFacet), this.internalLocation),
              split2()
            ),

            (str, callback) => {

              callback = _.once(callback)

              if (notExistsErr) {
                return callback(notExistsErr)
              }
              if (this.message.cancelled) {
                this.logEvent('aborted', { source: 'cortex', willRestart: false })
                return callback(Fault.create('cortex.error.aborted'))
              }

              let upload = null
              try {
                upload = JSON.parse(str)
              } catch (err) {
                return callback(err)
              }

              if (!upload || upload.object !== 'upload') {
                return callback(Fault.create('cortex.error.unspecified', { reason: 'Upload missing', path: 'worker.exporter.upload' }))
              }

              const uploadComplete = err => {
                      if (!err) {
                        // count exported files but only add to size if not zipping since they will be included in the facet.
                        this.stats.files.count++
                        if (!this.zipFiles) {
                          this.stats.files.size += upload.facet.size
                        }
                      }
                      callback(err)
                    },
                    sourcePointer = modules.storage.create(null, upload.facet, this.ac)

              if (this.zipFiles) {

                sourcePointer.stream((err, stream) => {
                  if (err) {
                    return uploadComplete(err)
                  }
                  stream.on('error', err => {
                    uploadComplete(err)
                  })
                  contentZip.entry(stream, { name: upload.to }, uploadComplete)
                })

              } else {

                const uploadPointer = modules.storage.create(null, { location: consts.LocationTypes.AwsS3, storageId: this.location.storageId }, this.ac)

                uploadPointer.setLocation(this.location)
                uploadPointer.write(sourcePointer, { key: upload.to }, err => {
                  uploadPointer.dispose()
                  sourcePointer.dispose()
                  uploadComplete(err)
                })

              }
            },
            err => {
              if (err && err.code === 'NoSuchKey') {
                err = null // ignore missing file errors.
              }
              if (!err) {
                this.logEvent('files.completed')
              }
              callback(err, contentZip)
            }
          )
        }

      ], (err, contentZip) => {

        logger.debug(`[exporter] ${this.export._id} all uploads complete. updating state`, err)

        async.series([

          // cleanup content zip stream if it exists.
          callback => {

            if (!contentZip || contentZip[sFinished]) {
              return callback()
            }
            contentZip.once('finish', callback)
            contentZip.finish()

          },

          // sleep. aws files are not always immediately available.
          callback => {

            setTimeout(callback, config('messages.exporter.awsReadWait'))

          },

          // attempt to cleanup intermediary facets.
          callback => {
            if (!err && this.intermediaryFacet) {
              const key = awsFile(this.intermediaryFacet)
              this.internalLocation.deleteObject({ Key: key }, { includePrefix: false }, err => {
                if (err) logger.warn('[export] failed to delete intermediary facet (' + key + ')', err.toJSON())
              })
            }
            if (!err && this.manifestFacet) {
              const key = awsFile(this.manifestFacet)
              this.internalLocation.deleteObject({ Key: key }, { includePrefix: false }, err => {
                if (err) logger.warn('[export] failed to delete manifest facet (' + key + ')', err.toJSON())
              })
            }
            setImmediate(callback)
          },

          // reset on error (this deletes all files)
          callback => {

            if (!err) {
              return callback()
            }
            logError(err, this.message, this.org, this.export)

            if (err.code === 'kNotFound' && ~utils.rString(err.reason, '').indexOf('disappeared')) {
              return callback()
            }

            this.facets = []
            this._reset('error', err, e => {
              if (e) {
                logError(e, this.message, this.org, this.export)
              }
              callback()
            })
          },

          // update state.
          callback => {

            if (err) {
              return callback()
            }

            const pointer = modules.storage.create(null, { location: consts.LocationTypes.AwsS3, storageId: this.location.storageId, meta: [{ name: 'awsId', value: awsFile(this.contentFacet), pub: false }] }, this.ac)
            pointer.setLocation(this.location)

            pointer.info((e, info) => {

              // tolerate errors if we could not read from a passive location. it may be write-only.
              if (e && this.location.passive) {
                e = null
                info = {}
              }

              if (e) {

                logError(e, this.message, this.org, this.export)
                this.facets = []
                this._reset('error', e, e => {
                  if (e) {
                    logError(e, this.message, this.org, this.export)
                  }
                  callback()
                })

              } else {

                this.contentFacet.state = consts.media.states.ready
                this.facets = [utils.extend(info, this.contentFacet)]
                const $set = {
                        state: 'ready',
                        stats: this.stats,
                        dataFile: {
                          creator: this.principal._id,
                          facets: this.pids,
                          sources: []
                        },
                        facets: this.facets,
                        completed: new Date()
                      },
                      $unset = {
                        fault: 1
                      }

                modules.db.models.export.updateOne({ _id: this._id, reap: false }, { $set: $set, $unset: $unset }, e => {
                  if (e) {
                    logError(e, this.message, this.org, this.export)
                    this.facets = []
                    this._reset('error', e, e => {
                      if (e) {
                        logError(e, this.message, this.org, this.export)
                      }
                      callback()
                    })
                  } else {

                    // for internally stored exports
                    if (this.location.isInternal()) {

                      // record the addition(s)
                      const { size, _pi } = this.facets[0],
                            { org, object, type } = this.export,
                            { Stat } = modules.db.models

                      Stat.addRemoveFacet(org, Stat.getDocumentSource(this.export), object, type, _pi, 1, size)

                      // add physically exported files
                      if (!this.zipFiles) {
                        Stat.addRemoveFiles(org, object, this.stats.files.count, this.stats.files.size)
                      }
                    }

                    callback()
                  }
                })

              }

            })

          }

        ], () => {

          if (!this.export.afterScript) {
            return callback()
          }

          this.logEvent('afterScript.started')

          this.export.aclRead(this.ac, (e, json) => {

            this.ac.option('sandbox.logger.source', consts.logs.sources.export)

            const scriptRunner = modules.sandbox.sandboxed(
              this.ac,
              this.export.afterScript,
              {
                compilerOptions: {
                  label: `Export ${this._id}`,
                  type: 'export',
                  language: 'javascript',
                  specification: 'es6'
                }
              },
              {
                err: err || e ? (err || e).toJSON() : null,
                export: json
              }
            )
            scriptRunner(err => {
              this.logEvent('afterScript.completed', {
                err: utils.toJSON(err)
              })
              callback()
            })

          })

        })

      })

    })

  }

  _processFacets(doc, json) {

    const uploads = []

    utils.visit(json, {
      fnObj: (obj, currentKey, parentObject, parentIsArray, depth, fullpath) => {

        // duck type and attempt to read facets (ac option 'Read_File_Pids_As' was set to pid for aclRead)
        if (utils.isId(obj['pid'])) {

          // validate as file.
          const nodePath = utils.normalizeObjectPath(fullpath, true, true, true),
                fileNode = (doc.$model || doc.constructor).schema.node.findNode(nodePath),
                isFile = fileNode && fileNode.getTypeName() === 'File'

          if (isFile) {

            const upload = this._processFacet(doc.facets, obj)
            if (upload) uploads.push(upload)

            utils.array(obj.facets).forEach(facet => {
              const upload = this._processFacet(doc.facets, facet)
              if (upload) uploads.push(upload)
            })

            delete obj.uploads

            return -2
          }

        }
      }
    })

    return uploads

  }

  _processFacet(facetsIndex, facetJson) {

    const facet = utils.findIdInArray(facetsIndex, 'pid', facetJson['pid'])
    delete facetJson['pid']

    if (facet) {

      const awsId = awsFile(facet),
            ready = (awsId && facet.state === consts.media.states.ready)

      if (ready && this.isFileExport) {

        // add the original path after the file name for easy lookup in files

        const numberedFile = modules.db.models.export.padExportFileName(this.fileIndex++),
              originalPath = facetJson.path.replace(/\//g, '.'),
              extension = this.zipFiles ? `.${mime.extension(facet.mime) || 'dat'}` : ''

        if (this.zipFiles) {
          facetJson.path = `/files/${numberedFile}${originalPath}${extension}` // path in archive
        } else {
          facetJson.path = `/exports/${this._id}/files/${numberedFile}${originalPath}` // rest api path
        }

        return {
          object: 'upload',
          facet: facet,
          from: awsId,
          to: this.zipFiles
            ? `/files/${numberedFile}${originalPath}${extension}` // physical location in archive
            : `${this.exportRoot}/files/${numberedFile}${originalPath}${extension}` // location in aws
        }
      }

    }

    return null

  }

  _createAwsReadStream(awsId, location = this.location) {
    return location.createReadStream({ Key: awsId }, { includePrefix: false })
  }

  _createUpload(stream, key, contentType, location, contentEncoding, callback, progress) {

    const params = {
      Key: key,
      Body: stream,
      ContentType: contentType,
      CacheControl: 'no-cache, no-store, private'
    }

    if (contentEncoding) {
      params.ContentEncoding = contentEncoding
    }

    let upload = location.upload(params, callback)

    upload.on('httpUploadProgress', info => {
      logger.silly(`[exporter] ${this.export._id} upload progress`, info)
      if (_.isFunction(progress)) {
        progress(info)
      }
    })

    return upload

  }

  _reset(state, theErr, callback) {

    async.parallel([

      // reset facets and states.
      callback => {

        modules.db.models.export.findOne({ _id: this._id, reap: false }, (err, doc) => {

          if (!err && !doc) {
            return callback(Fault.create('cortex.notFound.instance', { path: `export.${this._id}` }))
          }
          if (!err && ((state === 'error' && doc.state !== 'running') || (state === 'running' && doc.state !== 'pending'))) {
            switch (doc.state) {
              case 'error': return callback(Fault.create('cortex.error.unspecified', { reason: `Export ${this._id} has errors. Please run it again as a new export.` }))
              case 'running': return callback(Fault.create('cortex.conflict.exists', { reason: `Export ${this._id} is already running.` }))
              default: return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: `Export ${this._id} is in an invalid state. (${doc.state}->${state})` }))
            }
          }

          const $set = {
                  state: state,
                  stats: this.stats,
                  dataFile: {
                    creator: this.principal._id,
                    facets: this.pids,
                    sources: []
                  },
                  facets: this.facets
                },
                $unset = {}

          if (theErr) {
            $set.fault = theErr.toJSON()
            $unset.completed = 1
          } else {
            $unset.fault = 1
          }
          if (state === 'running') {
            $set.started = new Date()
            $unset.completed = 1
          } else if (!theErr) {
            $set.completed = new Date()
          }

          modules.db.models.export.collection.updateOne({ _id: this._id, reap: false, sequence: doc.sequence }, { $set: $set, $unset: $unset, $inc: { sequence: 1 } }, { writeConcern: { w: 'majority' } }, (err, result) => {
            if (!err && result.matchedCount === 0) {
              err = Fault.create('cortex.conflict.sequencing', { reason: `Export ${this._id} update contention. Deferring to other process.` })
            }
            return callback(err)
          })

        })

      },

      // for now, just restart.
      callback => {
        this.internalLocation.deleteDir(`exports/${this.export._id}/`, () => {
          callback()
        })
      },

      callback => {
        this.location.deleteDir(`exports/${this.export._id}/`, (err) => {
          if (err && !this.location.passive) {
            logError(err, this.message, this.ac.org, this.export)
            logger.error(`[exporter] error deleting export media from location ${this.export.storageId} in org ${this.ac.orgId} (4)`, err.toJSON())
          }
          callback()
        })
      },

      callback => {
        this.export.prepParser(this.ac, {}, this.export.paths, this.export.include, this.export.expand, (err, exportPrincipal, parser, model, selections) => {
          this.exportPrincipal = exportPrincipal
          this.parser = parser
          this.model = model
          this.selections = selections
          callback(err)
        })
      }
    ], callback)

  }

}

module.exports = class ExporterWorker extends Worker {

  get maxConcurrent() {
    return 20
  }

  get maxConcurrentPerOrg() {
    return 3
  }

  get deferMs() {
    return 60000
  }

  /**
     * @param message
     * @param payload
     *  org (ObjectId)
     *  export (ObjectId)
     * @param callback -> err, ExportInstance
     */
  parsePayload(message, payload, callback) {

    if (!utils.isPlainObject(payload)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Exporter worker missing payload.' }))
    }

    async.waterfall([

      callback => {
        modules.db.models.org.loadOrg(utils.getIdOrNull(payload.org, true), function(err, org) {
          callback(err, org)
        })
      },
      (org, callback) => {
        modules.db.models.export.findOne({ org: org._id, reap: false, object: 'export', _id: utils.getIdOrNull(payload.export) }, function(err, exp) {
          if (!err && !exp) {
            err = Fault.create('cortex.notFound.instance', { path: `export.${utils.getIdOrNull(payload.export)}` })
          }
          callback(err, org, exp)
        })
      },
      (org, exp, callback) => {
        modules.aws.getLocation(org, consts.LocationTypes.AwsS3, exp.storageId, (err, location) => {
          callback(err, org, exp, location)
        })
      },
      (org, exp, location, callback) => {
        ap.create(org, utils.getIdOrNull(exp.creator._id), { type: acl.AccessTargets.Account }, (err, principal) => {
          void err
          principal = principal || ap.synthesizeAnonymous(org)
          callback(null, new ExportInstance(message, principal, exp, location))
        })
      }

    ], callback)

  }

  _process(message, payload, options, callback) {

    this.parsePayload(message, payload, (err, instance) => {

      if (err) {
        logError(err, message, utils.path(payload, 'org'), utils.path(payload, 'export'))
        return callback()
      }

      instance.process(err => { // error handled in instance.
        void err
        callback()
      })

    })

  }

  static get ExportInstance() {
    return ExportInstance
  }

}

// helpers ---------------------------------------------------------

function logError(err, message, org = null, doc = {}) {

  if (err) {
    logger.error(`[exporter] ${(doc || {})._id}`, { err: err.toJSON(), export: utils.getIdOrNull(doc) })
    if (modules.db.models.org.isAclReady(org)) {
      const logged = Fault.from(err, null, true)
      logged.trace = logged.trace || 'Error\n\tnative exporter:0'
      modules.db.models.Log.logApiErr(
        'export',
        logged,
        new acl.AccessContext(ap.synthesizeAnonymous(org), acl.isAccessSubject(doc) ? doc : null, { req: message.req })
      )
    }
  }

}

function createNdJsonStream() {

  let first = true
  return new stream.Transform({

    writableObjectMode: true,

    transform(object, enc, callback) {

      let err, formatted = ''
      try {
        if (object) {
          if (first) {
            first = false
          } else {
            formatted = '\n'
          }
          formatted += JSON.stringify(object)
        }
      } catch (e) {
        err = e
      }
      setImmediate(callback, err, Buffer.from(formatted))
    },

    flush(callback) {
      callback()
    }
  })

}

function createJsonStream() {
  let first = true

  return new stream.Transform({

    writableObjectMode: true,

    transform(json, enc, callback) {
      let err, formatted = ''
      try {
        if (json) {
          if (first) {
            formatted = '['
          } else {
            formatted += ','
          }
          formatted += '\n'
          formatted += (json ? JSON.stringify(json) : '')
          first = false
        }
      } catch (e) {
        err = e
      }
      callback(err, Buffer.from(formatted))
    },

    flush(callback) {
      this.push(Buffer.from(first ? '[]' : '\n]'))
      callback()
    }
  })
}

function collectHeaders(into, obj, path = '') {
  if (into) {
    if (utils.isPlainObject(obj)) {
      Object.keys(obj).forEach(key => {
        collectHeaders(into, obj[key], path ? `${path}.${key}` : key)
      })
    } else if (Array.isArray(obj)) {
      obj.forEach((obj, key) => {
        collectHeaders(into, obj, path ? `${path}[${key}]` : `[${key}]`)
      })
    } else if (path && obj !== Undefined) {
      into.add(path)
    }
  }

}

function writeToStream(stream, data, cb) {
  if (!stream.write(data)) {
    stream.once('drain', () => {
      cb()
    })
  } else {
    setImmediate(cb)
  }
}

function awsFile(facet) {

  if (facet && Array.isArray(facet.meta)) {
    const entry = facet.meta.filter(v => v && v.name === 'awsId')[0]
    if (entry) {
      return entry.value
    }
  }
  return null
}

function json2Csv(obj, into = {}, path = null) {

  if (utils.isPlainObject(obj)) {
    Object.keys(obj).forEach(key => {
      json2Csv(obj[key], into, path ? `${path}.${key}` : key)
    })
  } else if (Array.isArray(obj)) {
    obj.forEach((obj, key) => {
      json2Csv(obj, into, path ? `${path}[${key}]` : `[${key}]`)
    })
  } else if (path && obj !== Undefined) {
    into[path] = obj
  }
  return into

}
