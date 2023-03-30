'use strict'

const Worker = require('../worker'),
      util = require('util'),
      async = require('async'),
      modules = require('../../../modules'),
      models = modules.db.models,
      _ = require('underscore'),
      utils = require('../../../utils'),
      acl = require('../../../acl'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      ap = require('../../../access-principal'),
      matrix = OrgRefresherWorker.PreserveMatrix = {
        accounts: ['administrators', 'roles'],
        administrators: [],
        roles: [],
        storage: [],
        objects: ['roles', 'storage'],
        apps: ['roles', 'service_accounts'],
        scripts: ['objects', 'roles', 'apps', 'service_accounts'],
        expressions: [],
        idps: [],
        views: ['objects', 'roles', 'apps', 'service_accounts'],
        templates: [],
        sms_numbers: [],
        org_urls: [],
        deployment_endpoints: [],
        cache: [],
        config: [],
        tokens: ['apps'],
        service_accounts: ['roles'],
        policies: ['roles', 'apps', 'service_accounts'],
        notifications: ['templates', 'sms_numbers'],
        org_configuration: ['notifications', 'org_urls', 'sms_numbers', 'deployment_endpoints', 'cache', 'config', 'policies', 'storage', 'idps'],
        deployments: ['templates', 'views', 'scripts', 'apps', 'objects', 'roles', 'notifications', 'org_urls', 'sms_numbers', 'deployment_endpoints', 'storage', 'service_accounts', 'expressions'],
        exports: ['storage']
      },
      matrixKeys = OrgRefresherWorker.PreserveMatrixKeys = Object.keys(OrgRefresherWorker.PreserveMatrix)

function removeBlob(object) {
  let blobId = utils.getIdOrNull(object, true)
  if (blobId) {
    models.Blob.deleteOne({ _id: blobId }).exec()
  }
}

// ------------------------------------------------------------

function OrgRefresherWorker() {
  Worker.call(this)
}

util.inherits(OrgRefresherWorker, Worker)

OrgRefresherWorker.prototype.resolvePreserveOptions = function resolve(preserve, into) {
  preserve = utils.array(preserve, preserve)
  into = into || []
  preserve.forEach(selected => {
    matrixKeys.forEach(key => {
      if (selected === key) {
        if (!~into.indexOf(key)) {
          into.push(key)
          this.resolvePreserveOptions(matrix[key], into)
        }
      }
    })
  })
  return into
}

OrgRefresherWorker.prototype.parsePayload = function(message, payload, callback) {

  if (!utils.isPlainObject(payload)) {
    return callback(Fault.create('cortex.invalidArgument.unspecified', { path: 'worker.org.refresher.payload' }))
  }

  payload.sourceId = utils.getIdOrNull(payload.sourceId) || utils.createId()
  payload.preserve = this.resolvePreserveOptions(payload.preserve).reduce((preserve, v) => { preserve[v] = true; return preserve }, {}) // convert to object for easy lookup.

  // load the org and principal
  async.series([

    callback => {
      models.org.loadOrg(utils.getIdOrNull(payload.org, true), payload.options, function(err, org) {
        payload.org = org
        callback(err)
      })
    },

    callback => {
      if (!payload.principal || utils.path(payload.org, 'configuration.ephemeral')) {
        payload.principal = ap.synthesizeOrgAdmin(payload.org, utils.getIdOrNull(payload.principal, true))
        return callback()
      }
      ap.create(payload.org, utils.getIdOrNull(payload.principal, true), { include: ['name'] }, (err, principal) => {
        if (!err && !principal) {
          err = Fault.create('cortex.notFound.account', { reason: 'Org refresher principal not found.' })
        }
        payload.principal = principal
        callback(err)
      })
    }

  ], err => {

    if (models.org.isAclReady(payload.org) || utils.path(payload.org, 'configuration.ephemeral')) {
      const { org, principal } = payload
      payload.ac = new acl.AccessContext(
        ap.is(principal) ? principal : ap.synthesizeAccount({ org, accountId: utils.couldBeId(principal) ? principal : acl.AnonymousIdentifier }),
        null,
        { req: message.req }
      )
    }

    callback(err, payload.ac, payload.preserve)
  })

}

/**
 * @param message
 * @param payload
 *     org
 *     principal
 *     preserve
 *
 * @param options
 * @param callback
 * @private
 */
OrgRefresherWorker.prototype._process = function(message, payload, options, callback) {

  this.parsePayload(message, payload, (err, ac, preserve) => {

    if (err) {
      if (ac) {
        modules.deployment.logError(ac, payload.sourceId, err)
      }
      return callback()
    }

    // medable will never refresh
    if (ac.org.code === 'medable') {
      return callback()
    }

    const isEphemeral = ac.org.configuration.ephemeral,
          builtinRoles = Object.values(consts.defaultRoles),
          builtinRoleIds = builtinRoles.map(v => v._id)

    // ignore non-enabled environments
    if (!isEphemeral && !ac.org.configuration.allowOrgRefresh) {
      return callback()
    }

    if (isEphemeral) {
      preserve = {}
    }

    let unsetInProgress = false, refreshData = {}, refreshBlob, orgCollections

    async.series([

      // 1. set the org to a deploying state.
      callback => {
        if (isEphemeral) {
          models.org.collection.updateOne({ _id: ac.orgId }, { $set: { 'deployment.inProgress': true } }, (err, doc) => {
            if (!err) {
              modules.deployment.log(ac, payload.sourceId, 'Org placed into Refresh mode.')
            }
            return callback(err)
          })
        } else {
          modules.db.sequencedUpdate(models.org, { _id: ac.orgId, 'deployment.inProgress': { $ne: true } }, { $set: { 'deployment.inProgress': true } }, (err, doc) => {
            if (!err && !doc) {
              err = Fault.create('cortex.accessDenied.deploymentInProgress')
            }
            if (!err) {
              unsetInProgress = true
              modules.deployment.log(ac, payload.sourceId, 'Org placed into Refresh mode.')
            }
            callback(err)
          })
        }
      },

      // 2. wait until all request and worker (other than this one) have completed. if x seconds has elapsed and we haven't yet got control, back out.
      callback => {

        let giveUpTimer = setTimeout(() => {
              if (giveUpTimer) {
                giveUpTimer = null
                callback(Fault.create('cortex.timeout.envActivity', { path: 'org.refresh' }))
              }
            }, 1000 * 60),
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

            // org should have a single worker (this one)
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
            void (err)
            if (giveUpTimer) {
              clearTimeout(giveUpTimer)
              giveUpTimer = null
              callback()
            }
          }

        )

      },

      // 3. discard unselected org configuration and store in the blob.
      callback => {

        async.parallel({

          org: callback => {

            models.org.findOne({ _id: ac.orgId }).lean().exec((err, org) => {

              if (!err && org) {

                delete org.runtime // force runtime rebuild

                if (!preserve.apps) {
                  org.apps = []
                }
                if (!preserve.policies) {
                  org.policies = []
                }
                if (org.deployment) {
                  delete org.deployment.backup
                  if (!preserve.deployment_endpoints) {
                    org.deployment.targets = []
                    org.deployment.sources = []
                  }
                }
                if (org.configuration) {
                  if (!preserve.notifications) {
                    org.configuration.notifications = []
                  }
                  if (!preserve.sms_numbers && org.configuration.sms) {
                    org.configuration.sms.numbers = []
                  }
                  if (!preserve.org_urls) {
                    org.configuration.urls = {}
                  }
                  if (!preserve.storage && org.configuration.storage) {
                    delete org.configuration.storage.defaultLocation
                    delete org.configuration.storage.exportLocation
                    org.configuration.storage.locations = []
                  }
                }
                if (!preserve.objects) {
                  org.objects = []
                }
                if (!preserve.roles) {
                  org.roles = builtinRoles
                }
                if (!preserve.service_accounts) {
                  org.serviceAccounts = []
                }

              }
              callback(err, org)

            })

          },

          accounts: callback => {

            if (preserve.accounts) {
              return callback()
            }

            const find = { org: ac.orgId, object: 'account', reap: false }
            if (preserve.administrators) {
              find.roles = acl.OrgAdminRole
            } else {
              find._id = ac.org.creator._id
            }

            models.account.find(find).lean().exec((err, accounts) => {

              if (!err) {

                accounts.forEach(account => {

                  // reset internals
                  account.idx = { v: 0 }
                  account.acl = []
                  account.aclv = 0
                  account.favorites = []
                  if (!preserve.roles) {
                    account.roles = account.roles.filter(id => utils.inIdArray(builtinRoleIds, id))
                  }

                  // remove custom properties and facets
                  if (!preserve.objects) {
                    Object.keys(account).forEach(key => {
                      if (key.indexOf('c_') === 0 || ~key.indexOf('__')) {
                        delete account[key]
                      }
                    })
                    account.facets = utils.array(account.facets).filter(facet => {
                      return facet && facet._fp === 'image'
                    })
                  }
                })
              }
              callback(err, accounts.length > 0 ? accounts : null)

            })

          }

        }, (err, data) => {
          if (err || !data?.org) {
            return callback(err)
          }
          refreshData = data || {}
          modules.deployment.zipPayload(data, (err, data) => {
            if (err) {
              return callback(err)
            }
            models.blob.create({
              org: ac.orgId,
              label: 'Refresh Data',
              expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 10)), // 10 days.
              data: data
            }, (err, blob) => {
              if (!err) {
                refreshBlob = blob
              }
              callback(err)
            })
          })

        })

      },

      // 4. find object collections so we know what to remove.
      callback => {

        models.object.collection.find({ org: ac.orgId }).project({ 'dataset.collection': 1 }).toArray((err, docs) => {
          if (!err) {
            orgCollections = docs.reduce((orgCollections, doc) => {
              if (doc.dataset && doc.dataset.collection && !orgCollections.includes(doc.dataset.collection)) {
                orgCollections.push(doc.dataset.collection)
              }
              return orgCollections
            }, ['contexts', 'history', 'audits', 'oo-definitions', 'oo-data', 'signatures', 'events'])
          }
          callback(err)
        })

      },

      // 5. makes changes, deleting all org related-data.
      callback => {

        async.parallel([
          callback => {
            models.callback.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            models.connection.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },

          // @todo when we split out org into its own collection, we will have to do this.
          // callback => {models.org.collection.deleteOne({_id: ac.orgId}, err => callback())},
          callback => {

            async.each(orgCollections, (collectionName, callback) => {

              modules.db.connection.db.collection(collectionName, (err, collection) => {
                if (err) {
                  return callback()
                }
                const filter = { org: ac.orgId }
                if (collectionName === 'contexts') {
                  const keep = []
                  if (preserve.accounts) keep.push('account')
                  if (preserve.scripts) keep.push('script')
                  if (preserve.views) keep.push('view')
                  if (preserve.deployments) keep.push('deployment')
                  if (preserve.exports) keep.push('export')
                  if (keep.length) filter.object = { $nin: keep }
                }
                collection.deleteMany(filter, () => {
                  callback()
                })
              })

            }, () => callback())

          },
          async() => {
            try {
              if (!preserve.scripts) {
                await modules.workers.unscheduleAllJobs(ac.org)
              }
            } catch (err) {
              void err
            }
          },
          callback => {
            models.notification.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            if (preserve.objects) {
              return callback()
            }
            models.object.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            if (preserve.accounts) {
              return callback()
            }
            const filter = { org: ac.orgId }
            if (refreshData.accounts) {
              filter.accountId = { $nin: refreshData.accounts.map(v => v._id) }
            }
            models.location.collection.deleteMany(filter, () => {
              callback()
            })
          },
          callback => {
            if (preserve.tokens) {
              return callback()
            }
            models.token.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            models.post.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          /* just let these timeout and continue if they belong to remaining accounts
                    callback => {
                        models.session.collection.deleteMany({orgId: ac.orgId}, err => {
                            callback();
                        });
                    },
                    */
          callback => {
            models.transaction.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            if (preserve.cache) {
              return callback()
            }
            models.cache.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            if (preserve.config) {
              return callback()
            }
            models.config.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          },
          callback => {
            if (preserve.templates) {
              return callback()
            }
            models.template.collection.deleteMany({ org: ac.orgId }, () => {
              callback()
            })
          }
        ], callback)

      },

      // 6. put back org and account(s).
      callback => {
        async.parallel([
          callback => {
            if (isEphemeral || !refreshData.org) {
              return callback()
            }
            models.org.collection.insertOne(refreshData.org, callback)
          },
          callback => {
            if (preserve.accounts || isEphemeral || !refreshData.accounts) {
              return callback()
            }
            models.account.collection.insertMany(refreshData.accounts, callback)
          }
        ], callback)
      },

      // 7. re-install templates?
      callback => {
        if (preserve.templates || isEphemeral) {
          return callback()
        }
        models.template.installOrgTemplates(ac.orgId, { overwrite: true }, function(err) {
          callback(err)
        })
      },

      // 8. cleanse aws media
      // @todo implement for all storage pointer types.
      callback => {

        // - keep org facets
        // - keep account facets (if storing accounts). otherwise, only keep those where that account ids match.
        //      if preserve.objects is true, also keep all account facets.
        // - keep exports if preserving exports.
        // - note: scripts, views and deployments have no facets.

        const keyPrefix = ac.orgId + '/',
              limit = 500,
              orgObjectId = consts.NativeIds.org.toString(),
              exportObjectId = consts.NativeIds.export.toString(),
              accountObjectId = consts.NativeIds.account.toString()

        let hasMore = true,
            nextMarker = null

        async.whilst(

          () => hasMore,

          callback => {

            async.retry({
              times: 5,
              interval: function(retryCount) {
                return 50 * Math.pow(2, retryCount)
              }
            },
            callback => {

              const params = {
                Marker: nextMarker,
                MaxKeys: limit,
                Prefix: keyPrefix
              }

              modules.aws.getInternalStorageInstance().listObjects(params, callback)

            },
            (err, result) => {
              if (err) {
                return callback(err)
              }
              const keysToDelete = utils.array(result.Contents).map(v => ({ Key: v.Key })).filter(o => {

                const parts = o.Key.replace(keyPrefix, '').split('/'),
                      objectId = parts[0],
                      pos = (parts[1] || '').indexOf('.'),
                      _id = ~pos ? parts[1].slice(0, pos) : parts[1] || '',
                      path = ~pos ? parts[1].slice(pos + 1) : ''

                if (objectId === orgObjectId) {
                  if (preserve.objects) {
                    return false
                  }
                  return path === 'favicon' || path === 'logo'
                } else if (objectId === exportObjectId) {
                  return !preserve.exports
                } else if (objectId === accountObjectId) {
                  const keepId = preserve.accounts || _.find(refreshData.accounts || [], a => a._id.toString() === _id)
                  if (keepId && !isEphemeral) {
                    if (preserve.objects) {
                      return false
                    }
                    return path === 'image'
                  }
                }
                return true

              })

              hasMore = result.Contents.length > 0
              if (hasMore) {
                nextMarker = result.Contents[result.Contents.length - 1].Key
              }

              if (keysToDelete.length === 0) {
                return callback()
              }

              async.retry({
                times: 5,
                interval: function(retryCount) {
                  return 50 * Math.pow(2, retryCount)
                }
              },
              callback => {

                const params = {
                  Delete: {
                    Objects: keysToDelete,
                    Quiet: true
                  }
                }
                modules.aws.getInternalStorageInstance().deleteObjects(params, callback)

              },
              callback
              )

            })

          },

          err => callback(err)

        )

      }

    ], err => {

      const done = async() => {
        if (unsetInProgress && !isEphemeral) {
          modules.db.sequencedUpdate(models.org, { _id: ac.orgId, 'deployment.inProgress': true }, { $set: { 'deployment.inProgress': false } }, (err) => {
            void err
          })
        }
        // Add audit record only to medable org.
        if (!err && utils.path(refreshData, 'org.configuration.ephemeral')) {
          const medableOrg = await utils.promised(modules.db.models.org, 'loadOrg', 'medable'),
                access = new acl.AccessContext(ap.synthesizeOrgAdmin(medableOrg), null, { req: utils.createId() })
          modules.audit.recordEvent(access, 'configuration', 'delete', {
            context: {
              object: 'org',
              _id: ac.org._id
            },
            metadata: {
              code: ac.org.code
            }
          }, (err, eventId) => {
            callback(err)
          })
        } else {
          callback()
        }

      }

      if (err) {
        err = Fault.from(err, false, true)
        modules.deployment.logError(ac, payload.sourceId, err)
      } else {
        removeBlob(refreshBlob)
        modules.deployment.log(ac, payload.sourceId, 'Refresh completed.')
      }
      done()
    })

  })

}

module.exports = OrgRefresherWorker
