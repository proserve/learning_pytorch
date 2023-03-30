'use strict'

const util = require('util'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      logger = require('cortex-service/lib/logger'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      async = require('async'),
      modules = require('../../../../modules'),
      Parser = require('../../../parser/old.posts.and.comments'),
      SelectionTree = require('../classes/selection-tree'),
      CommentDefinition = require('../feeds/comment-definition'),
      ExpansionQueue = require('../classes/expansion-queue')

function BaseCommentModel() {

  // the base comment model includes a body, but only for loading, prior to branching off to custom comment models.
  const commentDoc = {
    body: []
  }

  CommentDefinition.call(this, commentDoc)
}
util.inherits(BaseCommentModel, CommentDefinition)

BaseCommentModel.prototype.generateMongooseSchema = function(options) {

  options = options || {}
  options.statics = BaseCommentModel.statics
  options.methods = BaseCommentModel.methods
  options.indexes = BaseCommentModel.indexes

  return CommentDefinition.prototype.generateMongooseSchema.call(this, options)
}

BaseCommentModel.statics = {

  /**
     * @param pacs
     * @param options
     *
     *  commentId - if passed, reads a single comment.
     *
     *  unviewed false. if true, only comments not yet viewed by the calling principal are loaded.
     *
     *  paths
     *  include
     *  expand
     *  select - low-level custom selections to be added to the paths. careful with this!
     *
     *  limit
     *  allowNoLimit: false
     *  startingAfter - supercedes ending_after
     *  endingBefore
     *  total: false - add a total to the list (if not a postId)
     *
     *  scoped: true
     *  skipAcl - skip acl checks.
     *
     * @param callback -> err, results, parser, selections
     */
  commentLoad: function(pacs, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    const self = this,
          commentId = options['commentId'] == null ? null : utils.getIdOrNull(options['commentId']),
          principal = utils.path(pacs, '0.principal')

    if (!principal || !(pacs[0] instanceof acl.PostAccessContext)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid post access context.' }))
      return
    }

    if (options['commentId'] != null && !commentId) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'commentId must be an ObjectId: ' + options['commentId'] }))
      return
    }

    if ((options.startingAfter !== undefined || options.endingBefore !== undefined) && (options.where || options.sort)) {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'startingAfter/endingBefore is incompatible with where/sort.' }))
    }

    let postIds = pacs.map(function(pac) { return pac.postId }),
        find = {
          org: principal.orgId,
          object: 'comment',
          reap: false
        },
        models,
        parser,
        select

    if (commentId) {
      find._id = commentId
      find['context._id'] = postIds[0]
    }

    if (!commentId && utils.option(options, 'unviewed', false)) {
      find.views = { $ne: principal._id }
    }

    if (_.isString(options.paths)) options.paths = [options.paths]
    if (_.isString(options.include)) options.include = [options.include]
    if (_.isString(options.expand)) options.expand = [options.expand]

    models = _.uniq(pacs.map(function(pac) { return pac.model.getCommentModel() }))

    if (utils.rBool(options.scoped, true) && !modules.authentication.authInScope(principal.scope, 'object.read.comment')) {
      return callback(Fault.create('cortex.accessDenied.scope', { path: 'object.read.comment' }))
    }

    parser = new Parser(principal, modules.db.models.Comment, { allowNoLimit: options.allowNoLimit, grant: options.grant, script: options.script, models: models, total: !!options.total })

    parser.setBatch('context._id', postIds)
    parser.addRawMatch(find)

    select = self.schema.node.selectPaths(principal, utils.extend({}, options))
    utils.extend(select, options.select)

    try {
      parser.parse(options, select)
    } catch (err) {
      return callback(err)
    }

    select.type = true
    select.facets = true
    select.body = true
    select.idx = true

    parser.exec({ select: select }, function(err, results) {

      // all results for comments will be represented as a map.
      if (!err && commentId) {

        // if there are no results for a single comment, produce the right error by checking for existence.
        const result = results.data[postIds[0]]
        if (!result || !utils.findIdInArray(result.data, '_id', commentId)) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'comment ' + commentId + ' not found' })
        }
      }

      // create concrete models for each comment.
      if (!err && parser.isModelFormat()) {
        Object.keys(results.data).forEach(function(key) {
          results.data[key].data = results.data[key].data.map(function(raw) {
            let pac = _.find(pacs, function(pac) { return utils.equalIds(pac.postId, utils.path(raw, 'context._id')) }),
                Model,
                document
            if (!pac) {
              return null
            }
            Model = pac.model.getCommentModel()
            if (!Model) {
              return null
            }
            document = new Model(undefined, select, true)
            document.init(raw)
            document.$raw = raw
            return document
          }).filter(function(comment) {
            return !!comment
          })
        })
      }

      callback(err, results, parser, select)
    })

  },

  /**
     * list comments post(s)
     *
     * @param pacs      --- the principal must be the same for all pacs.
     * @param options
     *
     *  commentId
     *  paths
     *  include
     *  expand
     *  clearNotifications
     *  trackViews
     *  json
     *
     *
     * @param callback -> err, map { object: 'map', data: {:postId: {object: 'list', data: [comment, ...]} , ... }}, parser, selections
     */
  commentList: function(pacs, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    pacs = utils.array(pacs, true)
    const principal = utils.path(pacs, '0.principal'),
          self = this,
          clear = utils.option(options, 'clearNotifications', true) ? [] : null,
          track = utils.option(options, 'trackViews', true) ? [] : null,
          selectionTree = options.selectionTree || new SelectionTree(options)

    if (!principal || !(pacs[0] instanceof acl.PostAccessContext)) {
      callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'invalid post access context.' }))
      return
    }

    // allow expansion to follow through. we need a new set of pacs for this, because the expansion queue for the post access level cannot be used.
    // each comment now get's its own pac, but shares the post expansion queue.
    let eq

    if (utils.path(pacs, '0.eq')) {
      eq = new ExpansionQueue(principal, utils.path(pacs, '0.req') || options.req, utils.path(pacs, '0.script') || options.script)
      pacs = pacs.map(function(pac) {
        return pac.copy(pac.post, { eq: eq }, true)
      })
    }

    selectionTree.setOption('deferGroupReads', true)
    selectionTree.setOption('forgiving', true)

    async.waterfall([

      // load docs.
      function(callback) {
        self.commentLoad(pacs, options, callback)
      },

      // read docs
      function(map, parser, selections, callback) {

        parser.getUnwoundPaths().forEach(function(path) {
          selectionTree.setTreatAsIndividualProperty(path)
        })

        const postIds = Object.keys(map.data)

        // used to process groupReads and expansion all at once.
        let input = [],
            output = []

        // prep to track and clear.
        postIds.forEach(function(postId) {
          const documents = map.data[postId],
                pac = _.find(pacs, function(pac) { return utils.equalIds(pac.postId, postId) })
          documents.data.forEach(function(document) {

            if (options.attachAc) {
              document.$__ac = pac.copy(pac.post, { eq: pac.eq }, true)
              document.$__ac.$__parentAc = null
              document.$__ac.comment = document
            }
            if (document.constructor.notifications && clear) {
              clear.push(document._id)
            }
            if (document.constructor.trackViews && track) {
              track.push(document._id)
            }
          })
        })

        if (!parser.isModelFormat() || !utils.option(options, 'json', true)) {
          callback(null, map, parser, selections)
          return
        }

        // convert documents to json output.
        async.eachSeries(postIds, function(postId, callback) {

          const documents = map.data[postId],
                pac = _.find(pacs, function(pac) { return utils.equalIds(pac.postId, postId) })

          async.mapLimit(documents.data, 10, function(document, callback) {

            // already have one from earlier?
            let cac
            if (document.$__ac) {
              cac = document.$__ac
            } else {
              cac = pac.copy(pac.post, { eq: pac.eq }, true)
              cac.$__parentAc = null
              cac.comment = document
            }
            document.aclRead(cac, selectionTree, function(err, json) {
              callback(err, json)
            })
          }, function(err, outputComments) {
            if (!err) {
              input = input.concat(documents.data)
              output = output.concat(outputComments)
              documents.data = outputComments // replace output with jsonified documents.
            }
            callback(err)
          })
        }, function(err) {

          if (err) {
            callback(err)
            return
          }

          // read grouped and perform expansions on the set as a whole.
          async.waterfall([
            function(callback) {
              self.schema.node.readGrouped(principal, output, options.req, options.script, callback)
            },
            function(callback) {
              if (!err && eq) {
                eq.expand(output, function(err) {
                  callback(err)
                })
              } else {
                callback()
              }
            }
          ], function(err) {
            callback(err, map, parser, selections) // output the map, whose lists have been transformed (or not) into group-read, expanded data.
          })
        })
      }

    ], function(err, map, parser, selections) {
      if (!err) {
        if (clear && clear.length > 0) {
          modules.notifications.acknowledgeCommentOnOrBefore(principal, clear)
        }
        if (track && track.length > 0) {
          self.doTrackViews(principal._id, track)
        }
      }
      callback(err, map, parser, selections)
    })

  },

  doTrackViews: function(accountId, commentIds, callback) {
    commentIds = utils.getIdArray(commentIds)
    this.collection.updateMany({ _id: { $in: commentIds }, views: { $exists: true } }, { $addToSet: { views: accountId } }, function(err) {
      if (err) {
        logger.error('error tracking post views', { account: accountId, comments: commentIds })
      }
      if (_.isFunction(callback)) callback(err)
    })
  },

  /**
     * read a single comment.
     *
     * @param pac post access context. read access to the comment is assumed.
     * @param commentId
     * @param options
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
     *  singlePath: null. if a string, a single path is being read. this is passed in the ac options to any readers.
     * @param callback -> err, comment, cac, parser, selections
     */
  commentReadOne: function(pac, commentId, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options.commentId = commentId
    if (options.singlePath) pac.singlePath = options.singlePath
    options.attachAc = true

    options.selectionTree = options.selectionTree || new SelectionTree(options)

    this.commentList([pac], options, function(err, map, parser, selections) {
      let document, cac
      if (!err) {
        document = utils.path(map.data[pac.postId], 'data.0') // { object: 'map', data: {:postId: {object: 'list', data: [comment, ...]} }}
        if (!document) {
          err = Fault.create('cortex.notFound.unspecified', { reason: 'Comment not found.' })
        }
        cac = document.$__ac
        delete document.$__ac
      }
      callback(err, document, cac, parser, selections)
    })

  },

  /**
     *
     * @param pac
     * @param commentId
     * @param singlePath
     * @param options
     * @param callback -> err, value
     */
  commentReadPath: function(pac, commentId, singlePath, options, callback) {

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

    this.commentReadOne(pac, commentId, options, function(err, document) {
      callback(err, err ? undefined : utils.digIntoResolved(document, singlePath))
    })

  },

  /**
     * @param pac
     * @param payload
     * @param options
     *
     *  override: false
     *  grant: acl.AccessLevels.None
     *
     * @param callback -> err, cac
     */
  commentCreate: function(pac, payload, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }

    options = {
      req: options.req,
      script: options.script,
      skipValidation: options.skipValidation,
      trackViews: false,
      clearNotifications: false,
      json: false,
      scoped: utils.rBool(options.scoped, true),
      paths: ['_id']
    }

    async.waterfall([

      // create the comment
      function(callback) {

        if (!pac.model.allowComments) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'Comments are disabled.' }))
          return
        }

        let Model = pac.model.getCommentModel(),
            comment,
            cac

        if (!Model) {
          callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post type' }))
          return
        }

        if (options.scoped) {
          const requiredScope = `object.create.comment#${Model.postType}}`
          if (!modules.authentication.authInScope(pac.principal.scope, requiredScope)) {
            return callback(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
          }
        }

        comment = new Model()
        comment.created = new Date()
        comment.org = pac.orgId
        comment.object = 'comment'
        comment.type = Model.postType
        comment.context = { _id: pac.postId }
        comment.pcontext = { _id: pac.subjectId, object: pac.objectName }
        comment.creator = { _id: pac.principalId }
        comment.views = [pac.principalId]

        cac = pac.copy(pac.post, {}, true)
        cac.$__parentAc = null
        cac.comment = comment

        // write, build, save.
        comment.aclWrite(cac, payload, function(err) {
          if (err) {
            callback(err)
            return
          }
          cac.save({ skipValidation: options.skipValidation }, function(err) {
            callback(err, cac)
          })

        })
      }

    ], callback)

  },

  /**
     *
     * @param pac
     * @param commentId
     * @param payload
     * @param options
     * @param callback -> err, comment, modified
     */
  commentUpdate: function(pac, commentId, payload, options, callback) {

    [options, callback] = utils.resolveOptionsCallback(options, callback)

    const self = this,
          changedPaths = utils.array(Object.keys(utils.flattenObjectPaths(payload, true, true))),
          singlePath = utils.option(options, 'singlePath')

    options = {
      singlePath: singlePath,
      req: options.req,
      script: options.script,
      trackViews: false,
      clearNotifications: false,
      json: false,
      paths: changedPaths
    }

    let tasks = [

      // load the entire document.
      // load the comment. checking for access.
      function(callback) {

        options.paths = null

        self.commentReadOne(pac, commentId, options, callback)
      },

      // update
      function(comment, cac, parser, selections, callback) {

        cac.singlePath = singlePath
        comment.aclWrite(cac, payload, function(err) {
          if (err) {
            callback(err)
          } else {
            cac.save({ changedPaths: changedPaths }, function(err, modified) {
              callback(err, comment, modified)
            })
          }
        })
      }

    ]

    modules.db.sequencedWaterfall(tasks, 10, callback)

  },

  /**
     *
     * @param pac
     * @param commentId
     * @param path
     * @param value
     * @param options
     * @param callback -> err, comment, modified
     */
  commentUpdatePath: function(pac, commentId, path, value, options, callback) {

    if (_.isFunction(options)) {
      callback = options
      options = {}
    } else {
      options = options || {}
    }
    options.singlePath = path

    let payload

    // create a payload with ids inserted as arrays.
    try {
      payload = utils.pathToPayload(path, value)
    } catch (err) {
      callback(err)
      return
    }
    this.commentUpdate(pac, commentId, payload, options, function(err, comment, modified) {
      callback(err, comment, modified)
    })
  },

  /**
     *
     * @param pac
     * @param commentId
     * @param path
     * @param options
     *  skipAcl
     * @param callback -> err, comment, modified
     */
  commentRemovePath: function(pac, commentId, path, options, callback) {

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
      skipAcl: !!options.skipAcl || pac.principal.skipAcl,
      paths: [path]
    }

    const self = this
    let removedPath = utils.normalizeObjectPath(path, true, true, true),
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
      // load the comment. checking for access.
      function(callback) {

        options.paths = null
        self.commentReadOne(pac, commentId, options, callback)
      },

      // update
      function(comment, cac, parser, selections, callback) {
        if (!comment.isCommentCreator(cac.principal) && !options.skipAcl) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'access denied' }))
        } else {
          cac.method = 'put'
          comment.aclRemove(cac, path, function(err) {
            if (err) {
              callback(err)
            } else {
              cac.save({ changedPaths: [removedPath] }, function(err, modified) {
                callback(err, comment, modified)
              })
            }
          })
        }
      }

    ]
    modules.db.sequencedWaterfall(tasks, 10, callback)

  },

  /**
     * @param pac
     * @param commentId
     * @param options
     * @param callback -> err, comment
     */
  commentDelete: function(pac, commentId, options, callback) {

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
      skipAcl: !!options.skipAcl || pac.principal.skipAcl,
      scoped: utils.rBool(options.scoped, true)
    }

    let tasks = [

      // load the comment. checking for access.
      function(callback) {
        self.commentReadOne(pac, commentId, options, callback)
      },

      // delete
      function(comment, cac, parser, selections, callback) {

        if (options.scoped) {
          const requiredScope = `object.delete.comment${comment.type ? ('#' + comment.type) : ''}.${comment._id}`
          if (!modules.authentication.authInScope(pac.principal.scope, requiredScope)) {
            return callback(Fault.create('cortex.accessDenied.scope', { path: requiredScope }))
          }
        }

        if (!comment.isCommentCreator(cac.principal) && !options.skipAcl) {
          callback(Fault.create('cortex.accessDenied.unspecified', { reason: 'delete access denied' }))
        } else {
          cac.save(function(err) {
            callback(err, cac, comment)
          })
        }
      },

      // cleanup notifications & comments
      function(cac, comment, callback) {
        modules.db.models.Notification.collection.deleteMany({ 'context._id': cac.subjectId, 'meta.commentId': commentId }, { writeConcern: { w: 'majority' } }, function(err) {
          if (err) logger.error('error clearing comment notifications', { comment: commentId, error: err.toJSON() })
        })
        callback(null, comment)
      }
    ]

    modules.db.sequencedWaterfall(tasks, 10, callback)

  }

}

BaseCommentModel.indexes = [

  [{ 'facets._kl': 1 }, { name: 'idxDeletedFacets', partialFilterExpression: { 'facets._kl': true } }],
  [{ 'facets.pid': 1 }, { name: 'idxFacetInstanceId', partialFilterExpression: { 'facets.pid': { $exists: true } } }],
  [{ 'facets._pi': 1 }, { name: 'idxFacetPropertyId', partialFilterExpression: { 'facets._pi': { $exists: true } } }],
  [{ 'facets._pi': 1 }, { name: 'idxFacetPropertyId', partialFilterExpression: { 'facets._pi': { $exists: true } } }],
  [{ 'meta.up': 1, org: 1, object: 1 }, { name: 'idxMetadataUpdates' }],
  [{ 'pcontext.object': 1 }, { name: 'idxPostContextObject', partialFilterExpression: { 'pcontext.object': { $exists: true } } }]

]

// searchable and unique "indexed" properties index.
BaseCommentModel.indexes = BaseCommentModel.indexes.concat(modules.db.definitions.getIndexDefinitions())

module.exports = BaseCommentModel
