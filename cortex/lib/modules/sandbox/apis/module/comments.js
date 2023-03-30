'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils')

module.exports = {

  create: function(script, message, _id, body, options, callback) {

    options = utils.extend(script.allowedOptions(options, 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script,
      method: 'post'
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    modules.db.models.Post.postReadOne(script.ac.principal, _id, options, function(err, post, pac) {
      if (err) {
        return callback(err)
      }
      modules.db.models.Comment.commentCreate(pac, _.isObject(body) ? body : {}, options, function(err, cac) {
        if (err) {
          return callback(err)

        }
        modules.db.models.Comment.commentReadOne(pac, cac.comment._id, options, function(err, document) {
          callback(err, document)
        })
      })

    })

  },

  read: function(script, message, _id, options, callback) {

    // allow reading by id or by path.
    let path, parts

    if (_id) {
      if (!utils.isId(_id)) {
        parts = utils.normalizeObjectPath(String(_id).replace(/\//g, '.')).split('.')
        _id = parts[0]
        path = parts.slice(1).join('.')
      }
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectID or String path expected.' }))
    }

    options = utils.extend(script.allowedOptions(options, 'paths', 'expand', 'include', 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    const postOptions = utils.extend({}, options, { isComment: true, json: false, paths: ['_id'], include: null, expand: null })
    modules.db.models.Post.postReadOne(script.ac.principal, _id, postOptions, function(err, post, pac) {
      if (err) {
        return callback(err)
      }
      if (path) {

        modules.db.models.Comment.commentReadPath(pac, _id, path, options, function(err, result) {
          callback(err, result)

        })

      } else {

        modules.db.models.Comment.commentReadOne(pac, _id, options, function(err, document) {
          callback(err, document)
        })

      }

    })

  },

  update: function(script, message, _id, body, options, callback) {

    let path, parts

    if (_id) {
      if (!utils.isId(_id)) {
        parts = utils.normalizeObjectPath(String(_id).replace(/\//g, '.')).split('.')
        _id = parts[0]
        path = parts.slice(1).join('.')
      }
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectID or String path expected.' }))
    }

    options = utils.extend(script.allowedOptions(options, 'expand', 'include', 'paths', 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script,
      method: 'put'
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    const postOptions = utils.extend({}, options, { isComment: true, json: false, paths: ['_id'], include: null, expand: null })
    modules.db.models.Post.postReadOne(script.ac.principal, _id, postOptions, function(err, post, pac) {
      if (err) {
        return callback(err)
      }
      if (path) {

        modules.db.models.Comment.commentUpdatePath(pac, _id, path, body, options, function(err) {
          if (err) {
            callback(err)
          } else {
            modules.db.models.Comment.commentReadPath(pac, _id, path, options, function(err, result) {
              callback(err, result)
            })
          }
        })

      } else {

        modules.db.models.Comment.commentUpdate(pac, _id, _.isObject(body) ? body : {}, options, function(err) {
          if (err) {
            callback(err)
          } else {
            modules.db.models.Comment.commentReadOne(pac, _id, options, function(err, document) {
              callback(err, document)
            })
          }
        })
      }

    })

  },

  delete: function(script, message, _id, options, callback) {

    let path, parts

    if (_id) {
      if (!utils.isId(_id)) {
        parts = utils.normalizeObjectPath(String(_id).replace(/\//g, '.')).split('.')
        _id = parts[0]
        path = parts.slice(1).join('.')
      }
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectID or String path expected.' }))
    }

    options = utils.extend(script.allowedOptions(options, 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script,
      method: 'delete'
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    const postOptions = utils.extend({}, options, { isComment: true, json: false, paths: ['_id'], include: null, expand: null })
    modules.db.models.Post.postReadOne(script.ac.principal, _id, postOptions, function(err, post, pac) {

      if (err) {
        return callback(err)
      }

      if (path) {
        modules.db.models.Comment.commentRemovePath(pac, _id, path, options, function(err, ac, modified) {
          callback(err, !!modified && modified.length > 0)
        })
      } else {
        modules.db.models.Comment.commentDelete(pac, _id, options, function(err) {
          callback(err, true)
        })
      }

    })

  },

  push: function(script, message, _id, body, options, callback) {

    let path, parts

    if (_id) {
      if (!utils.isId(_id)) {
        parts = utils.normalizeObjectPath(String(_id).replace(/\//g, '.')).split('.')
        _id = parts[0]
        path = parts.slice(1).join('.')
      }
    } else {
      return callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'ObjectID or String path expected.' }))
    }

    options = utils.extend(script.allowedOptions(options, 'expand', 'include', 'paths', 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script,
      method: 'post'
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    const postOptions = utils.extend({}, options, { isComment: true, json: false, paths: ['_id'], include: null, expand: null })
    modules.db.models.Post.postReadOne(script.ac.principal, _id, postOptions, function(err, post, pac) {
      if (err) {
        return callback(err)
      }
      if (path) {

        modules.db.models.Comment.commentUpdatePath(pac, _id, path, body, options, function(err) {
          if (err) {
            callback(err)
          } else {
            modules.db.models.Comment.commentReadPath(pac, _id, path, options, function(err, result) {
              callback(err, result)
            })
          }
        })

      } else {

        modules.db.models.Comment.commentUpdate(pac, _id, _.isObject(body) ? body : {}, options, function(err) {
          if (err) {
            callback(err)
          } else {
            modules.db.models.Comment.commentReadOne(pac, _id, options, function(err, document) {
              callback(err, document)
            })
          }
        })
      }

    })

  }

}
