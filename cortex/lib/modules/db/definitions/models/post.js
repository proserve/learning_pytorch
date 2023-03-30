'use strict'

const util = require('util'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      clone = require('clone'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../../utils'),
      acl = require('../../../../acl'),
      async = require('async'),
      modules = require('../../../../modules'),
      Parser = require('../../../parser/old.posts.and.comments'),
      config = require('cortex-service/lib/config'),
      SelectionTree = require('../classes/selection-tree'),
      ExpansionQueue = require('../classes/expansion-queue'),
      PostDefinition = require('../feeds/post-definition')

function BasePostModel() {

  // the base post model includes a body, but only for loading, prior to branching off to custom post models.
  const feedDoc = {
    body: []
  }

  PostDefinition.call(this, feedDoc)
}
util.inherits(BasePostModel, PostDefinition)

BasePostModel.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = BasePostModel.statics
  options.methods = BasePostModel.methods
  options.indexes = BasePostModel.indexes

  return PostDefinition.prototype.generateMongooseSchema.call(this, options)
}

BasePostModel.statics = {

  /**
     * generate a read access query.
     *
     * @param principal
     * @param models a list of post models to load. these represent the post types.
     * @param options
     *  participants: null. list of post participants. if set, only posts targeted to everyone in the participants list will be read.
     *  skipAcl: false. if true, skips the acl access portion of the query but still looks at participants and targeting.
     *  skipTargeting: false. if true, skips participants and targeting altogether.
     *  customAcl: custom acl to apply INSTEAD of the context object default acl.
     *  contextReadAccess: defaults to each model's context read access.
     *
     * @param callback accessQuery. if accessQuery is null, nothing should be returned.
     */
  accessQuery: function(principal, models, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }
    options = options || {}

    const skipAcl = !!utils.option(options, 'skipAcl', false) || principal.skipAcl

    async.waterfall([

      function(callback) {

        if (models.length === 0) {
          return callback(null, null, models)
        }

        let accessQuery = models.reduce(function(entries, model) {

          let ac = new acl.PostAccessContext(principal, null, { object: model, customAcl: options.customAcl }),
              // create an access query for the post, based on the object's acl. if no query is returned, access is granted for this object.
              contextAccessQuery = skipAcl ? null : principal.accessQuery(ac, model.contextReadAccess, { defaultAcl: options.customAcl || utils.path(ac.object, 'defaultAcl'), defaultAclOverride: true }),
              // a second access query based on the contextReadAcl
              postAccessQuery,
              accessQuery = null,
              entry

          if (!skipAcl && model.contextReadAcl.length > 0) {
            postAccessQuery = principal.accessQuery(ac, model.contextReadAccess, { defaultAcl: model.contextReadAcl, defaultAclOverride: false })
          }

          if (contextAccessQuery) {
            accessQuery = contextAccessQuery
          }
          if (postAccessQuery) {
            accessQuery = accessQuery ? { $and: [accessQuery, postAccessQuery] } : postAccessQuery
          }

          // find or create an object entry.
          entry = _.find(entries, function(entry) {
            return utils.deepEquals(entry.query, accessQuery)
          })
          if (!entry) {
            entry = {
              query: accessQuery,
              objectNames: [ac.objectName],
              postTypes: [model.postType]
            }
            entries.push(entry)
          } else {
            entry.postTypes.push(model.postType)
            if (!utils.inIdArray(entry.objectNames, ac.objectName)) {
              entry.objectNames.push(ac.objectName)
            }
          }

          return entries

        }, []).reduce(function(query, entry) { // convert to query.

          let part = utils.extend({
            'context.object': { $in: entry.objectNames },
            type: { $in: entry.postTypes }
          }, entry.query)

          query.$or.push(part)

          return query

        }, { $or: [] })

        if (accessQuery.$or.length === 0) {
          delete accessQuery.$or
        } if (accessQuery.$or.length === 1) {
          accessQuery = accessQuery.$or[0]
        }

        // for all posts, check for targeting.
        if (!utils.option(options, 'skipTargeting', false)) {
          let participants = utils.option(options, 'participants')

          if (participants != null) {

            participants = utils.getIdArray(participants)
            if (participants.length === 0) {
              callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid participants for feed.' }))
              return
            }

            // for a targeted search, the principal must also have access to the post, and be in the list of participants.
            // since the post creator is always in the list of targets
            let principalParticipantPos = utils.indexOfId(participants, principal._id)
            if (!~principalParticipantPos) {
              participants.push(principal._id)
            }
            accessQuery['targets.1'] = { $exists: true }
            accessQuery['targets.target'] = { $all: participants }

          } else {

            // not looking for targets. find posts that are not targeted or where the caller is the creator.
            // and passively include posts where the caller is targeted by role.
            let nonTargeted = {
              $or: [
                { 'targets.1': { $exists: false } },
                { 'targets.target': { $in: [principal._id].concat(acl.expandRoles(principal.org.roles, principal.roles)) } }
              ]
            }

            if (!accessQuery.$or) {
              accessQuery.$or = nonTargeted.$or
            } else {
              if (!accessQuery.$and) {
                accessQuery = { $and: [accessQuery] }
              }
              accessQuery.$and.push(nonTargeted)
            }
          }

          if (accessQuery.$and && accessQuery.$and.length === 1 && _.isArray(accessQuery.$and[0])) {
            accessQuery.$and = accessQuery.$and[0]
          }
        }

        callback(null, accessQuery)
      }

    ], callback)

  },

  /**
     * loads all post models
     *
     * @param principal
     * @param objects if null, loads all objects.
     * @param postTypes can be an array or a comma-delimited list of strings or post type ids.
     * @param callback err, models
     */
  loadPostModels: function(principal, objects, postTypes, callback) {

    let self = this

    // resolve objects
    objects = objects == null ? principal.org.getObjectNames() : utils.array(objects, true)

    if (objects.length === 0) {
      return callback(null, [])
    }

    async.mapSeries(objects, function(object, callback) {
      if (acl.isObjectModel(object)) {
        callback(null, object)
      } else {
        principal.org.createObject(object, callback)
      }
    }, function(err, objects) {

      let models = [], object

      if (!err) {
        if (objects.length === 0) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'no matching objects could be found.' })
        } else {
          for (let idx = 0; idx < objects.length; idx++) {

            object = objects[idx]

            let model, i, postType, found = [], selectedPostTypes = self.normalizePostTypes(object, postTypes)
            if (selectedPostTypes) {
              for (i = 0; i < selectedPostTypes.length; i++) {
                postType = selectedPostTypes[i]
                model = object.getPostModel(postType)
                if (model) {
                  if (!~found.indexOf(postType)) {
                    found.push(postType)
                  }
                  models.push(model)
                }
              }
            } else {
              for (i = 0; i < object.feedDefinition.length; i++) {
                postType = object.feedDefinition[i].postType
                model = object.getPostModel(postType)
                if (model) {
                  models.push(model)
                }
              }
            }
          }
        }
      }
      callback(err, models)
    })

  },

  normalizePostTypes: function(object, limitTo) {
    if (limitTo && !_.isArray(limitTo)) {
      if (_.isString(limitTo)) {
        let exclude = limitTo[0] === '-'
        if (exclude) limitTo = limitTo.substr(1)
        limitTo = limitTo.split(',').map(function(v) {
          return v.trim()
        })
        if (exclude) {
          let validTypes = object.feedDefinition.map(function(v) {
            return v.postType
          })
          limitTo = _.difference(validTypes, limitTo)
        }
      } else {
        limitTo = null
      }
    }
    return limitTo
  },

  /**
     *
     * @param principal
     * @param options
     *  objects - by pluralname
     *  postTypes
     *  participants
     *  ac - if passed, supercedes objects. this assumes access to the subject has already been cleared.
     *
     *  unviewed false. if true, only posts not yet viewed by the calling principal are loaded.
     *  creator null. Limits the results to those posts created by the specified account id. Cannot be combined with the "filterCaller" argument, which it supercedes.
     *  filterCaller false. Set to true to filter out posts created by the caller. Cannot be combined with the "creator" argument, by which it is superceded
     *  patientFile null. Limits the results to those involving the specified patient. Cannot be combined with the "account" argument, which it supercedes
     *  account null. Limits the results to those involving the specified account. Cannot be combined with the "patientFile" argument, by which it is superceded
     *
     *  paths
     *  include
     *  expand
     *  select - low-level custom selections to be added to the paths. careful with this!
     *
     *  limit
     *  allowNoLimit: false
     *  startingAfter - supersedes ending_after
     *  endingBefore
     *  total: false - add a total to the list (if not a postId)
     *
     *
     *
     *  postId - supercedes ac, objects, postTypes, unviewed, participants, filterCaller, patientFile, account, contextId and limit.
     *  isComment: false. the poastId is treated as a commentId from which to get the source post.
     *
     *  skipAcl - skip acl checks.
     *  skipTargeting - skip targeting checks.
     *
     *
     *  batchField
     *  batchValues
     *
     *  scoped
     *
     *  defaultAcl - a custom default acl to merge into the post instance default.
     *
     * @param callback -> err, results, parser, selections
     */
  postLoad: function(principal, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }
    options = options || {}

    let self = this,
        postId = options['postId'] == null ? null : utils.getIdOrNull(options['postId']),
        batchValues = (postId || options['batchValues'] == null) ? null : utils.getIdArray(options['batchValues']),
        batchField = options['batchField'],
        tasks = [],
        baseFind = {
          org: principal.orgId,
          object: 'post',
          reap: false
        }

    if (options['postId'] != null && !postId) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'postId must be an objectId: ' + options['postId'] }))
      return
    }
    if ((_.isString(batchField) || (!postId && options['batchValues'] != null)) && (!batchValues || batchValues.length === 0)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'batchValues must be an array of 1 or more values.' }))
      return
    }
    if (batchValues && !_.isString(batchField)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'batchField must be a string.' }))
    }
    if (!postId && utils.option(options, 'unviewed', false)) {
      baseFind.views = { $ne: principal._id }
    }
    if (postId) {

      // if postId is a commentId, quick dip to lookup the postId.
      if (options.isComment) {
        tasks.push(function(callback) {
          modules.db.models.Comment.findOne({ '_id': postId }).select('context._id').lean().exec(function(err, doc) {
            if (!err && !doc) {
              err = Fault.create('cortex.notFound.unspecified', { reason: 'comment ' + postId + ' not found' })
            }
            postId = utils.path(doc, 'context._id')
            baseFind._id = postId
            callback(err)
          })
        })
      } else {
        baseFind._id = postId
      }

      options.limit = 1
      delete options.startingAfter
      delete options.endingBefore

    } else {

      if (!batchValues && options.ac) {
        baseFind['context._id'] = options['ac'].subjectId
      }

      let patientFileId,
          accountId,
          creatorId

      if (options.patientFile != null && !(patientFileId = utils.getIdOrNull(options.patientFile))) {
        callback(Fault.create('cortex.invalidArgument.invalidObjectId', { path: 'patientFile' }))
        return
      }
      if (!patientFileId) {
        if (options.account != null && !(accountId = utils.getIdOrNull(options.account))) {
          callback(Fault.create('cortex.invalidArgument.invalidObjectId', { path: 'account' }))
          return
        }
      }
      if (options.creator != null && !(creatorId = utils.getIdOrNull(options.creator))) {
        callback(Fault.create('cortex.invalidArgument.invalidObjectId', { path: 'creator' }))
        return
      }
      if (creatorId) {
        baseFind['creator._id'] = creatorId
      } else if (options.filterCaller) {
        baseFind['creator._id'] = { $ne: principal._id }
      }
      if (patientFileId) {
        tasks.push(function(callback) {
          // if the caller is able to read the account property of the patientFile, allow inclusion of the account as a query parameter for better coverage.
          modules.db.models.PatientFile.aclReadPath(principal, patientFileId, 'account', { req: options.req, script: options.script }, function(err, accountId) {
            if (!err && accountId) {
              baseFind.$or = [
                { 'patientFile._id': patientFileId },
                { 'account._id': accountId },
                { 'targets.target': accountId }
              ]
            } else {
              baseFind['patientFile._id'] = patientFileId
            }
            callback()
          })
        })
      } else if (accountId) {
        // an account is involved if the post is about them or they are a target of the post (simply involved in the conversation). note: this adds an $or to the query.
        baseFind.$or = [
          { 'account._id': accountId },
          { 'targets.target': accountId }
        ]
      }
    }

    if ((options.startingAfter !== undefined || options.endingBefore !== undefined) && (options.where || options.sort)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'startingAfter/endingBefore is incompatible with where/sort.' }))
    }

    if (_.isString(options.paths)) options.paths = [options.paths]
    if (_.isString(options.include)) options.include = [options.include]
    if (_.isString(options.expand)) options.expand = [options.expand]

    // if there is a single post, lookup the object and post type.
    tasks.push(function(callback) {
      if (!postId) {
        callback(null, options['ac'] ? [options['ac'].object] : options.objects, options.postTypes) // passed in access objects and post type.
        return
      }
      self.findOne({ _id: postId }).select('context.object type').lean().exec(function(err, post) {
        if (!err && !post) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'post ' + postId + ' not found' })
        }
        callback(err, utils.array(utils.path(post, 'context.object'), true), utils.array(utils.path(post, 'type'), true))
      })

    })

    // load the post models. the parser needs these in advance.
    tasks.push(function(accessObjects, accessPostTypes, callback) {
      self.loadPostModels(principal, accessObjects, accessPostTypes, callback)
    })

    tasks.push(function(models, callback) {

      // whittle the list down to acceptable types, unless the base is in scope, in which case allow them all.
      if (utils.rBool(options.scoped, true)) {
        const baseInScope = modules.authentication.authInScope(principal.scope, `object.read.post`, true, true)
        if (!baseInScope) {
          const findTypes = models.map(v => v.postType).filter(type => type !== null && modules.authentication.authInScope(principal.scope, `object.read.post#${+type}`))
          if (findTypes.length === 0) {
            return callback(Fault.create('cortex.accessDenied.scope', { path: 'object.read.post' }))
          }
          baseFind.type = { $in: findTypes }
        }
      }

      const parser = new Parser(principal, modules.db.models.Post, { allowNoLimit: !!options.allowNoLimit, total: !!options.total, grant: options.grant, script: options.script, models: models, defaultAcl: options.defaultAcl, allowSystemAccessToParserProperties: options.allowSystemAccessToParserProperties })

      if (batchField) {
        parser.setBatch(batchField, batchValues)
      }
      parser.addRawMatch(baseFind)

      try {
        parser.parse(options)
      } catch (err) {
        return callback(err)
      }

      callback(null, models, parser)

    })

    // prepare query params.
    tasks.push(function(models, parser, callback) {

      const accessOptions = {
        participants: postId ? null : options['participants'],
        skipAcl: options.skipAcl || principal.skipAcl,
        skipTargeting: options.skipTargeting,
        defaultAcl: options.defaultAcl,
        defaultAclOverride: false
      }

      self.accessQuery(principal, models, accessOptions, function(err, accessQuery) {

        if (!err) {

          // no access query means nothing available. short circuit.
          if (!accessQuery) {
            return callback(postId ? Fault.create('cortex.notFound.unspecified', { reason: 'post ' + postId + ' not found' }) : true, null, parser)
          }

          parser.addRawMatch(accessQuery)

        }
        callback(err, parser, models)
      })

    })

    // load raw posts.
    tasks.push(function(parser, models, callback) {

      const select = self.schema.node.selectPaths(principal, utils.extend({}, options))
      utils.extend(select, options.select)
      select.type = true
      select.facets = true
      select.body = true
      select.idx = 1

      parser.exec({ select: select }, function(err, results) {

        callback(err, results, models, parser, select)

      })

    })

    // if there are no results for a single post, produce the right error by checking for existence.
    if (postId) {
      tasks.push(function(results, models, parser, select, callback) {
        if (results.data.length > 0) {
          callback(null, results, models, parser, select)
        } else {
          self.findOne(baseFind).select('_id').lean().exec(function(err, doc) {
            if (!err) {
              if (doc) {
                err = Fault.create('cortex.accessDenied.unspecified', { reason: 'access to post ' + postId })
              } else {
                err = Fault.create('cortex.notFound.unspecified', { reason: 'post ' + postId + ' not found' })
              }
            }
            callback(err, results, models, parser, select)
          })
        }
      })
    }

    // process raw posts into matching post models.
    tasks.push(function(results, models, parser, select, callback) {

      if (!parser.isModelFormat()) {
        return callback(null, results, parser, select)
      }

      function instantiate(result) {
        result.data = result.data.map(function(raw) {
          const Model = _.find(models, function(model) {
            return model.postType === raw.type && model.parentObject.objectName === raw.context.object
          })
          if (!Model) {
            return null
          }
          let document = new Model(undefined, select, true)
          document.init(raw)
          document.$raw = raw
          return document
        }).filter(function(post) {
          return !!post
        })
      }

      // grouping?
      if (results.object === 'map') {
        Object.keys(results.data).forEach(function(key) {
          instantiate(results.data[key])
        })
      } else {
        instantiate(results)
      }
      callback(null, results, parser, select)

    })

    async.waterfall(tasks, function(err, results, parser, select) {

      if (err === true) {
        err = null
        results = {
          object: 'list',
          data: [],
          hasMore: false
        }
      }
      callback(err, results, parser, select)

    })
  },

  doTrackViews: function(accountId, postIds, callback) {
    postIds = utils.getIdArray(postIds)
    this.collection.updateMany({ _id: { $in: postIds }, views: { $exists: true } }, { $addToSet: { views: accountId } }, function(err) {
      if (err) {
        logger.error('error tracking post views', { account: accountId, posts: postIds })
      }
      if (_.isFunction(callback)) callback(err)
    })
  },

  /**
     * read a single post.
     *
     * @param principal
     * @param postId
     * @param options
     *
     *  isComment: false. if true, the passed in postId is treated as a commentId, and the post is loaded from the source comment.
     *
     *  paths
     *  include
     *  expand
     *
     *  req: null. the http request.
     *  json: true // convert to json object using acl read.
     *  override null. an acl access override. if 'true', sets to Max.
     *  grant null. an acl access level to grant (at least this level). resolved access equals Max(natural,grant). overridden by override
     *  acOptions: null. a list of options to pass into the resulting access contexts.
     *  hooks: true. set to false to skip hooks
     *
     *  clearNotifications: true - if true, clears notifications for loaded posts for calling principal when the notifications feed configuration options is enabled.
     *  trackViews: true - if true, tracks the view for the calling principal when the feed configuration option is enabled.
     *  path: null. if a string, a single path is being read. this is passed in the ac options to any readers.
     * @param callback -> err, result, ac, parser, selections
     */
  postReadOne: function(principal, postId, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }
    options.postId = postId
    options.attachAc = true
    options.selectionTree = options.selectionTree || new SelectionTree(options)

    this.postList(principal, options, function(err, documents, parser, selections) {
      let document, ac
      if (!err) {
        document = documents.data[0]
        if (document) {
          ac = document.$__ac
          delete document.$__ac
        }
      }
      callback(err, document, ac, parser, selections)
    })

  },

  /**
     * list posts
     * @param principal
     * @param options
     *    attachAc. adds a $__ac property to each output element
     * @param callback -> err, posts, parser, selections
     */
  postList: function(principal, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    let self = this,
        clear = utils.option(options, 'clearNotifications', true) ? [] : null,
        track = utils.option(options, 'trackViews', true) ? [] : null

    async.waterfall([

      // load docs.
      function(callback) {
        self.postLoad(principal, options, callback)
      },

      // init docs
      function(documents, parser, selections, callback) {

        const acOptions = {
                override: options.override,
                method: options.method,
                grant: options.grant,
                req: options.req,
                script: options.script,
                pacl: options.pacl,
                eq: new ExpansionQueue(principal, options.req, options.script),
                options: options.acOptions
              },
              acs = {},
              obj = documents.object === 'map' ? documents.data : { key: documents }

        if (parser.isModelFormat()) {
          Object.keys(obj).forEach(function(key) {
            let documents = obj[key]
            documents.data.forEach(function(document) {

              let ac = new acl.PostAccessContext(principal, document, acOptions)
              if (options.singlePath) {
                ac.singlePath = options.singlePath
              }
              if (options.defaultAcl) {
                ac.resolve(true, acl.mergeAndSanitizeEntries(options.defaultAcl, ac.model.postInstanceAcl))
              }
              acs[document._id.toString()] = ac

              if (document.constructor.notifications && clear) clear.push(document._id)
              if (document.constructor.trackViews && track) track.push(document._id)
            })
          })
        }

        setImmediate(callback, null, documents, parser, selections, acOptions, acs)

      },

      function(documents, parser, selections, acOptions, acs, callback) {

        if (!parser.isModelFormat() || !utils.option(options, 'json', true)) {
          return callback(null, documents, acs)
        }

        const obj = documents.object === 'map' ? documents.data : { key: documents },
              selectionTree = options.selectionTree || new SelectionTree(options)

        let allDocs = []

        selectionTree.setOption('deferGroupReads', true)
        selectionTree.setOption('forgiving', true)

        parser.getUnwoundPaths().forEach(function(path) {
          selectionTree.setTreatAsIndividualProperty(path)
        })

        async.eachSeries(Object.keys(obj), function(key, callback) {

          const documents = obj[key]
          async.mapLimit(documents.data, 10, function(document, callback) {
            document.aclRead(acs[document._id.toString()], selectionTree, function(err, json) {
              callback(err, json)
            })
          }, function(err, list) {
            if (!err) {
              documents.data = list
              allDocs = allDocs.concat(list)
            }
            callback(err)

          })
        }, function(err) {

          if (err) {
            return callback(err)
          }

          // read grouped?
          self.schema.node.readGrouped(principal, allDocs, utils.path(options, 'req'), utils.path(options, 'script'), function(err) {

            // expand?
            if (!err) {
              acOptions.eq.expand(documents, function(err) {
                callback(err, documents, acs, parser, selections)
              })
            } else {
              callback(err, documents, acs, parser, selections)
            }

          })

        })

      }

    ], function(err, documents, acs, parser, selections) {

      if (!err) {

        if (options.attachAc) {
          const obj = documents.object === 'map' ? documents.data : { key: documents }
          Object.keys(obj).forEach(function(key) {
            let documents = obj[key]
            documents.data.forEach(function(document) {
              document.$__ac = acs[document._id.toString()]
            })
          })
        }

        if (clear && clear.length > 0) {
          modules.notifications.acknowledgePostOnOrBefore(principal, clear)
        }
        if (track && track.length > 0) {
          self.doTrackViews(principal._id, track)
        }
      }
      callback(err, documents, parser, selections)
    })

  },

  postReadPath: function(principal, postId, singlePath, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options.singlePath = singlePath; // reading single path.

    // add relative path to all expand, include, paths.
    ['paths', 'include', 'expand'].forEach(function(key) {
      if (options[key]) {
        options[key] = utils.array(options[key], true).map(function(entry) {
          return singlePath + '.' + entry
        })
      }
    })

    if (options.paths) {
      options.paths.push(singlePath)
    } else {
      options.paths = [singlePath]
    }

    this.postReadOne(principal, postId, options, function(err, document, ac) {
      callback(err, err ? undefined : utils.digIntoResolved(document, singlePath), ac)
    })

  },

  /**
     * @param principal
     * @param object
     * @param contextId
     * @param postType
     * @param payload
     * @param options
     *
     *  override: false
     *  grant: acl.AccessLevels.None
     *  scoped
     * @param callback -> err, postAc
     */
  postCreate: function(principal, object, contextId, postType, payload, options, callback) {

    const self = this

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    async.waterfall([

      // load object
      function(callback) {
        if (acl.isObjectModel(object)) {
          callback(null, object)
        } else {
          principal.org.createObject(object, callback)
        }
      },

      // load subject access context
      function(context, callback) {
        context.getAccessContext(principal, contextId, callback)
      },

      // load, validate access, and create post.
      function(ac, callback) {

        const Model = ac.object.getPostModel(postType)
        if (!Model) {
          callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post type: ' + postType }))
          return
        }

        if (utils.rBool(options.scoped, true)) {
          const requiredScope = `object.create.post#${Model.postType}}`
          if (!modules.authentication.authInScope(principal.scope, requiredScope)) {
            return callback(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
          }
        }

        let post = new Model(),
            postAc

        post.created = new Date()
        post.org = ac.orgId
        post.object = 'post'
        post.context = {
          object: Model.parentObject.objectName, // @todo factor out! this whole $parentObejct hack smell fishy.
          _id: ac.subjectId
        }
        post.creator = { _id: ac.principalId }
        post.type = Model.postType
        post.views = [ac.principalId]
        post.ctx = {
          creator: ac.creatorId || undefined,
          owner: ac.ownerId || undefined,
          acl: ac.subject.acl,
          aclv: ac.subject.aclv
        }
        post.targets = [{ target: ac.principalId, type: acl.AccessTargets.Account }]

        ac.method = 'post'
        ac.req = options.req
        ac.script = options.script
        ac.override = utils.option(options, 'override', false)
        ac.grant = utils.option(options, 'grant', acl.AccessLevels.None)

        postAc = new acl.PostAccessContext(principal, post, { method: 'post', req: options.req, script: options.script, override: ac.override, grant: ac.grant })

        if (!postAc.canCreate(ac)) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Post create access is insufficient.' }))
          return null
        }

        // write, build, save
        post.aclWrite(postAc, payload, function(err) {
          if (err) {
            callback(err)
            return
          }
          postAc.save({ skipValidation: options.skipValidation }, function(err) {

            // syncAcl in case there were changes before the post was created.
            if (!err) {
              object.getAccessContext(principal, contextId, function(err, ac) {
                if (!err) {
                  self.syncAcl(ac, { post: postAc.post })
                }
              })
            }
            callback(err, postAc)
          })

        })
      }

    ], callback)

  },

  /**
     *
     * @param principal
     * @param postId
     * @param payload
     * @param options
     * @param callback -> err, ac, modified
     */
  postUpdate: function(principal, postId, payload, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    const self = this,
          changedPaths = utils.array(Object.keys(utils.flattenObjectPaths(payload, true, true))),
          singlePath = utils.option(options, 'singlePath')

    options = {
      req: options.req,
      method: options.method,
      script: options.script,
      singlePath: singlePath,
      trackViews: false,
      clearNotifications: false,
      json: false,
      paths: changedPaths
    }

    let tasks = [

      // load the entire document for post updates
      // load the post. checking for access.
      function(callback) {

        options.paths = null

        self.postReadOne(principal, postId, options, callback)
      },

      // update
      function(post, pac, parser, selections, callback) {

        if (!pac.model.editable) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'post is not editable' }))
        } else {
          pac.singlePath = singlePath
          post.aclWrite(pac, payload, function(err) {
            if (err) {
              callback(err)
            } else {
              pac.save({ changedPaths: changedPaths }, function(err, modified) {
                callback(err, pac, modified)
              })
            }
          })
        }
      }

    ]

    modules.db.sequencedWaterfall(tasks, 10, callback)

  },

  postUpdatePath: function(principal, postId, path, value, options, callback) {

    if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }
    options.singlePath = path

    // create a payload with ids inserted as arrays.
    let payload
    try {
      payload = utils.pathToPayload(path, value)
    } catch (err) {
      callback(err)
      return
    }
    this.postUpdate(principal, postId, payload, options, function(err, ac, modified) {
      callback(err, ac, modified)
    })
  },

  postRemovePath: function(principal, postId, path, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options = {
      req: options.req,
      script: options.script,
      trackViews: false,
      method: 'delete',
      clearNotifications: false,
      json: false,
      paths: [path]
    }

    let self = this,
        removedPath = utils.normalizeObjectPath(path, true, true, true),
        tasks

    // are we removing a valuein an array somewhere? find the correct path in order to include the right paths.
    if (!self.schema.node.findNode(path)) {
      const testPath = _.initial(removedPath.split('.')).join('.')
      if (self.schema.node.findNode(testPath)) {
        removedPath = testPath
      }
    }

    tasks = [

      // load the entire document.
      // load the post. checking for access.
      function(callback) {

        options.paths = null
        self.postReadOne(principal, postId, options, callback)

      },

      // update
      function(post, ac, parser, selections, callback) {

        if (!ac.model.editable) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'post is not editable' }))
        } else {

          ac.method = 'put'
          post.aclRemove(ac, path, function(err) {
            if (err) {
              callback(err)
            } else {
              ac.save({ changedPaths: [removedPath] }, function(err, modified) {
                callback(err, ac, modified)
              })
            }
          })
        }
      }

    ]
    modules.db.sequencedWaterfall(tasks, 10, callback)

  },

  /**
     * @param principal
     * @param postId
     * @param options
     * @param callback -> err, ac
     */
  postDelete: function(principal, postId, options, callback) {

    const self = this

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options = {
      req: options.req,
      script: options.script,
      trackViews: false,
      clearNotifications: false,
      json: false,
      paths: ['idx'],
      method: 'delete',
      scoped: utils.rBool(options.scoped, true)
    }

    let tasks = [

      // load the post. checking for access.
      function(callback) {
        self.postReadOne(principal, postId, options, callback)
      },

      // delete
      function(post, ac, parser, selections, callback) {

        if (options.scoped) {
          const requiredScope = `object.delete.post${post.type ? ('#' + post.type) : ''}.${post._id}`
          if (!modules.authentication.authInScope(principal.scope, requiredScope)) {
            return callback(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
          }
        }
        if (!ac.model.deletable) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'post is not deletable' }))
        } else if (!ac.hasAccess(acl.AccessLevels.Delete)) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'delete access denied' }))
        } else {
          ac.save(function(err) {
            callback(err, ac)
          })
        }
      },

      // cleanup notifications & comments
      function(ac, callback) {

        modules.db.models.Notification.collection.deleteMany({ object: 'post', 'context._id': ac.subjectId, 'meta.postId': ac.postId }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('error clearing post notifications', { post: ac.postId, error: err.toJSON() })
        })

        modules.db.models.Comment.collection.updateMany({ object: 'comment', 'context._id': ac.postId }, { $set: { reap: true } }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('error clearing post comments', { post: ac.postId, error: err.toJSON() })
        })

        callback()
      }
    ]

    modules.db.sequencedWaterfall(tasks, 10, callback)

  },

  /**
     * Produces a list of account targets in the form of (aclPaths + _id, name, locale} for each target
     *
     * Anonymous and Public entries are not resolved, nor are Role entries. Only direct access entries referencing Accounts are processed.
     *
     * @param ac
     * @param callback err, targets (as list construct or null)
     */
  getPostTargets: function(ac, callback) {

    function aclToPrincipalTargets(org, aclEntries, required, includeRoles) {

      const t = aclEntries.reduce(function(t, entry) {
        if (entry.allow >= required) {
          if (entry.target) {
            if (entry.type === acl.AccessTargets.Account && !utils.equalIds(acl.PublicIdentifier, entry.target) && !utils.equalIds(acl.AnonymousIdentifier, entry.target)) {
              t.ids.push(entry.target)
            } else if (includeRoles && entry.type === acl.AccessTargets.OrgRole) {
              t.roles = t.roles.concat(acl.expandRoles(org.roles, entry.target))
            }
          } else {
            switch (entry.type) {
              case acl.AccessPrincipals.Self: if (ac.objectName === 'account') t.ids.push(ac.subjectId); break // the subject itself (as an account).
              case acl.AccessPrincipals.Creator: if (ac.creatorId) t.ids.push(ac.creatorId); break // the subject creator
              case acl.AccessPrincipals.Owner: if (ac.ownerId) t.ids.push(ac.ownerId); break // the subject owner
            }
          }
        }
        return t
      }, { ids: [], roles: [] })

      Object.keys(t).forEach(function(key) {
        t[key] = utils.uniqueIdArray(t[key])
      })
      return t
    }

    function principalTargetsToFind(t) {

      const conditions = []
      if (t.ids.length > 0) conditions.push({ _id: t.ids.length === 1 ? t.ids[0] : { $in: t.ids } })
      if (t.roles.length > 0) conditions.push({ roles: t.roles.length === 1 ? t.roles[0] : { $in: t.roles } })

      if (conditions.length === 0) {
        return null
      }
      return conditions.length === 1 ? conditions[0] : { $or: conditions }
    }

    function postTargetsToAclEntries(allow, targets) {
      return targets.reduce(function(acl, target) {
        acl.push(utils.extend(clone((target && target.toObject) ? target.toObject() : target), { allow: allow }))
        return acl
      }, [])
    }

    // -------------------------------------------

    let required = ac.model.contextReadAccess, // those with this access to the context will be targets
        contextAclEntries = utils.array(ac.object.defaultAcl).concat(utils.array(utils.path(ac.post, ac.documentPathForAclKey('acl')))), // object defaults + context acl entries
        find = principalTargetsToFind(aclToPrincipalTargets(ac.org, contextAclEntries, required, false)), // initial resolved find.
        limitFind

    if (!find) { // no acl entries.
      callback()
      return
    }

    // limit find to those entries that match the context read acl.
    limitFind = principalTargetsToFind(aclToPrincipalTargets(ac.org, utils.array(ac.model.contextReadAcl), required, true))
    if (limitFind) {
      find = { $and: [find, limitFind] }
    }

    // limit to targets, if any.
    if (ac.post.targets.length > 1) {
      const limitTargets = principalTargetsToFind(aclToPrincipalTargets(ac.org, postTargetsToAclEntries(required, utils.array(ac.post.targets)), required, true))
      if (limitTargets) {
        if (find.$and) find.$and.push(limitTargets)
        else find = { $and: [find, limitTargets] }
      }
    }

    ac.org.createObject('Account', function(err, Account) {
      if (err) {
        callback(err)
        return
      }
      Account.aclLoad(ac.principal, { internalWhere: find, limit: false, allowNoLimit: true, paths: ['name', 'locale'], hooks: false, skipAcl: true }, function(err, results) {
        callback(err, results)
      })
    })

  },

  notifyPostTargets: function(ac, comment, callback) {

    if (_.isFunction(comment)) { callback = comment; comment = null }
    callback = utils.ensureCallback(callback)

    if (!(ac instanceof acl.PostAccessContext)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'acl.AccessContext expected.' }))
      return
    }

    this.getPostTargets(ac, function(err, accounts) {
      if (!err && accounts) {
        accounts.data.forEach(function(account) {
          if (!utils.equalIds(ac.principalId, account._id) || (config('feeds.notifySelf'))) {
            let payload = {
              context: {
                object: ac.objectName,
                _id: ac.subjectId
              },
              principal: account._id,
              post: ac.postId,
              meta: { postId: ac.postId, type: ac.postType },
              variables: {
                post: ac.postId,
                object: ac.objectId,
                schema: ac.objectName
              }
            }
            if (comment) {
              payload.variables.comment = comment._id
              payload.meta.commentId = comment._id
            }

            payload.created = ac.post.updated ? ac.post.updated : utils.idToTimestamp(ac.post._id)
            ac.org.sendNotification(comment ? 'FeedCommentUpdate' : 'FeedPostUpdate', payload)
          }
        })
      }
      if (err) logger.warn('error sending feed update notifications:', err.toJSON())
      if (_.isFunction(callback)) {
        callback(err)
      }
    })

  },

  /**
     * ensures a post has the latest version of a subject acl.
     *
     * @param ac an acl.AccessContext
     * @param options
     *      post: null. if set, updates only the passed in post.
     * @param {function=} callback err
     */
  syncAcl: function(ac, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = null
    }

    let entries = ac.subject.acl,
        find = { 'context._id': ac.subjectId, org: ac.orgId, 'ctx.aclv': { $lt: ac.subject.aclv } },
        update = { $set: { 'ctx.acl': entries, 'ctx.aclv': ac.subject.aclv } },
        postId

    if (ac.hasOwner) update.$set['ctx.owner'] = ac.ownerId

    postId = utils.getIdOrNull(utils.option(options, 'post'), true)
    if (postId) {
      find._id = postId
    }

    this.collection[postId ? 'updateOne' : 'updateMany'](find, update, function(err) {
      if (_.isFunction(callback)) {
        callback(err)
      }
    })

  }

}

BasePostModel.indexes = [

  // @todo: acl index in post and comment?
  // @todo expose pcontext and convert to post_context? we can do cross object comment search in this way.

  // for lookups on specific contexts (looking up num updates, find and modify on singleton posts, context-level updates for owner)
  [{ 'context.object': 1 }, { name: 'idxContextObject', partialFilterExpression: { 'context.object': { $exists: true } } }],

  [{ 'meta.up': 1, org: 1, object: 1 }, { name: 'idxMetadataUpdates' }],

  [{ org: 1 }, { name: 'idxOrg' }],

  [{ type: 1 }, { name: 'idxPostType' }],

  [{ 'context._id': 1 }, { name: 'idxContextId' }],

  [{ reap: 1 }, { name: 'idxReap' }],

  [{ 'creator._id': 1 }, { name: 'idxCreator' }],

  [{ 'patientFile._id': 1 }, { name: 'idxPatientFile' }],

  [{ 'account._id': 1 }, { name: 'idxAccount' }],

  [{ 'body.name': 1 }, { name: 'idxSegmentName' }],

  // facets
  [{ 'facets._kl': 1 }, { name: 'idxDeletedFacets', partialFilterExpression: { 'facets._kl': true } }],
  [{ 'facets.pid': 1 }, { name: 'idxFacetInstanceId', partialFilterExpression: { 'facets.pid': { $exists: true } } }],
  [{ 'facets._pi': 1 }, { name: 'idxFacetPropertyId', partialFilterExpression: { 'facets._pi': { $exists: true } } }]

]

// searchable and unique "indexed" properties index.
BasePostModel.indexes = BasePostModel.indexes.concat(modules.db.definitions.getIndexDefinitions())

module.exports = BasePostModel
