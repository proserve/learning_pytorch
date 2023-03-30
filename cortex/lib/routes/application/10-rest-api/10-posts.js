'use strict'

const middleware = require('../../../middleware'),
      modules = require('../../../modules'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      logger = require('cortex-service/lib/logger'),
      utils = require('../../../utils')

module.exports = function(express, router, service) {

  service.on('started', () => {

    // when a conversation is updated, the patientId may have been set. sync patientId and accountId in posts
    modules.db.models.conversation.hook('update').after(function(vars) {
      // if patientFile was set, ensure all posts now have patientId / accountId properly set.
      if (~vars.modified.indexOf('patientFile')) {
        const patientFileId = utils.path(vars.ac.subject, 'patientFile._id')
        modules.db.models.patientfile.findOne({ _id: patientFileId }).lean().select({ account: 1 }).exec(function(err, doc) {
          if (!err && doc) {
            const update = { $set: { patientFile: { _id: patientFileId } } },
                  accountId = utils.getIdOrNull(doc.account)

            if (accountId) {
              update.$set.account = accountId
              update.$set.org = vars.ac.orgId
            }
            modules.db.models.post.collection.updateMany({ 'context._id': vars.ac.subjectId }, update, function(err) {
              if (err) logger.error('error updating patient/account id for conversation posts', Object.assign(utils.toJSON(err, { stack: true }), { conversationId: vars.ac.subjectId, patientFile: patientFileId }))
            })
          }
        })
      }
    })

  })

  /**
     * Post a Comment
     * @param req.params.id
     * @param req.body.body
     */
  router.post('/posts/:id/comments',
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      next(req.principal.isAnonymous() ? Fault.create('cortex.accessDenied.unspecified') : null) // legacy required auth.
    },
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        modules.db.models.comment.commentCreate(pac, req.body, { req: req }, function(err, cac) {
          if (err) {
            next(err)
            return
          }
          modules.db.models.comment.commentReadOne(pac, cac.comment._id, { req: req }, function(err, document) {
            utils.outputResults(res, err, document)
          })
        })
      })
    }
  )

  /**
     * Retrieve Comment
     */
  router.get('/comments/:id',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        const options = utils.extend(_.pick(req.query, 'expand', 'include', 'paths'), {
          req: req
        })
        modules.db.models.comment.commentReadOne(pac, req.params.id, options, function(err, document) {
          utils.outputResults(res, err, document)
        })

      })
    }
  )

  /**
     * Retrieve Comment Property
     */
  router.get('/comments/:id/*',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.')),
              options = utils.extend(_.pick(req.query, 'expand', 'include', 'paths'), {
                req: req
              })
        modules.db.models.comment.commentReadPath(pac, req.params.id, path, options, function(err, document) {
          utils.outputResults(res, err, document)
        })

      })
    }
  )

  /**
     * Update Comment
     */
  router.put('/comments/:id',
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        modules.db.models.comment.commentUpdate(pac, req.params.id, req.body, { req: req }, function(err) {
          if (err) {
            next(err)
            return
          }
          const options = utils.extend(_.pick(req.query, 'expand', 'include', 'paths'), {
            req: req
          })
          modules.db.models.comment.commentReadOne(pac, req.params.id, options, function(err, document) {
            utils.outputResults(res, err, document)
          })
        })
      })
    }
  )

  /**
     * Update Comment Property
     */
  router.put('/comments/:id/*',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
        modules.db.models.comment.commentUpdatePath(pac, req.params.id, path, req.body, { req: req }, function(err) {
          if (err) {
            next(err)
            return
          }
          modules.db.models.comment.commentReadPath(pac, req.params.id, path, { req: req }, function(err, value) {
            utils.outputResults(res, err, value)
          })
        })
      })
    }
  )

  /**
     * Append to Array
     */
  router.post('/comments/:id',
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        modules.db.models.comment.commentUpdate(pac, req.params.id, req.body, { req: req }, function(err) {
          if (err) {
            next(err)
            return
          }
          modules.db.models.comment.commentReadOne(pac, req.params.id, { req: req }, function(err, document) {
            utils.outputResults(res, err, document)
          })
        })
      })
    }
  )

  /**
     * Append to Property
     */
  router.post('/comments/:id/*',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
        modules.db.models.comment.commentUpdatePath(pac, req.params.id, path, req.body, { req: req }, function(err) {
          if (err) {
            next(err)
            return
          }
          modules.db.models.comment.commentReadPath(pac, req.params.id, path, { req: req }, function(err, value) {
            utils.outputResults(res, err, value)
          })
        })
      })
    }
  )

  /**
     * Delete Comment Property
     */
  router.delete('/comments/:id/*',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
        modules.db.models.comment.commentRemovePath(pac, req.params.id, path, { req: req }, function(err, comment, modified) {
          utils.outputResults(res, err, !!modified && modified.length > 0)
        })
      })
    }
  )

  /**
     * Delete Comment
     */
  router.delete('/comments/:id',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      modules.db.models.post.postReadOne(req.principal, req.params.id, { isComment: true, req: req, json: false, paths: ['_id'] }, function(err, post, pac) {
        if (err) {
          next(err)
          return
        }
        modules.db.models.comment.commentDelete(pac, req.params.id, { req: req }, function(err) {
          utils.outputResults(res, err, true)
        })
      })
    }
  )

  /**
     * List Posts
     * @param req.query.unviewed (Boolean:false) Only posts unread by the caller are returned
     * @param req.query.creator (ObjectId) Limits the results to those posts created by the specified account id. Cannot be combined with the "filterCaller" argument, which it supercedes.
     * @param req.query.filterCaller (Boolean:false) Set to true to filter out posts created by the caller. Cannot be combined with the "creator" argument, by which it is superseded.
     * @param req.query.patientFile (ObjectId) Limits the results to those involving the specified patient. Cannot be combined with the "account" argument, which it supersedes.
     * @param req.query.account (ObjectId) Limits the results to those involving the specified account. Cannot be combined with the "patientFile" argument, by which it is superseded.
     * @param req.query.participants (ObjectId[]) A list of post targets. Only targeted posts where all the participants are included will be returned.
     * @param req.query.objects (String[]) A list of object names to which the results are limited (eg. conversation)
     * @param req.query.postTypes (String) A comma-delimited list of post types to include/exclude. to exclude a list of post types, prepend the list with a \'-\' character.
     * @param req.query.expand
     * @param req.query.include
     * @param req.query.paths
     * @param req.query.limit
     * @param req.query.startingAfter
     * @param req.query.endingBefore
     * @param req.query.map
     * @param req.query.group
     * @param req.query.sort
     * @param req.query.skip
     * @param req.query.pipeline
     */
  router.get('/posts',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      const options = utils.extend(_.pick(req.query, 'account', 'creator', 'patientFile', 'participants', 'objects', 'postTypes', 'startingAfter', 'endingBefore', 'limit', 'paths', 'include', 'expand', 'where', 'map', 'group', 'sort', 'skip', 'pipeline'), {
        unviewed: utils.stringToBoolean(utils.path(req.query, 'unviewed')),
        filterCaller: utils.stringToBoolean(utils.path(req.query, 'filterCaller')),
        req: req
      })

      modules.db.models.post.postList(req.principal, options, function(err, posts, parser, selections) {
        utils.outputResults(res, err, posts)
      })

    }
  )

  /**
     * Retrieve Post
     */
  router.get('/posts/:id',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      const options = utils.extend(_.pick(req.query, 'expand', 'include', 'paths'), {
        req: req
      })
      modules.db.models.post.postReadOne(req.principal, req.params.id, options, function(err, document) {
        utils.outputResults(res, err, document)
      })
    }
  )

  /**
     * Retrieve Post Property
     */
  router.get('/posts/:id/*',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.')),
            options = utils.extend(_.pick(req.query, 'expand', 'include', 'paths'), {
              req: req
            })
      modules.db.models.post.postReadPath(req.principal, req.params.id, path, options, function(err, document) {
        utils.outputResults(res, err, document)
      })
    }
  )

  /**
     * Update Post
     */
  router.put('/posts/:id',
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      modules.db.models.post.postUpdate(req.principal, req.params.id, req.body, { req: req }, function(err) {
        if (err) {
          next(err)
        } else {
          modules.db.models.post.postReadOne(req.principal, req.params.id, { req: req }, function(err, document) {
            utils.outputResults(res, err, document)
          })
        }

      })
    }
  )

  /**
     * Append to Post Array
     */
  router.post('/posts/:id',
    middleware.body_parser.runtime.strict,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      modules.db.models.post.postUpdate(req.principal, req.params.id, req.body, { req: req }, function(err) {
        if (err) {
          next(err)
        } else {
          modules.db.models.post.postReadOne(req.principal, req.params.id, { req: req }, function(err, document) {
            utils.outputResults(res, err, document)
          })
        }
      })
    }
  )

  /**
     * Update Post Property
     */
  router.put('/posts/:id/*',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
      modules.db.models.post.postUpdatePath(req.principal, req.params.id, path, req.body, { req: req }, function(err) {
        if (err) {
          next(err)
        } else {
          modules.db.models.post.postReadPath(req.principal, req.params.id, path, { req: req }, function(err, value) {
            utils.outputResults(res, err, value)
          })
        }
      })
    }
  )

  /**
     * Append to Post Property
     */
  router.post('/posts/:id/*',
    middleware.body_parser.runtime.loose,
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {
      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
      modules.db.models.post.postUpdatePath(req.principal, req.params.id, path, req.body, { req: req }, function(err) {
        if (err) {
          next(err)
        } else {
          modules.db.models.post.postReadPath(req.principal, req.params.id, path, { req: req }, function(err, value) {
            utils.outputResults(res, err, value)
          })
        }
      })
    }
  )

  /**
     * Delete Post Property
     */
  router.delete('/posts/:id/*',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      const path = utils.normalizeObjectPath(req.params[0].replace(/\//g, '.'))
      modules.db.models.post.postRemovePath(req.principal, req.params.id, path, { req: req }, function(err, ac, modified) {
        utils.outputResults(res, err, !!modified && modified.length > 0)
      })
    }
  )

  /**
     * Delete Post
     */
  router.delete('/posts/:id',
    middleware.client_detection.default,
    middleware.authorize.anonymous,
    middleware.policy,
    function(req, res, next) {

      modules.db.models.post.postDelete(req.principal, req.params.id, { req: req }, function(err) {
        utils.outputResults(res, err, true)
      })
    }
  )

}
