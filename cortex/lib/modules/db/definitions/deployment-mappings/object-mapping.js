'use strict'

const utils = require('../../../../utils'),
      BaseMapping = require('../base-mapping-definition'),
      async = require('async'),
      consts = require('../../../../consts'),
      ap = require('../../../../access-principal'),
      acl = require('../../../../acl'),
      clone = require('clone'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      _ = require('underscore')

class DeferredPropertyWrite {

  constructor(property, key, value) {
    this.property = property
    this.key = key
    this.value = value
  }

  handle(ac, principal, callback) {

    const parts = [...modules.db.definitions.getFullyMaterializedPropertyPathParts(this.property, this.property.schema.node, false), this.key],
          objectId = parts[1],
          fullPath = parts.slice(2).join('.')

    modules.db.models.Object.aclUpdatePath(principal, objectId, fullPath, this.value, { req: ac.req, method: 'put' }, callback)

  }

}

class Mapping extends BaseMapping {

  get mappingTypeName() {
    return consts.deployment.mapping.types.object
  }

  rollback(ac, backup, data, callback) {

    // @todo update affected indexes.

    async.parallel([

      // org.objects
      callback => {
        modules.db.models.Org.collection.updateOne({ _id: ac.orgId }, { $set: { objects: data.orgObjects } }, { writeConcern: { w: 'majority' } }, callback)
      },

      // objects
      callback => {
        modules.db.models.Object.deleteMany({ org: ac.orgId, object: 'object' }).exec(err => {
          if (err) return callback(err)
          async.eachSeries(
            data.objects,
            (doc, callback) => {
              modules.db.models.Object.collection.insertOne(doc, { writeConcern: { w: 'majority' } }, callback)
            },
            callback
          )
        })
      }

    ], callback)
  }

  createBackup(ac, callback) {

    async.parallel({
      orgObjects: callback => {
        modules.db.models.Org.findOne({ org: ac.orgId, object: 'org' }).select('objects').lean().exec((err, doc) => {
          callback(err, utils.path(doc, 'objects'))
        })
      },
      objects: callback => {
        modules.db.models.Object.find({ org: ac.orgId, object: 'object' }).lean().exec(callback)
      }
    }, callback)

  }

  validateForTarget(ac, deploymentObject, mappingConfig, filteredMappings, callback) {
    callback()
  }

  deploy(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    const Obj = modules.db.models.Object

    // register hook to perform index updates if the deployment is successful. if the deployment fails,
    // the index updates just get dropped and the old objects get written back to the db, effectively reverting without slot updates.
    ac.hook('deploy').after(vars => utils.array(vars.ac.option('$deploymentDeferredIndexUpdates')).forEach(fn => fn()))

    async.waterfall([

      // load a fresh org for the roles we need.
      callback => {
        modules.db.models.Org.loadOrg(ac.orgId, { cache: false }, callback)
      },

      // load a fresh principal
      (org, callback) => {
        ap.create(org, ac.principal.email, (err, principal) => {
          callback(err, principal)
        })
      },

      // load fresh objects
      (principal, callback) => {
        Obj.find({ org: ac.orgId, object: 'object' }).exec((err, existing) => {
          callback(err, principal, existing)
        })
      },

      // create/update each missing object in order to satisfy sourceObject references in the second pass.
      (principal, existing, callback) => {

        async.eachSeries(filteredMappings.filter(m => m.source.concrete), (mapping, callback) => {

          let targetId = mapping.target,
              create = utils.equalIds(targetId, consts.emptyId),
              source = mapping.get('payload'),
              payload = clone(source),
              target = create ? null : utils.findIdInArray(existing, 'lookup', targetId),
              objectAc,
              paths

          if (!create && !target && !~consts.NativeIdsReverseLookup[targetId]) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target object: ' + mapping.source.label }))
          }

          if (!target) {
            create = true
            target = new Obj()
            target.org = ac.orgId
            target.object = Obj.objectName
            target.did = [source._id]
            target.dataset.collection = utils.rString(utils.path(source, 'dataset.collection'), 'contexts')
          } else {
            target.did.addToSet(source._id)
          }

          target.creator = { _id: ac.principalId }
          target.owner = { _id: ac.principalId }
          target.updater = source.updater ? { _id: ac.principalId } : undefined
          target.updated = source.updated
          target.created = source.created

          // map principals
          payload.defaultAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.defaultAcl, false)
          payload.createAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.createAcl, true)
          payload.shareAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, payload.shareAcl, false)

          objectAc = new acl.AccessContext(principal, target, { method: create ? 'post' : 'put', req: ac.req, grant: acl.AccessLevels.System })
          paths = 'localized label description active defaultAcl createAcl shareAcl hasETag isVersioned isUnmanaged shareChain allowConnections connectionOptions'.split(' ')

          objectAc.option('sandbox.logger.source', consts.logs.sources.deployment)
          objectAc.option('deferSyncEnvironment', true)

          if (create) {
            paths.push('name')
          }
          payload = _.pick(payload, paths)

          target.aclWrite(objectAc, payload, err => {
            if (err) {
              callback(err)
            } else {
              objectAc.save(err => {
                if (!err && create) {
                  mapping.target = target.lookup // update the mapping so the property phase finds the correct object.
                }
                callback(err)
              })
            }
          })

        }, err => {
          callback(err, principal)
        })

      },

      // load fresh objects (they should now all exist)
      (principal, callback) => {
        Obj.find({ org: ac.orgId, object: 'object' }).exec((err, existing) => {
          callback(err, principal, existing)
        })
      },

      // update each object's properties and feed definition
      (principal, existing, callback) => {

        const deferred = [],
              localeMappings = {
                properties: [],
                objectTypes: []
              }

        async.eachSeries(filteredMappings.filter(m => m.source.concrete), (mapping, callback) => {

          let payload = mapping.get('payload'),
              target = utils.findIdInArray(existing, 'lookup', mapping.target),
              objectAc = new acl.AccessContext(principal, target, { req: ac.req }),
              ObjectTypes = Obj.schema.node.properties.properties.documents,
              // write each property individually
              addLocaleMapping = (maps, prop) => {
                maps && maps.push({ _id: prop._id, did: prop.did[0] })
              },
              writeProperties = (properties, container, containerNode, localesMaps, callback) => {

                setImmediate(() => {

                  async.eachSeries(properties, (source, callback) => {

                    // find the property by did and then by name, and update of create.
                    const property = _.find(container.properties, p => utils.inIdArray(p.did, source._id)) || _.find(container.properties, p => p.name === source.name),
                          create = !property,
                          node = ObjectTypes[source.type],
                          // collect writable properties on the type node (Any, Boolean, etc).
                          keys = Object.keys(node.properties).filter(name => {
                            const n = node.properties[name]
                            return name !== 'documents' && name !== 'properties' && n.readable && n.isWritable() && (!n.creatable || create)
                          }),
                          payload = _.pick(source, keys),
                          deferredValues = {}

                    if (property) {
                      // ensure creatable properties are respected
                      if (property.name !== source.name) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Property name mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type !== source.type) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Property type mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.array !== source.array) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Property array mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type === 'Reference' && property.sourceObject !== source.sourceObject) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Reference property sourceObject mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type === 'ObjectId' && property.sourceObject !== source.sourceObject) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'ObjectId property sourceObject mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type === 'List' && property.sourceObject !== source.sourceObject) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'List property sourceObject mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type === 'List' && property.linkedProperty && property.linkedProperty !== source.linkedProperty) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'List property linkedProperty mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      } else if (property.type === 'List') {
                        const hash = (v) => v.map(v => v.source + ':' + v.target).sort().join(',')
                        if (hash(property.linkedReferences) !== hash(source.linkedReferences)) {
                          return callback(Fault.create('cortex.notFound.unspecified', { reason: 'List property linkedReferences mismatch: ' + mapping.source.label + ' - ' + property.name }))
                        }
                      } else if (property.type === 'Geometry' && (property.geoType !== source.geoType)) {
                        return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Geometry property geoType mismatch: ' + mapping.source.label + ' - ' + property.name }))
                      }
                    }

                    payload.acl = this.mapAclToTarget(principal.org, deploymentObject.mappings, source.acl)
                    if (source.type === 'Reference') {
                      payload.pacl = this.mapAclToTarget(principal.org, deploymentObject.mappings, source.pacl)
                      payload.roles = this.mapRolesToTarget(principal.org, deploymentObject.mappings, source.roles)
                      payload.defaultAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, source.defaultAcl, false)
                    } else if (source.type === 'List') {
                      payload.defaultAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, source.defaultAcl, false)
                      payload.createAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, source.createAcl, true)
                      payload.roles = this.mapRolesToTarget(principal.org, deploymentObject.mappings, source.roles)
                    } else if (source.type === 'String') {
                      utils.path(
                        payload,
                        'localization.acl',
                        this.mapAclToTarget(principal.org, deploymentObject.mappings, utils.path(source, 'localization.acl'))
                      )
                    }

                    utils.walk(payload, true, true, function(obj, currentKey) {
                      if (currentKey === '_id') {
                        return undefined
                      }
                      return obj
                    })

                    payload._id = create ? undefined : property._id

                    // @todo load node and check for writable properties generically.
                    if (source.type === 'File') {
                      const processors = payload.processors
                      processors.forEach(processor => {
                        delete processor.location // sys writable only.
                        delete processor.storageId // sys writable only, for now.
                        delete processor.skipVirusScan // sys writable only, for now.
                        if (processor.type === 'overlay') {
                          delete process.passMimes
                        }
                      })
                    } else if (source.type === 'Reference') {
                      if (payload.paths.length > 0) {
                        deferredValues.paths = payload.paths
                        payload.paths = []
                      }
                    } else if (source.type === 'List') {
                      if (payload.linkedProperty) {
                        deferredValues.linkedProperty = payload.linkedProperty
                        payload.linkedProperty = ''
                      }
                      if (payload.linkedReferences) {
                        deferredValues.linkedReferences = payload.linkedReferences
                        payload.linkedReferences = []
                      }
                      if (payload.where) {
                        deferredValues.where = payload.where
                        payload.where = ''
                      }
                    }

                    objectAc.method = create ? 'post' : 'put'
                    containerNode.aclWrite(objectAc, container, [payload], err => {

                      let property
                      if (!err) {
                        property = _.find(container.properties, p => utils.inIdArray(p.did, source._id)) || _.find(container.properties, p => p.name === source.name)
                        if (!property) {
                          err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing document property: ' + mapping.source.label + ' - ' + source.name })
                        } else {
                          property.did.addToSet(source._id)
                        }
                      }
                      if (!err) {
                        Object.keys(deferredValues).forEach(key => {
                          deferred.push(new DeferredPropertyWrite(
                            property,
                            key,
                            deferredValues[key]
                          ))
                        })
                        addLocaleMapping(localesMaps, property)
                      }

                      if (err) {
                        callback(err)
                      } else if (source.type === 'Document') {
                        writeProperties(source.properties, property, property.schema.node.properties.properties, localesMaps, callback)

                      } else if (source.type === 'Set') {

                        async.eachSeries(source.documents, (setdoc, callback) => {

                          const docProp = _.find(property.documents, p => utils.inIdArray(p.did, setdoc._id)) || _.find(property.documents, p => p.name === setdoc.name),
                                docPayload = _.pick(setdoc, 'label name minRequired maxAllowed'.split(' '))

                          objectAc.method = docProp ? 'put' : 'post'
                          docPayload._id = docProp ? docProp._id : undefined

                          property.schema.node.properties.documents.aclWrite(objectAc, property, [docPayload], err => {

                            let docProp
                            if (!err) {
                              docProp = _.find(property.documents, p => utils.inIdArray(p.did, setdoc._id)) || _.find(property.documents, p => p.name === setdoc.name)
                              if (!docProp) {
                                err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing set document: ' + mapping.source.label + ' - ' + source.name })
                              } else {
                                docProp.did.addToSet(setdoc._id)
                              }
                            }

                            if (err) {
                              return callback(err)
                            }
                            addLocaleMapping(localesMaps, docProp)
                            writeProperties(setdoc.properties, docProp, docProp.schema.node.properties.properties, localesMaps, callback)
                          })

                        }, callback)

                      } else {

                        callback()
                      }

                    })

                  }, callback)

                })

              }

          if (!target) {
            return callback(Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping target object: ' + mapping.source.label }))
          }

          // ac.hook('save').after... hijack indexer updates and save until after the deployment completes.
          objectAc.hook('save').intercept('after', function(inline, fn, taskId) {
            if (taskId.indexOf('after.$idxUpdates') === 0) {
              return function(vars) {
                let updates = ac.option('$deploymentDeferredIndexUpdates')
                if (!updates) {
                  updates = []
                  ac.option('$deploymentDeferredIndexUpdates', updates)
                }
                updates.push(fn.bind(this, vars))
              }
            }
            return fn
          })

          async.series([

            // properties
            callback => {
              writeProperties(payload.properties, target, target.schema.node.properties.properties, localeMappings.properties, callback)
            },

            // object types and properties
            callback => {

              async.eachSeries(payload.objectTypes, (source, callback) => {

                // create/update object type
                const typeDef = _.find(target.objectTypes, p => utils.inIdArray(p.did, source._id)) || _.find(target.objectTypes, p => p.name === source.name),
                      typePayload = _.pick(source, 'label name'.split(' '))

                objectAc.method = typeDef ? 'put' : 'post'
                if (typeDef) {
                  typePayload._id = typeDef._id
                }

                target.aclWrite(objectAc, { objectTypes: [typePayload] }, err => {

                  let typeDef
                  if (!err) {
                    typeDef = _.find(target.objectTypes, p => utils.inIdArray(p.did, source._id)) || _.find(target.objectTypes, p => p.name === source.name)
                    if (!typeDef) {
                      err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing document typeDef: ' + mapping.source.label + ' - ' + source.name })
                    } else {
                      typeDef.did.addToSet(source._id)
                    }
                  }
                  if (err) {
                    return callback(err)
                  }

                  addLocaleMapping(localeMappings.objectTypes, typeDef)
                  writeProperties(source.properties, typeDef, typeDef.schema.node.properties.properties, localeMappings.objectTypes, callback)

                })

              }, callback)

            },

            // feed definitions and properties.
            callback => {

              async.eachSeries(payload.feedDefinition, (source, callback) => {

                // create/update feed definition
                const feedDef = _.find(target.feedDefinition, p => utils.inIdArray(p.did, source._id)) || _.find(target.feedDefinition, p => p.postType === source.postType),
                      feedPayload = _.pick(source, 'label contextReadAccess contextCreateAccess active postType minItems maxItems allowComments minCommentItems maxCommentItems notifications trackViews editable deletable contextReadAcl postCreateAcl postInstanceAcl'.split(' '))

                feedPayload.contextReadAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, feedPayload.contextReadAcl)
                feedPayload.postCreateAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, feedPayload.postCreateAcl)
                feedPayload.postInstanceAcl = this.mapAclToTarget(principal.org, deploymentObject.mappings, feedPayload.postInstanceAcl)

                objectAc.method = feedDef ? 'put' : 'post'
                if (feedDef) {
                  feedPayload._id = feedDef._id
                }

                target.aclWrite(objectAc, { feedDefinition: [feedPayload] }, err => {

                  let feedDef
                  if (!err) {
                    feedDef = _.find(target.feedDefinition, p => utils.inIdArray(p.did, source._id)) || _.find(target.feedDefinition, p => p.postType === source.postType)
                    if (!feedDef) {
                      err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing document feedDef: ' + mapping.source.label + ' - ' + source.postType })
                    } else {
                      feedDef.did.addToSet(source._id)
                    }
                  }
                  if (err) {
                    return callback(err)
                  }

                  // create/update feed segments (body, comments)
                  async.eachSeries(['body', 'comments'], (propName, callback) => {

                    async.eachSeries(source[propName], (source, callback) => {

                      const segmentDef = _.find(feedDef[propName], p => utils.inIdArray(p.did, source._id)) || _.find(feedDef[propName], p => p.name === source.name),
                            segmentPayload = _.pick(source, 'label name minRequired maxAllowed'.split(' '))

                      objectAc.method = segmentDef ? 'put' : 'post'
                      if (segmentDef) {
                        segmentPayload._id = segmentDef._id
                      }

                      feedDef.schema.node.properties[propName].aclWrite(objectAc, feedDef, [segmentPayload], err => {

                        let segmentDef
                        if (!err) {
                          segmentDef = _.find(feedDef[propName], p => utils.inIdArray(p.did, source._id)) || _.find(feedDef[propName], p => p.name === source.name)
                          if (!segmentDef) {
                            err = Fault.create('cortex.notFound.unspecified', { reason: 'Missing document segmentDef: ' + mapping.source.label + ' - ' + source.name })
                          } else {
                            segmentDef.did.addToSet(source._id)
                          }
                        }
                        if (err) {
                          return callback(err)
                        }

                        // create/update segment properties.
                        writeProperties(source.properties, segmentDef, segmentDef.schema.node.properties.properties, null, callback)

                      })

                    }, callback)

                  }, callback)

                })

              }, callback)

            },

            // Prepare locales
            callback => {
              if (payload.localized !== false && payload.locales) {
                // Iterate over locale mappings and replace _ids of locales with properties ids.
                const replaceIdInLocales = (locales, newProp) => {
                  const items = Array.isArray(locales) ? locales : Object.keys(locales).map(k => locales[k])
                  for (let i = 0; i < items.length; i++) {
                    const prop = items[i]
                    if (Array.isArray(prop)) {
                      if (prop.length) {
                        replaceIdInLocales(prop, newProp)
                      }
                    } else if (utils.isPlainObject(prop)) {
                      if (utils.equalIds(prop._id, newProp.did)) {
                        prop._id = newProp._id
                      }
                      if (prop.value) {
                        delete prop._id
                      } else {
                        replaceIdInLocales(prop, newProp)
                      }
                    }
                  }
                }
                // replace properties
                localeMappings.properties.forEach((newProp) => {
                  if (payload.locales.properties) {
                    replaceIdInLocales(payload.locales.properties, newProp)
                  }
                })
                // replace properties
                localeMappings.objectTypes.forEach((newProp) => {
                  if (payload.locales.objectTypes) {
                    replaceIdInLocales(payload.locales.objectTypes, newProp)
                  }
                })
                // Delete _ids of top level props
                payload.locales.label.forEach(l => {
                  delete l._id
                })
                payload.locales.description.forEach(l => {
                  delete l._id
                })
              }

              callback()
            },

            // write deferred top-level properties.
            callback => {
              if (payload.localized !== false && payload.locales) {
                target.locales = payload.locales
              }
              objectAc.method = 'put'
              target.aclWrite(objectAc, {
                uniqueKey: payload.uniqueKey
              }, callback)

            },

            callback => {
              objectAc.save(callback)
            }

          ], callback)

        }, err => {
          callback(err, principal, deferred)
        })

      },

      // process deferred reference path updates. now that all the paths exist, it's just a matter of updating them.
      (principal, deferred, callback) => {
        // we should be able to successfully deploy something like two.c_ref -> one.c_foo and one.c_foo ->two.c_ref

        deferred.sort(function(a, b) {

          if (a.property.type === 'Reference') {
            if (b.property.type === 'List') {
              return -1
            }
          } else if (b.property.type === 'Reference') {
            if (a.property.type === 'List') {
              return 1
            }
          }
          return 0
        })

        async.eachSeries(deferred, (deferred, callback) => {
          deferred.handle(ac, principal, callback)
        }, callback)

      }

    ], callback)

  }

  getDependencies(ac, doc) {

    const dependencies = {},
          addProperties = (properties, repeat) => {
            utils.array(properties).forEach(property => {
              this._addAclDependencies(property.acl, dependencies)
              if (property.type === 'Reference') {
                dependencies[modules.db.definitions.cachedObjectNameToId(ac.org, property.sourceObject)] = consts.deployment.mapping.types.object
                this._addAclDependencies(property.defaultAcl, dependencies)
                this._addAclDependencies(property.pacl, dependencies)
                this._addRoleDependencies(property.roles, dependencies)
              } else if (property.type === 'ObjectId') {
                if (property.sourceObject) {
                  dependencies[modules.db.definitions.cachedObjectNameToId(ac.org, property.sourceObject)] = consts.deployment.mapping.types.object
                }
              } else if (property.type === 'List') {
                dependencies[modules.db.definitions.cachedObjectNameToId(ac.org, property.sourceObject)] = consts.deployment.mapping.types.object
                this._addAclDependencies(property.defaultAcl, dependencies)
                this._addAclDependencies(property.createAcl, dependencies)
                this._addRoleDependencies(property.roles, dependencies)
              } else if (property.type === 'String') {
                this._addAclDependencies(utils.path(property, 'localization.acl'), dependencies)
              }
              if (repeat) {
                addProperties(property.properties, false)
              }
            })
          }

    this._addAclDependencies(doc.defaultAcl, dependencies)
    this._addAclDependencies(doc.createAcl, dependencies)
    this._addAclDependencies(doc.shareAcl, dependencies)
    addProperties(doc.properties, true)
    utils.array(doc.feedDefinition).forEach(feed => {
      this._addAclDependencies(feed.contextReadAcl, dependencies)
      this._addAclDependencies(feed.postCreateAcl, dependencies)
      this._addAclDependencies(feed.postInstanceAcl, dependencies)
      addProperties(utils.path(feed.body, 'properties'), true)
      addProperties(utils.path(feed.comments, 'properties'), true)
    })
    utils.array(doc.objectTypes).forEach(typeDoc => {
      addProperties(utils.path(typeDoc, 'properties'), true)
    })

    return _.map(dependencies, (type, _id) => ({ _id: utils.getIdOrNull(_id), type: type }))

  }

  updateMapping(ac, mappings, mapping, doc) {

    mapping.lookup = doc.lookup
    mapping.name = doc.name
    mapping.label = doc.label
    mapping.properties = doc.properties
    mapping.feedDefinition = doc.feedDefinition
    mapping.objectTypes = doc.objectTypes
    mapping.concrete = doc.concrete
  }

  matchSourceMappings(ac, deploymentObject, filteredMappings, callback) {

    const addTarget = (mapping, match, type) => {
      if (!utils.findIdInArray(mapping.targets, 'lookup', match.lookup)) {
        mapping.targets.push(utils.extend({ matchType: type }, match))
      }
    }

    this.getSourceMappingDocs(ac, { _id: [], select: 0 }, (err, docs) => {

      if (!err) {

        filteredMappings.forEach(mapping => {
          mapping.targets.splice(0)
          docs.filter(doc => utils.inIdArray(doc.did, mapping._id)).forEach(match => {
            addTarget(mapping, match, 'Identifier')
          })
          docs.filter(doc => doc.name === mapping.source.name).forEach(match => {
            addTarget(mapping, match, 'Name')
          })
          if (!mapping.source.concrete && mapping.targets.length === 1) {
            mapping.target = mapping.targets[0].lookup
          }
        })
      }
      callback(err)
    })

  }

  getDeploymentPayload(ac, deploymentObject, mappingConfig, filteredMappings, callback) {

    const lookupIds = filteredMappings.map(mapping => mapping.source.lookup)
    if (lookupIds.length === 0) {
      return callback()
    }

    modules.db.models.Object.aclList(ac.principal, { allowSystemAccessToParserProperties: true, skipParserIndexChecks: true, relaxParserLimits: true, limit: false, allowNoLimit: true, where: { lookup: { $in: lookupIds } }, skipAcl: true, json: true, grant: acl.AccessLevels.System, req: ac.req, include: 'locales' }, (err, objects) => {

      if (!err) {
        try {
          filteredMappings.forEach(mapping => {
            if (mapping.source.concrete) {
              const object = utils.findIdInArray(objects.data, 'lookup', mapping.source.lookup)
              if (!object) {
                throw Fault.create('cortex.notFound.unspecified', { reason: 'Missing mapping source object: ' + mapping.source.label })
              }
              mapping.payload = object
            }
          })
        } catch (e) {
          err = e
        }
      }
      callback(err)
    })

  }

  getSourceMappingDocs(ac, configuration, callback) {

    this.getSelectedDocsForObject(ac, 'Object', configuration, { paths: Mapping.selectionPaths, idField: 'lookup', find: { reap: false } }, (err, docs) => {

      if (!err) {

        docs.forEach(doc => {
          doc.concrete = true
        })

        // load up any missing required built-in objects that do not have extensions.
        let defs = modules.db.definitions.builtInObjectDefs
        switch (configuration.select) {
          case consts.deployment.selections.all:
            break
          case consts.deployment.selections.include:
            defs = defs.filter(def => utils.inIdArray(configuration.ids, def.objectId))
            break
          case consts.deployment.selections.exclude:
            defs = defs.filter(def => !utils.inIdArray(configuration.ids, def.objectId))
            break
          case consts.deployment.selections.none:
          default:
            defs = []
            break
        }

        // add missing defs to docs.
        defs.forEach(def => {
          if (!_.find(docs, doc => utils.equalIds(def.objectId, doc.lookup))) {
            docs.push({
              _id: def.objectId,
              lookup: def.objectId,
              name: def.objectName,
              label: def.objectLabel,
              properties: [],
              objectTypes: [],
              feedDefinition: [],
              concrete: false
            })
          }
        })
      }
      callback(err, docs)

    })
  }

  // note: sets are not exposed so we don't need to load 'documents'
  static get selectionPaths() {
    return [
      'localized',
      'did',
      'lookup',
      'name',
      'label',
      'defaultAcl',
      'createAcl',
      'shareAcl',
      'dataset',
      'locales',
      'feedDefinition._id',
      'feedDefinition.postType',
      'feedDefinition.label',
      'feedDefinition.contextReadAcl',
      'feedDefinition.postCreateAcl',
      'feedDefinition.postInstanceAcl',
      'feedDefinition.body._id',
      'feedDefinition.body.name',
      'feedDefinition.body.label',
      'feedDefinition.comments._id',
      'feedDefinition.comments.name',
      'feedDefinition.comments.label',
      'properties._id',
      'properties.acl',
      'properties.localization.acl',
      'properties.type',
      'properties.array',
      'properties.name',
      'properties.label',
      'properties.sourceObject',
      'properties.defaultAcl',
      'properties.createAcl',
      'properties.shareAcl',
      'properties.geoType',
      'properties.pacl',
      'properties.roles',
      'properties.properties._id',
      'properties.properties.acl',
      'properties.properties.localization.acl',
      'properties.properties.type',
      'properties.properties.array',
      'properties.properties.name',
      'properties.properties.label',
      'properties.properties.sourceObject',
      'properties.properties.defaultAcl',
      'properties.properties.createAcl',
      'properties.properties.shareAcl',
      'properties.properties.geoType',
      'properties.properties.pacl',
      'properties.properties.roles',
      'objectTypes.properties._id',
      'objectTypes.properties.acl',
      'objectTypes.properties.localization.acl',
      'objectTypes.properties.type',
      'objectTypes.properties.array',
      'objectTypes.properties.name',
      'objectTypes.properties.label',
      'objectTypes.properties.sourceObject',
      'objectTypes.properties.defaultAcl',
      'objectTypes.properties.createAcl',
      'objectTypes.properties.shareAcl',
      'objectTypes.properties.geoType',
      'objectTypes.properties.pacl',
      'objectTypes.properties.roles',
      'objectTypes.properties.properties._id',
      'objectTypes.properties.properties.acl',
      'objectTypes.properties.properties.localization.acl',
      'objectTypes.properties.properties.type',
      'objectTypes.properties.properties.array',
      'objectTypes.properties.properties.name',
      'objectTypes.properties.properties.label',
      'objectTypes.properties.properties.sourceObject',
      'objectTypes.properties.properties.defaultAcl',
      'objectTypes.properties.properties.createAcl',
      'objectTypes.properties.properties.shareAcl',
      'objectTypes.properties.properties.geoType',
      'objectTypes.properties.properties.pacl',
      'objectTypes.properties.properties.roles',
      'feedDefinition.body.properties._id',
      'feedDefinition.body.properties.acl',
      'feedDefinition.body.properties.localization.acl',
      'feedDefinition.body.properties.type',
      'feedDefinition.body.properties.array',
      'feedDefinition.body.properties.name',
      'feedDefinition.body.properties.label',
      'feedDefinition.body.properties.sourceObject',
      'feedDefinition.body.properties.defaultAcl',
      'feedDefinition.body.properties.createAcl',
      'feedDefinition.body.properties.shareAcl',
      'feedDefinition.body.properties.geoType',
      'feedDefinition.body.properties.pacl',
      'feedDefinition.body.properties.roles',
      'feedDefinition.body.properties.properties._id',
      'feedDefinition.body.properties.properties.acl',
      'feedDefinition.body.properties.properties.localization.acl',
      'feedDefinition.body.properties.properties.type',
      'feedDefinition.body.properties.properties.array',
      'feedDefinition.body.properties.properties.name',
      'feedDefinition.body.properties.properties.label',
      'feedDefinition.body.properties.properties.sourceObject',
      'feedDefinition.body.properties.properties.defaultAcl',
      'feedDefinition.body.properties.properties.createAcl',
      'feedDefinition.body.properties.properties.shareAcl',
      'feedDefinition.body.properties.properties.geoType',
      'feedDefinition.body.properties.properties.pacl',
      'feedDefinition.body.properties.properties.roles',
      'feedDefinition.comments.properties._id',
      'feedDefinition.comments.properties.acl',
      'feedDefinition.comments.properties.localization.acl',
      'feedDefinition.comments.properties.type',
      'feedDefinition.comments.properties.array',
      'feedDefinition.comments.properties.name',
      'feedDefinition.comments.properties.label',
      'feedDefinition.comments.properties.sourceObject',
      'feedDefinition.comments.properties.defaultAcl',
      'feedDefinition.comments.properties.createAcl',
      'feedDefinition.comments.properties.shareAcl',
      'feedDefinition.comments.properties.geoType',
      'feedDefinition.comments.properties.pacl',
      'feedDefinition.comments.properties.roles',
      'feedDefinition.comments.properties.properties._id',
      'feedDefinition.comments.properties.properties.acl',
      'feedDefinition.comments.properties.properties.localization.acl',
      'feedDefinition.comments.properties.properties.type',
      'feedDefinition.comments.properties.properties.array',
      'feedDefinition.comments.properties.properties.name',
      'feedDefinition.comments.properties.properties.label',
      'feedDefinition.comments.properties.properties.sourceObject',
      'feedDefinition.comments.properties.properties.defaultAcl',
      'feedDefinition.comments.properties.properties.createAcl',
      'feedDefinition.comments.properties.properties.shareAcl',
      'feedDefinition.comments.properties.properties.geoType',
      'feedDefinition.comments.properties.properties.pacl',
      'feedDefinition.comments.properties.properties.roles'
    ]
  }

  // ----------------------------------------------------------------------------------

  // @todo. maybe don't need all this junk?
  static getProperties() {
    return [{
      label: 'Lookup',
      name: 'lookup',
      type: 'ObjectId'
    }, {
      label: 'Label',
      name: 'label',
      type: 'String'
    }, {
      label: 'Name',
      name: 'name',
      type: 'String'
    }, {
      label: 'Concrete',
      name: 'concrete',
      type: 'Boolean'
    }, {
      label: 'Properties',
      name: 'properties',
      type: 'Set',
      array: true,
      discriminatorKey: 'type',
      uniqueProp: 'name',
      documents: modules.db.definitions.createSetMappingProperties(1)
    }, {
      label: 'Object Types',
      name: 'objectTypes',
      type: 'Document',
      array: true,
      properties: [{
        label: 'Identifier',
        name: '_id',
        type: 'ObjectId'
      }, {
        label: 'Label',
        name: 'label',
        type: 'String'
      }, {
        label: 'Name',
        name: 'name',
        type: 'String'
      }, {
        label: 'Properties',
        name: 'properties',
        type: 'Set',
        array: true,
        discriminatorKey: 'type',
        uniqueProp: 'name',
        documents: modules.db.definitions.createSetMappingProperties(1)
      }]
    }, {
      label: 'Feed Definition',
      name: 'feedDefinition',
      type: 'Document',
      array: true,
      properties: [{
        label: 'Identifier',
        name: '_id',
        type: 'ObjectId'
      }, {
        label: 'Label',
        name: 'label',
        type: 'String'
      }, {
        label: 'Post Type',
        name: 'postType',
        type: 'String'
      }, {
        label: 'Body',
        name: 'body',
        type: 'Document',
        array: true,
        properties: [{
          label: 'Identifier',
          name: '_id',
          type: 'ObjectId'
        }, {
          label: 'Label',
          name: 'label',
          type: 'String'
        }, {
          label: 'Name',
          name: 'name',
          type: 'String'
        }, {
          label: 'Properties',
          name: 'properties',
          discriminatorKey: 'type',
          uniqueProp: 'name',
          type: 'Set',
          array: true,
          documents: modules.db.definitions.createSetMappingProperties(1)
        }]
      }, {
        label: 'Comments',
        name: 'comments',
        type: 'Document',
        array: true,
        properties: [{
          label: 'Identifier',
          name: '_id',
          type: 'ObjectId'
        }, {
          label: 'Label',
          name: 'label',
          type: 'String'
        }, {
          label: 'Name',
          name: 'name',
          type: 'String'
        }, {
          label: 'Properties',
          name: 'properties',
          discriminatorKey: 'type',
          uniqueProp: 'name',
          type: 'Set',
          array: true,
          documents: modules.db.definitions.createSetMappingProperties(1)
        }]
      }]
    }]
  }

}

module.exports = Mapping
