'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      modules = require('../../../modules'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      humanizeDuration = require('humanize-duration'),
      ap = require('../../../access-principal'),
      Blob = modules.db.models.Blob,
      Org = modules.db.models.Org,
      Deployment = modules.db.models.Deployment

// ------------------------------------------------------------

function DeployerWorker() {
  Worker.call(this)
}

util.inherits(DeployerWorker, Worker)

DeployerWorker.prototype.getRequiredRecipientPrincipalPaths = function() {
  return ['name']
}

DeployerWorker.prototype.hasAllRequiredRecipientAccountPrincipalPaths = function(principal) {
  if (ap.is(principal)) {
    return _.every(this.getRequiredRecipientPrincipalPaths(), function(path) { return utils.path(principal.account, path) !== undefined })
  }
  return false
}

DeployerWorker.prototype.parsePayload = function(message, payload, callback) {

  const tasks = []

  if (!utils.isPlainObject(payload)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Deployer worker missing payload.' }))
  }

  payload.sourceId = utils.getIdOrNull(payload.sourceId) || utils.createId()

  // load the org
  if (!Org.isAclReady(payload.org)) {
    tasks.push(callback => {
      modules.db.models.Org.loadOrg(utils.getIdOrNull(payload.org, true), function(err, org) {
        payload.org = org
        callback(err)
      })
    })
  }

  // load the principal
  if (!this.hasAllRequiredRecipientAccountPrincipalPaths(payload.principal)) {
    tasks.push(callback => {
      ap.create(payload.org, utils.getIdOrNull(payload.principal), { include: this.getRequiredRecipientPrincipalPaths() }, (err, principal) => {
        if (!err && !principal) {
          err = Fault.create('cortex.notFound.account', { reason: 'Deployment principal not found.', path: 'worker.deployer.principal' })
        }
        payload.principal = principal
        callback(err)
      })
    })
  }

  // load the blob
  tasks.push(callback => {
    Blob.findOne({ org: payload.org._id, _id: utils.getIdOrNull(payload.blob) }, (err, blob) => {
      if (!err && !blob) {
        err = Fault.create('cortex.notFound.instance', { path: 'worker.deployer.blob' })
      }
      payload.blob = blob
      callback(err)
    })
  })

  // create a deployment object from the blob.
  tasks.push(callback => {
    modules.deployment.unzipPayload(payload.blob.data.toString(), (err, data) => {
      if (!err) {
        payload.deployment = new Deployment(data)
        payload.userdata = data.userdata
      }
      callback(err)
    })
  })

  // create an access context.
  tasks.push(callback => {
    payload.ac = new acl.AccessContext(payload.principal, payload.deployment, {
      req: message.req
    })
    callback()
  })

  async.series(tasks, err => {

    if (!payload.ac && Org.isAclReady(payload.org)) {
      const { org, principal, deployment } = payload
      payload.ac = new acl.AccessContext(
        ap.is(principal) ? principal : ap.synthesizeAccount({ org, accountId: utils.couldBeId(principal) ? principal : acl.AnonymousIdentifier }),
        acl.isAccessSubject(deployment) ? deployment : (utils.couldBeId(deployment) ? new Deployment({ _id: deployment }) : null),
        { req: message.req }
      )
    }

    if (!err) {
      payload.source = utils.array(payload.org.deployment.sources).filter(src => utils.equalIds(src._id, payload.deploymentSourceId))[0]
    }

    callback(err, payload.ac)
  })

}

/**
     * @param message
     * @param payload
     *     org
     *     blob
     *     deployment
     *     principal
     * @param options
     * @param callback_
     * @private
     */
DeployerWorker.prototype._process = function(message, payload, options, callback_) {

  this.parsePayload(message, payload, (err, ac) => {

    if (err) {
      if (ac) {
        modules.deployment.logError(ac, payload.sourceId, err)
      }
      removeBlob(utils.path(payload, 'blob'))
      return callback_()
    }

    let cancelled = false, cancelReason = null, rescheduleInSecs = null, rescheduleReason = null

    modules.audit.recordEvent(ac, 'deployment', 'execute', { metadata: { started: new Date() } }, (err, eventId) => {

      void err
      ac.option('sandbox.logger.source', consts.logs.sources.deployment) // <-- ensure the logger adopts the correct output source.
      ac.option('deferSyncEnvironment', true)

      const callback = _.once(err => {

        if (err) {
          err = Fault.from(err, false, true)
          modules.deployment.logError(ac, payload.sourceId, err)
        }

        // if not rescheduled (we have a real result, attempt to reply to the deployment source)
        if (err || rescheduleInSecs === null) {
          if (!payload.source) {
            modules.deployment.logError(ac, payload.sourceId, Fault.create('cortex.error.unspecified', { reason: 'Deployment source could not be notified.' }))
          } else {
            modules.deployment.respondResult(ac.org, payload.source, payload.deployment._id, payload.sourceId, utils.prepareResult(err, true), err => {
              if (err) {
                err = Fault.create('cortex.error.unspecified', {
                  reason: 'Deployment source notification error.',
                  faults: Fault.from(err, false, true)
                })
                modules.deployment.logError(ac, payload.sourceId, err)
              } else {
                modules.deployment.log(ac, payload.sourceId, 'Deployment source notified.')
              }
            })
          }
        }

        if (eventId) {

          const update = { err }
          if (!err && rescheduleInSecs !== null) {
            update['metadata.rescheduled'] = true
          }
          update['metadata.ended'] = new Date()
          update['metadata.completed'] = !err && rescheduleInSecs === null

          modules.audit.updateEvent(eventId, update)
        }

        callback_()
      })

      if (message.cancelled) {
        return callback(Fault.create('cortex.error.aborted'))
      }

      // run 'before' script.
      modules.sandbox.sandboxed(
        ac,
        utils.rString(utils.path(payload, 'deployment.scripts.before'), ''),
        {
          compilerOptions: {
            type: 'deployment',
            specification: 'es6',
            label: 'Before Script for Deployment "' + payload.deployment.label + '"'
          },
          scriptOptions: {
            context: {
              _id: ac.subjectId,
              object: 'deployment',
              rescheduled_count: utils.rInt(payload.num_reschedules, 0),
              payload: payload.userdata
            },
            api: {
              context: {
                cancel: function(script, message, reason, callback) {
                  cancelReason = utils.rString(reason, '')
                  callback(null, cancelled = true)
                },
                reschedule: function(script, message, inSecs, reason, callback) {
                  rescheduleReason = utils.rString(reason, '')
                  callback(null, rescheduleInSecs = utils.clamp(utils.rInt(inSecs, 0), 10, 900)) // 10secs - 30minutes
                }
              }
            }
          }
        }
      )(err => {

        if (!err && rescheduleInSecs !== null) {

          if (payload.num_reschedules >= 5) {

            removeBlob(utils.path(payload, 'blob'))
            err = Fault.create('cortex.error.unspecified', { reason: 'Deployment rescheduled too many times.' })

          } else {

            // bump the blob ttl
            let blobId = utils.getIdOrNull(payload.blob, true)
            if (blobId) {
              Blob.updateOne({ _id: blobId }, { $set: { expires: new Date(Date.now() + (1000 * 60 * 30) + (rescheduleInSecs * 1000)) } }).exec()
            }
            modules.deployment.log(ac, payload.sourceId, `Deployment rescheduled to run in ${humanizeDuration(rescheduleInSecs * 1000)}` + (rescheduleReason ? ` (${rescheduleReason})` : ''))

            modules.workers.send('work', 'deployer', {
              blob: blobId,
              deployment: ac.subjectId,
              org: ac.orgId,
              principal: ac.principalId,
              num_reschedules: utils.rInt(payload.num_reschedules, 0) + 1,
              sourceId: payload.sourceId,
              deploymentSourceId: payload.deploymentSourceId
            }, {
              reqId: message.reqId,
              orgId: ac.orgId,
              trigger: new Date(Date.now() + (rescheduleInSecs * 1000))
            })

          }

          return callback(err)

        }

        if (err || cancelled) {
          removeBlob(utils.path(payload, 'blob'))
          if (!err && cancelled) {
            modules.deployment.log(ac, payload.sourceId, 'Deployment cancelled' + (cancelReason ? ` (${cancelReason})` : ''))
          }
          return callback(err)
        }

        // begin deployment.
        let unsetInProgress = false, doRollback = false, rollbackData

        async.series([

          // 1. set the org to a deploying state. this is probably safe.
          callback => {

            if (message.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }

            modules.db.sequencedUpdate(Org, { _id: ac.orgId, 'deployment.inProgress': { $ne: true } }, { $set: { 'deployment.inProgress': true } }, (err, doc) => {
              if (!err && !doc) {
                err = Fault.create('cortex.accessDenied.deploymentInProgress')
              }
              if (!err) {
                unsetInProgress = true
                modules.deployment.log(ac, payload.sourceId, 'Org placed into Deployment Maintenance Mode.')
              }
              callback(err)
            })

          },

          // 2. wait until all request and worker (other than this one) have completed. if x seconds has elapsed and we haven't yet got control, back out.
          callback => {

            callback = _.once(callback)

            let giveUpNode = modules.db.models.Deployment.schema.node.findNode('giveUpSeconds'),
                giveUpValidator = giveUpNode.validators.find(v => v.name === 'number').definition,
                giveUpSeconds = Math.max(giveUpValidator.min, Math.min(giveUpValidator.max, utils.rInt(payload.deployment.giveUpSeconds, utils.rVal(giveUpNode.default, 60)))),
                gracePeriodNode = modules.db.models.Deployment.schema.node.findNode('outputStreamsGracePeriodSeconds'),
                gracePeriodValidator = gracePeriodNode.validators.find(v => v.name === 'number').definition,
                gracePeriodSeconds = Math.max(gracePeriodValidator.min, Math.min(gracePeriodValidator.max, utils.rInt(payload.deployment.outputStreamsGracePeriodSeconds, utils.rVal(gracePeriodValidator.default, 10)))),
                giveUpTimer = setTimeout(() => {
                  giveUpTimer = null
                  callback(Fault.create('cortex.timeout.envActivity', { path: 'deployment' }))
                }, 1000 * giveUpSeconds),
                gracePeriodTimer = payload.deployment.closeOutputStreams && setTimeout(() => {
                  gracePeriodTimer = null
                  modules.services.api.clusterGetActivity(ac.orgId, { verbose: true }, (err, currentActivity) => {
                    if (!err) {
                      currentActivity.requests.map(req => {
                        modules.services.api.closeRequest(req._id, { force: false, org: ac.orgId }, () => {})
                      })
                    }
                  })
                }, 1000 * gracePeriodSeconds),
                inactive = false

            async.whilst(
              () => {
                return !inactive
              },
              callback => {
                if (!giveUpTimer) {
                  inactive = true
                  return callback()
                }
                if (message.cancelled) {
                  return callback(Fault.create('cortex.error.aborted'))
                }
                // org should have a single worker.
                modules.services.api.clusterGetActivity(ac.orgId, (err, activity) => {
                  if (!err) {
                    inactive = activity.requests === 0 && activity.workers === 1 && activity.scripts === 0
                    if (!inactive) {
                      return setTimeout(callback, 500)
                    }
                  }
                  callback(err)
                })
              },
              err => {
                clearTimeout(giveUpTimer)
                clearTimeout(gracePeriodTimer)
                giveUpTimer = null
                gracePeriodTimer = null
                callback(err)
              }
            )

          },

          // 3. perform a backup of all relevant deployment data.
          callback => {
            modules.deployment.log(ac, payload.sourceId, 'Backing up.')
            Deployment.createBackup(ac, (err, data) => {
              if (err) {
                return callback(err)
              }
              if (message.cancelled) {
                return callback(Fault.create('cortex.error.aborted'))
              }
              rollbackData = data

              Blob.create({
                org: ac.orgId,
                label: 'Deployment Backup',
                expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)), // 30 days.
                data: data
              }, (err, blob) => {

                if (err) {
                  return callback(err)
                }

                removeBlob(utils.path(ac.org, 'deployment.backup')) // remove current backup.

                Org.aclUpdatePath(ac.principal, ac.orgId, 'deployment.backup', blob._id, { method: 'put', req: ac.req, skipAcl: true, grant: acl.AccessLevels.System, hooks: false }, err => {
                  callback(err)
                })
              })
            })
          },

          // 4. validate deployment
          callback => {

            payload.deployment.validateForTarget(ac, callback)

          },

          // 5. deploy
          callback => {

            if (message.cancelled) {
              return callback(Fault.create('cortex.error.aborted'))
            }
            doRollback = true
            payload.deployment.deploy(ac, callback)

          },

          // sync environment
          async() => {

            ac.option('deferSyncEnvironment', false)
            await ac.org.syncEnvironment(ac, { save: true, throwError: true, synchronizeJobs: true })

          },

          // run 'after' script
          callback => {

            const scriptRunner = modules.sandbox.sandboxed(
              ac,
              utils.rString(utils.path(payload, 'deployment.scripts.after'), ''),
              {
                compilerOptions: {
                  type: 'deployment',
                  label: 'After Script for Deployment "' + payload.deployment.label + '"'
                },
                scriptOptions: {
                  context: {
                    _id: ac.subjectId,
                    object: 'deployment',
                    rescheduled_count: utils.rInt(payload.num_reschedules, 0),
                    payload: payload.userdata
                  }
                }
              }
            )
            scriptRunner(callback)

          }

        ], err => {

          const done = () => {
            if (unsetInProgress) {
              modules.db.sequencedUpdate(Org, { _id: ac.orgId, object: 'org', 'deployment.inProgress': true }, { $set: { 'deployment.inProgress': false } }, (err) => {
                void err
              })
            }
            removeBlob(utils.path(payload, 'blob'))
            callback()
          }

          if (err) {
            err = Fault.from(err, false, true)
            modules.deployment.logError(ac, payload.sourceId, err)
            if (doRollback) {
              modules.deployment.log(ac, payload.sourceId, 'Rolling back.')
              return Deployment.rollback(ac, rollbackData, _err => {
                if (_err) {
                  modules.deployment.logError(ac, payload.sourceId, _err)
                  return done()
                }
                modules.deployment.log(ac, payload.sourceId, 'Deployment rolled back.')

                const fault = err.toJSON(),
                      scriptRunner = modules.sandbox.sandboxed(
                        ac,
                        utils.rString(utils.path(payload, 'deployment.scripts.rollback'), ''),
                        {
                          compilerOptions: {
                            type: 'deployment',
                            label: 'Rollback Script for Deployment "' + payload.deployment.label + '"'
                          },
                          runtimeArguments: {
                            fault: fault
                          },
                          scriptOptions: {
                            context: {
                              _id: ac.subjectId,
                              object: 'deployment',
                              rescheduled_count: utils.rInt(payload.num_reschedules, 0),
                              payload: payload.userdata,
                              fault: fault
                            }
                          }
                        }
                      )
                scriptRunner(() => {
                  done()
                })
              })
            }
          } else {
            modules.deployment.log(ac, payload.sourceId, 'Deployment completed.')
          }
          done()
        })

      })

    })

    function removeBlob(object) {
      let blobId = utils.getIdOrNull(object, true)
      if (blobId) {
        Blob.deleteOne({ _id: blobId }).exec()
      }
    }

  })

}

module.exports = DeployerWorker
