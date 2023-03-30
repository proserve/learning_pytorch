'use strict'

const _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      acl = require('../../../../acl'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils')

module.exports = {

  create: function(script, message, pluralName, _id, postType, body, payloadOptions, callback) {

    pluralName = String(pluralName).toLowerCase().trim()

    script.ac.org.createObject(pluralName, function(err, object) {

      if (err) {
        return callback(err)
      }

      const options = utils.extend(script.allowedOptions(payloadOptions, 'grant'), {
        req: script.ac.req,
        script
      })
      if (options.grant) {
        options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
      }

      modules.db.models.Post.postCreate(script.ac.principal, object, _id, postType, _.isObject(body) ? body : {}, options, function(err, pac) {
        if (err) {
          return callback(Fault.from(err))
        }
        modules.db.models.Post.postReadOne(pac.principal, pac.postId, options, function(err, document) {
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

    options = utils.extend(script.allowedOptions(options, 'paths', 'include', 'expand',
      'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      script
    })

    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    if (path) {

      modules.db.models.Post.postReadPath(script.ac.principal, _id, path, options, function(err, result) {
        callback(err, result)
      })

    } else {

      modules.db.models.Post.postReadOne(script.ac.principal, _id, options, function(err, document) {
        callback(err, document)
      })

    }

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

    options = utils.extend(script.allowedOptions(options, 'expand', 'include', 'paths',
      'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      method: 'put',
      script
    })

    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    if (path) {

      modules.db.models.Post.postUpdatePath(script.ac.principal, _id, path, body, options, function(err) {
        if (err) {
          callback(err)
        } else {
          modules.db.models.Post.postReadPath(script.ac.principal, _id, path, options, function(err, result) {
            callback(err, result)
          })
        }
      })

    } else {

      modules.db.models.Post.postUpdate(script.ac.principal, _id, _.isObject(body) ? body : {}, options, function(err) {
        if (err) {
          callback(err)
        } else {
          modules.db.models.Post.postReadOne(script.ac.principal, _id, options, function(err, document) {
            callback(err, document)
          })
        }
      })

    }

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
      method: 'delete',
      script
    })
    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    if (path) {
      modules.db.models.Post.postRemovePath(script.ac.principal, _id, path, options, function(err, ac, modified) {
        callback(err, !!modified && modified.length > 0)
      })

    } else {

      modules.db.models.Post.postDelete(script.ac.principal, _id, options, function(err) {
        callback(err, true)
      })
    }

  },

  list: function(script, message, options, callback) {

    options = utils.extend(script.allowedOptions(options, 'account', 'creator', 'patientFile', 'participants', 'objects', 'postTypes', 'startingAfter',
      'endingBefore', 'limit', 'paths', 'include', 'expand', 'where', 'map', 'group', 'sort', 'skip',
      'pipeline', 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant', 'unviewed', 'filterCaller'), {
      req: script.ac.req,
      script
    })

    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }
    options.unviewed = utils.stringToBoolean(options.unviewed)
    options.filterCaller = utils.stringToBoolean(options.filterCaller)

    modules.db.models.Post.postList(script.ac.principal, options, function(err, posts, parser, selections) {
      callback(err, posts)
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

    options = utils.extend(script.allowedOptions(options, 'trackViews', 'clearNotifications', 'skipAcl', 'skipTargeting', 'grant'), {
      req: script.ac.req,
      method: 'post',
      script
    })

    if (options.grant) {
      options.grant = Math.min(acl.fixAllowLevel(options.grant, true), acl.AccessLevels.Script)
    }

    if (path) {

      modules.db.models.Post.postUpdatePath(script.ac.principal, _id, path, body, options, function(err) {
        if (err) {
          callback(err)
        } else {
          modules.db.models.Post.postReadPath(script.ac.principal, _id, path, options, function(err, result) {
            callback(err, result)
          })
        }
      })

    } else {

      modules.db.models.Post.postUpdate(script.ac.principal, _id, _.isObject(body) ? body : {}, options, function(err) {
        if (err) {
          callback(err)
        } else {
          modules.db.models.Post.postReadOne(script.ac.principal, _id, options, function(err, document) {
            callback(err, document)
          })
        }
      })

    }

  }

}
