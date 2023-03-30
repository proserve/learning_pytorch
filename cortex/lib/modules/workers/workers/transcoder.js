'use strict'

const Worker = require('../worker'),
      { toJSON, promised, sleep, path: pathTo, array: toArray, clamp, rInt, equalIds, isSet } = require('../../../utils'),
      { media: { states: { pending: pendingMediaState } }, LocationTypes: { AwsS3Upload }, Transactions: { Signals } } = require('../../../consts'),
      AccessPrincipal = require('../../../access-principal'),
      { AccessContext } = require('../../../acl'),
      { EventEmitter } = require('events'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      config = require('cortex-service/lib/config'),
      ClusterServiceClient = require('cortex-service/lib/kube/cluster-service-client'),
      { driver: { Driver }, services: { transcoder }, db, aws } = require('../../../modules'),
      { sequencedFunction, models: { Composition, WorkerLock, Org, Log } } = db,
      {
        maxSimultaneousTranscodings,
        minPoll,
        maxPoll,
        pollBackOffScalar,
        serviceRequestTimeout,
        serviceRetryInterval,
        maxRetries,
        uploadRequestTimeout
      } = config('services.transcoder.worker')

let Undefined

function minPossiblePoll() {
  return Math.max(1000, minPoll)
}

function maxPossiblePoll() {
  return Math.min(60000, maxPoll)
}

// try forever, because without the service
async function getRemoteJobQueue(job) {

  const jobs = await job.call('GET /')
  return job.cancelled ? [] : toArray(pathTo(jobs, 'data'))
}

function urlParts(url) {

  const space = url.indexOf(' '),
        method = url.substr(0, space).toLowerCase(),
        path = url.substr(space + 1)

  return { method, path }
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

async function getCompositions(principal, { where, sort, limit, skip = 0 }) {

  // get state of current operations.
  const driver = new Driver(principal, Composition, { }),
        cursor = await (driver.cursor(
          {
            where,
            sort,
            limit,
            skip,
            crossOrg: true
          },
          {
            skipAcl: true,
            grant: 'system'
          },
          {
            json: false
          }
        )),
        output = []

  while (!cursor.isClosed() && await promised(cursor, 'hasNext')) {
    output.push(await promised(cursor, 'next'))
  }

  return output

}

async function getComposition(principal, { where, sort, skip = 0 }) {

  return (await getCompositions(principal, { where, sort, skip, limit: 1 }))[0]

}

async function loadEnvironment(env) {
  return promised(Org, 'loadOrg', env)
}

async function safeLoadEnvironment(env) {
  let err, result
  try {
    result = await promised(Org, 'loadOrg', env)
  } catch (e) {
    err = e
  }
  return [err, result]
}

class Job extends EventEmitter {

  constructor() {
    super()
    this.cancelled = false
    this.curPoll = minPossiblePoll()
    this.pollIn = null
    this.resetStats()
  }

  resetStats() {
    this.stats = {}
  }

  addToStat(stat, value = 1) {

    const { stats } = this

    if (!isSet(stats[stat])) {
      stats[stat] = 0
    }

    stats[stat] += value
    return this
  }

  setStat(stat, value) {
    this.stats[stat] = value
    return this
  }

  getStat(stat) {
    return this.stats[stat] || 0
  }

  toJSON() {

    const { cancelled, stats, curPoll } = this

    return {
      ...stats,
      cancelled,
      curPoll
    }
  }

  cancel() {
    if (!this.cancelled) {
      this.cancelled = true
      try {
        this.emit('cancelled')
      } catch (e) {
        void e
      }
    }
  }

  // calculate next poll time using back-off and check periodically for cancellation.
  async wait(minPoll = minPossiblePoll(), maxPoll = maxPossiblePoll(), backOff = pollBackOffScalar) {

    if (this.cancelled) {
      return false
    }

    this.curPoll = this.getStat('changes') ? minPoll : Math.min(maxPoll, Math.max(minPoll, this.curPoll) * backOff)
    this.pollIn = this.curPoll
    while (this.pollIn > 0) {

      await sleep(Math.min(this.pollIn, minPoll))
      this.pollIn = Math.max(0, this.pollIn - minPoll)

      if (this.cancelled) {
        return false
      }
    }

    return true
  }

  async safeUpload(ac, stream, key, contentType) {

    let upload = null, err, result

    const location = aws.getLocationSync(ac, AwsS3Upload),
          params = {
            Key: key,
            Body: stream,
            ContentType: contentType,
            CacheControl: 'no-cache, no-store, private'
          },
          cancel = () => {
            if (upload) {
              try {
                upload.abort()
              } catch (e) {
                void e
              }
            }
          }

    this.once('cancelled', cancel) // trap cancellation and abort locally running requests

    try {

      result = await new Promise((resolve, reject) => {

        let timer = null

        const clear = () => {
                if (timer) {
                  clearTimeout(timer)
                  timer = null
                }
              },
              restart = () => {
                clear()
                timer = setTimeout(() => {
                  if (upload) {
                    upload.abort()
                  }
                }, uploadRequestTimeout)
              },
              progress = (info) => {
                restart()
                // logger.silly(`[transcoder] progress`, info)
              },
              callback = (err, data) => {
                clear()
                if (upload) {
                  upload.removeListener('httpUploadProgress', progress)
                }
                upload = null
                err ? reject(err) : resolve(data)
              }

        upload = location.upload(params, { queueSize: 1, partSize: 5 * 1024 * 1024 }, callback)
        upload.on('httpUploadProgress', progress)

        restart()

      })

    } catch (e) {
      err = e
    }

    this.removeListener('cancelled', cancel)

    if (err) {
      // an aborted request is not an error if the api or the worker is shutting down.
      if (err.code === 'RequestAbortedError') {
        if (this.cancelled) {
          result = null
        }
      }
    }
    return [err, result]

  }

  // tries forever unless cancelled. essentially, this worker does not function without the service, so this is okay.
  async call(url, options = {}) {

    let req, err, result = Undefined

    const { method, path } = urlParts(url),
          isStream = options.stream,
          cancel = () => {
            if (req) {
              try {
                req.destroy()
              } catch (e) {
                void e
              }
            }
          }

    this.once('cancelled', cancel) // trap cancellation and abort locally running requests

    try {

      // wait for either the job to have been cancelled for shutdown or for an actual result.
      while (!this.cancelled && result === Undefined) {

        await new Promise((resolve, reject) => {

          const callback = async(err, res) => {

            // convert stream errors to faults, if possible.
            if (!err && isStream && res) {
              if (res.statusCode !== 200) {
                err = await new Promise((resolve) => {
                  let body = ''
                  const close = () => {
                    let payload, fault
                    try {
                      payload = ((res.headers['content-type'] || '').indexOf('application/json') === 0) ? JSON.parse(body) : body
                    } catch (e) {
                      payload = body
                    }
                    if (payload && payload.object === 'fault') {
                      fault = Fault.from(payload, false, true)
                    } else {
                      fault = Fault.create('cortex.error.unspecified', { statusCode: res.statusCode, reason: payload })
                    }
                    fault.statusCode = parseInt(fault.statusCode) || 500 // local reliance on number as status code.
                    resolve(fault)
                  }
                  res.on('data', data => { body += data })
                  res.on('aborted', () => resolve(Fault.create('cortex.error.aborted')))
                  res.on('end', close)
                  res.on('close', close)
                  res.on('error', resolve)
                })
              }
            }

            if (err) {

              if (options.endpoint) {
                // logger.silly('[transcoder] endpoint call err', err.toJSON())
              }

              // swallow server errors that could be network or service availability related.
              if (String(err.errno || err.code)[0] === 'E' || [408, 502, 503, 504].includes(err.statusCode) || err.errCode === 'cortex.error.aborted') {
                err = null
                this.curPoll = minPossiblePoll()
                await sleep(serviceRetryInterval)
              }
            } else {

              // finished. set result and pause streams immediately to preserve data
              result = res
              if (isStream) {
                result.pause()
              }
            }

            err ? reject(err) : resolve(null)

          }

          if (options.endpoint) {

            // logger.silly('[transcoder] endpoint call', options.endpoint)
            const { endpoint } = options

            req = ClusterServiceClient.prototype.__callEndpoint.call(transcoder, endpoint, method, path, { timeout: serviceRequestTimeout, ...options }, callback)

          } else {

            req = transcoder.call(method, path, { timeout: serviceRequestTimeout, ...options }, callback)
          }
        })

        try {
          if (req) {
            req.destroy()
          }
        } catch (e) {
          void e
        }

        req = null

      }
    } catch (e) {
      err = e
    }

    this.removeListener('cancelled', cancel)

    if (err) {
      throw err
    }
    return result

  }

  async safeCall(url, options = {}) {

    let err, result
    try {
      result = await this.call(url, options)
    } catch (e) {
      err = e
    }
    return [err, result]

  }

  async safeSetError(composition, e, { retryable = true } = {}, fnUpdate = async(updateContext, composition) => {}) {

    this.addToStat('errors')

    let ac

    const [err, result] = await this.safeUpdateComposition(composition, async(updateContext, composition) => {

      ac = updateContext

      const retries = rInt(composition.retries, 0) + 1,
            update = {
              retries,
              err: Fault.from(e)
            }

      if (retries >= maxRetries || !retryable) {
        update.state = 'error'
      }

      await promised(composition, 'aclWrite', updateContext, update)

      return fnUpdate(updateContext, composition)

    })

    if (ac) {
      const logged = Fault.from(err, false, true)
      logged.trace = logged.trace || 'Error\n\tnative transcoder:0'
      Log.logApiErr('api', logged, ac)
    }

    return [err, result]
  }

  async safeUpdateComposition(composition, fnUpdate) {

    let err, result
    try {
      result = await this.updateComposition(composition, fnUpdate)
    } catch (e) {
      err = e
    }
    return [err, result]

  }

  async updateComposition(composition, fnUpdate) {

    this.addToStat('updates')

    const org = await loadEnvironment(composition.org),
          principal = AccessPrincipal.synthesizeAnonymous(org),
          ac = new AccessContext(principal, composition, { grant: 'system' })

    return promised(
      db,
      sequencedFunction,
      callback => {

        Promise.resolve(null)
          .then(async() => {
            return promised(ac.object, 'aclReadOne', ac.principal, ac.subjectId, { json: false, grant: 'system' })
          })
          .then(async doc => {
            if (doc) {

              const updateContext = new AccessContext(ac.principal, doc, { grant: 'system', method: 'put' }),
                    result = await fnUpdate(updateContext, doc)

              if (result !== false) {

                await promised(updateContext, 'save', { disableTriggers: true })

              }
            }
            return doc
          })
          .then((doc) => callback(null, doc))
          .catch(err => callback(err))
      },
      20
    )

  }

}

module.exports = class TranscoderWorker extends Worker {

  _process(message, payload, options, callback) {

    let theLock

    Promise.resolve(null)

      .then(() => {

        // acquire lock. ignore signals and use the
        // system level message.cancelled to detect an exit condition.
        return promised(
          WorkerLock,
          'createOrSignalRestart',
          'TranscoderWorker',
          { timeoutMs: 10000, updateIntervalMs: 1000 }

        )

      })
      .then(async lock => {

        if (!lock) {
          return
        }

        theLock = lock

        // prep for possible cancel condition (if the process needs to shutdown or there's a problem with the worker).
        const medable = await loadEnvironment('medable'),
              principal = AccessPrincipal.synthesizeOrgAdmin(medable),
              driver = new Driver(principal, Composition, { }),
              job = new Job()

        message.on('cancel', () => {
          job.cancel()
        })
        lock.on('signal', (l, s) => {
          job.curPoll = minPossiblePoll()
          if (s === Signals.Shutdown || s === Signals.Error) {
            job.cancel()
          }
        })

        while (1) {

          job.resetStats()

          // get state of current operations.
          const localCount = await driver.count(
            { where: { state: 'running' }, crossOrg: true },
            { skipAcl: true }
          )

          let jobs = await getRemoteJobQueue(job),
              numOperations = Math.max(jobs.length, localCount), // estimate running jobs and only start enough to limit to the ceiling. @todo workers will replace this as it will not scale smoothly or automatically.
              err,
              composition

          job.setStat('skipped', 0)
          job.setStat('remoteJobs', jobs.length)
          job.setStat('localJobs', localCount)

          // -----------------------------------------------------------------------------
          // set new local operations to the running state.

          while (numOperations < maxSimultaneousTranscodings) {

            if (job.cancelled) {
              break
            }

            // find next composition to set in motion. it's okay for this to throw and stop the worker. it means something is too wrong to continue
            composition = await getComposition(principal, { where: { state: 'queued' }, sort: { _id: 1 }, skip: job.getStat('skipped') })

            if (!composition) {
              break
            }

            job.addToStat('changes')

            numOperations += 1

            ;[err, composition] = await job.safeUpdateComposition(composition, async(ac, composition) => {

              const formats = toArray(config('composition.formats')),
                    format = formats.find(v => v.mime === composition.format) || formats.find(v => v.extension === 'mp4'),
                    { extension } = format,
                    filename = `composition-${composition._id}.${extension}`

              return promised(
                composition,
                'aclWrite',
                ac,
                {
                  state: 'running',
                  file: { content: filename }
                }
              )
            })

            if (err) {

              [err, composition] = await job.safeSetError(composition, err, { retryable: true })

              if (err) {
                job.addToStat('skipped', 1) // skip because there was an error setting the error.
                logger.error('[transcoder] fatal error', err.toJSON({ stack: true }))
              } else if (composition.state !== 'error') {
                job.addToStat('skipped', 1) // skip and come back to it later.
              }
            }
          }

          // -----------------------------------------------------------------------------
          // maintain remote job queue

          for (let composition of await getCompositions(principal, { where: { state: 'running' } })) {

            if (job.cancelled) {
              break
            }

            const [, { code: env } = {}] = await safeLoadEnvironment(composition.org),
                  { definition: body } = composition

            // likely a temporary error reading the org. just move on.
            if (!env) {
              continue
            }

            if (!composition.started || !composition.remoteId) {

              // -----------------------------------------------------------------------------
              // start new jobs or those forced to restart by having reset the remoteId

              let err, result, remoteId

                  // start the job remotely and update the local job with a remote id.
              ;[err, result] = await job.safeCall(`POST /${env}`, { json: true, body })

              if (err) {

                await job.safeSetError(composition, err, { retryable: true })

              } else if (result && result.uuid) {

                remoteId = result.uuid

                ;[err, result] = await job.safeUpdateComposition(composition, async(ac, composition) =>

                  // leave start intact for restarts
                  promised(composition, 'aclWrite', ac, { remoteId, started: composition.started || new Date() })
                )

                // this is local write error that should not have occurred. record the local error and attempt to
                // revert the remote job.
                if (err) {

                  job.addToStat('restart')

                  await job.safeSetError(composition, err, { retryable: true }, async(ac, composition) => {
                    promised(composition, 'aclWrite', ac, { remoteId: null })
                  })

                  job.addToStat('delete-restarted-remote')

                  await job.call(`DELETE /${env}/${remoteId}`)

                } else {

                  // poll again sooner than later.
                  job.addToStat('changes')

                }

              } else {

                // the transcoder service will return a result under normal conditions. assume some remote
                // blip and continue normally (unless quiting, which is checked in the next set of operations).
                void 0

              }

            } else {

              // -----------------------------------------------------------------------------
              // check the remote job status for locally running compositions

              const [callErr, remote] = (await job.safeCall((`GET /${env}/${composition.remoteId}`))) || {},
                    { uuid, progress: rawProgress = '0', err: remoteErr, complete, output, path, endpoint } = remote || {},
                    progress = clamp(rInt(parseInt(rawProgress), 0), 0, 100)

              if (callErr || !uuid || remoteErr) {

                job.addToStat('changes')

                // some kind of remote error that's not a network error. ignore callErr these because the transcoder
                // service only returns null or a job with an error. in this case, assume the remote job
                // is not running and reset the local remoteId to force a restart.
                // if remoteErr is set, it means there was a transcoding error we need to address.

                const update = async(ac, composition) => promised(composition, 'aclWrite', ac, { remoteId: null, output })
                if (remoteErr) {
                  job.addToStat('fatal-remote-err')
                  await job.safeSetError(composition, remoteErr, { retryable: false }, update)
                } else {
                  job.addToStat('restart-remote-missing')
                  await job.safeUpdateComposition(composition, update)
                }

              } else if (complete && path) {

                job.addToStat('changes')

                // progress at 100% with a path is the metric for completion.
                // stream file from transcoder service and pipe to aws.
                let err, res

                ;[err, res] = await job.safeCall(`GET /${env}/${composition.remoteId}/media`, { endpoint, stream: true })

                if (err) {

                  // note about err.statusCode === 404: the remote job was not found. restart locally but trap error
                  // so we do not loop forever if there is some weird case.
                  job.addToStat('err-remote-media')

                  await job.safeSetError(composition, err, { retryable: true }, async(ac, composition) =>
                    promised(composition, 'aclWrite', ac, { remoteId: null, output })
                  )

                } else {

                  // stream into aws upload
                  const uploadFacet = toArray(composition.file && composition.file.sources)[0],
                        filePid = pathTo(composition, 'file.facets.0'),
                        fileFacet = filePid && toArray(composition.facets).find(facet => equalIds(facet.pid, filePid) && !facet._kl),
                        path = awsFile(uploadFacet),
                        streamOrg = await loadEnvironment(composition.org),
                        streamPrincipal = AccessPrincipal.synthesizeAnonymous(streamOrg),
                        streamAc = new AccessContext(streamPrincipal, composition, { grant: 'system' })

                  // look up the composition facet. if it exists, assume we are done.
                  let err, result = null
                  if (!fileFacet || fileFacet.state === pendingMediaState) {

                    [err, result] = await job.safeUpload(streamAc, res, path, composition.format)

                  } else {

                    logger.silly('[transcoder] facet seems to exist and be in a non-pending state', { fileFacet })

                  }

                  if (err) {

                    job.addToStat('err-stream-upload')

                    // an upload error could be fatal or just a blip. allow a retry since we don't know what's wrong.
                    await job.safeSetError(composition, err, { retryable: true })

                  } else if (!result) {

                    job.addToStat('null-remote')

                    // if the job was cancelled or there is some kind of cancellation, this will be null.
                    // if that happens, allow a retry without cost.
                    void 0

                  } else {

                    job.addToStat('completed')

                    // mark as completed only if the upload completed successfully.
                    // the media processor still has to process the composition itself.
                    ;[err, composition] = await job.safeUpdateComposition(composition, async(ac, composition) =>
                      promised(composition, 'aclWrite', ac, { progress: 100, state: 'complete', completed: new Date(), output })
                    )

                    // the completion update failed. in this case, because the file may have already
                    // been processed and the only likely scenario is that the composition is gone locally, let this
                    // pass and re-attempt. next time in the loop, it may have self-healed.
                    // if the upload _is_ successful, the cleanup cycle will catch it.
                    void 0

                  }

                }

              } else if (composition.progress !== progress) {

                job.addToStat('changes')

                await job.safeUpdateComposition(composition, async(ac, composition) =>
                  promised(composition, 'aclWrite', ac, { progress, output })
                )

              } else {

                // no state changes.
                void 0

              }

            }

          }

          // -----------------------------------------------------------------------------
          // cleanup remote jobs that have no local running counterpart.
          jobs = await getRemoteJobQueue(job)
          for (const jobDoc of jobs) {

            if (job.cancelled) {
              break
            }

            const { env, uuid } = jobDoc,
                  doc = await getComposition(principal, { where: { remoteId: uuid, state: 'running' } })

            if (!doc) {

              job.addToStat('delete-missing-from-remote')
              await job.call(`DELETE /${env}/${uuid}`)
            }

          }

          // periodically allow the worker to finish (once it reaches max poll) to help prevent
          // unforeseen resource starvation, worker blocks or some poor logic in here that prevents
          // queue continuity.
          if (job.curPoll === maxPoll || await job.wait() === false) {
            // logger.silly('[transcoder].exiting', job.toJSON())
            break
          }

          // logger.silly('[transcoder].stats', job.toJSON())

        }

      })
      .catch(err => {

        // pass the error along, this is some kind fatal error
        return err

      })
      .then(async err => {

        // give up the worker lock.
        try {
          if (theLock) {
            theLock.removeAllListeners()
            await promised(theLock, 'complete')
          }
        } catch (e) {
          if (!err) {
            err = e
          }
        }

        if (err) {
          const logged = Fault.from(err, null, true)
          logged.trace = logged.trace || 'Error\n\tnative transcoder:0'
          logger.error('[transcoder]', Object.assign(toJSON(err, { stack: true }), { doc: message.doc }))
          Org.loadOrg('medable', function(err, org) {
            if (!err) {
              Log.logApiErr(
                'api',
                logged,
                new AccessContext(
                  AccessPrincipal.synthesizeAnonymous(org),
                  null,
                  { req: message.req })
              )
            }
          })
        }

        callback()

      })

  }

}
