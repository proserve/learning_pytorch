'use strict'

const util = require('util'),
      clone = require('clone'),
      _ = require('underscore'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../../modules'),
      utils = require('../../../../utils'),
      ap = require('../../../../access-principal'),
      config = require('cortex-service/lib/config'),
      logger = require('cortex-service/lib/logger'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition'),
      SetDefinition = require('../types/set-definition'),
      AclDefinition = require('../acl-definition'),
      FacetsIndexDefinition = require('../facets-index-definition'),
      CommentDefinition = require('./comment-definition')

function PostDefinition(postTypeDoc) {

  const postBody = PostDefinition.createBody(postTypeDoc),
        properties = PostDefinition.getProperties()

  properties.push(new SetDefinition(utils.extend({}, postBody, { forceId: true })))

  this.requiredAclPaths = PostDefinition.statics.requiredAclPaths
  this._id = PostDefinition.statics._id
  this.objectId = PostDefinition.statics.objectId
  this.objectLabel = PostDefinition.statics.objectLabel
  this.objectName = PostDefinition.statics.objectName
  this.pluralName = PostDefinition.statics.pluralName
  this.commentDefinition = new CommentDefinition(postTypeDoc)
  this.slots = postTypeDoc.postSlots || []

  ModelDefinition.call(this, { name: 'post', properties: properties })

  let postOptions = PostDefinition.createOptions(postTypeDoc)
  for (let prop in postOptions) {
    if (postOptions.hasOwnProperty(prop)) {
      this[prop] = postOptions[prop]
    }
  }

}
util.inherits(PostDefinition, ModelDefinition)

PostDefinition.prototype.apiSchema = function(options) {

  if (!this.active) {
    return null
  }

  const schema = ModelDefinition.prototype.apiSchema.call(this, options)

  if (utils.option(options, 'asRoot')) {
    return schema
  }

  schema.type = 'Document[]'
  delete schema.name
  schema.read = this.contextReadAccess
  schema.create = this.contextCreateAccess
  schema.postType = this.postType

  if (this.allowComments) schema.allowComments = true
  if (this.notifications) schema.notifications = true
  if (this.trackViews) schema.trackViews = true
  if (this.editable) schema.editable = true
  if (this.deletable) schema.deletable = true

  schema.contextReadAcl = this.contextReadAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry })
  schema.postCreateAcl = this.postCreateAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry })
  schema.postInstanceAcl = this.postInstanceAcl.map(function(entry) { entry = clone(entry); delete entry._id; return entry })

  schema.properties = schema.properties.filter(function(p) { return p.name !== 'comments' })

  if (!this.allowComments || !this.commentDefinition.properties || !Object.keys(this.commentDefinition.properties).length) {
    schema.comments = []
  } else {
    schema.comments = this.commentDefinition.apiSchema(options).properties
  }

  return schema

}

PostDefinition.createBody = function(postTypeDoc) {

  // build the body from the post type doc.

  const bodyDocDefs = utils.array(postTypeDoc.body).map(function(doc) {

    const segmentIdDef = {
            label: 'Segment Identifier',
            name: '_id',
            type: 'ObjectId',
            auto: true,
            readable: true,
            nativeIndex: true
          },
          segmentNameDef = {
            label: doc.label,
            name: 'name',
            type: 'String',
            readable: true,
            creatable: true,
            nativeIndex: true,
            minRequired: doc.minRequired,
            maxAllowed: doc.maxAllowed
          },
          bodyProperties = [segmentIdDef, segmentNameDef].concat(utils.array(doc.properties))

    return {
      forceId: true,
      name: doc.name,
      label: doc.label || '',
      type: 'Document',
      properties: bodyProperties
    }

  })

  return {
    label: 'Body',
    name: 'body',
    // description: 'The array of configured feed definition segments, discriminated by name.',
    type: 'Set',
    minItems: Math.min(config('feeds.maxSegments'), Math.max(0, utils.option(postTypeDoc, 'minItems', 0))),
    maxItems: Math.min(config('feeds.maxSegments'), utils.option(postTypeDoc, 'maxItems', config('feeds.maxSegments'))),
    readable: true,
    writable: true,
    canPush: true,
    canPull: true,
    discriminatorKey: 'name',
    documents: bodyDocDefs
  }

}

PostDefinition.createOptions = function(feedDoc) {

  feedDoc = feedDoc || {}

  return {
    label: feedDoc.label || '',
    contextReadAccess: acl.fixAllowLevel(feedDoc.contextReadAccess, true, acl.AccessLevels.Connected),
    contextCreateAccess: acl.fixAllowLevel(feedDoc.contextCreateAccess, true, acl.AccessLevels.Connected),
    active: utils.rBool(feedDoc.active, true),
    postType: feedDoc.postType,
    postTypeId: feedDoc.postTypeId || feedDoc._id,
    allowComments: utils.rBool(feedDoc.allowComments, true),
    notifications: utils.rBool(feedDoc.notifications, false),
    trackViews: utils.rBool(feedDoc.trackViews, false),
    editable: utils.rBool(feedDoc.editable, true),
    deletable: utils.rBool(feedDoc.deletable, true),
    contextReadAcl: acl.mergeAndSanitizeEntries(feedDoc.contextReadAcl),
    postCreateAcl: acl.mergeAndSanitizeEntries(feedDoc.postCreateAcl),
    postInstanceAcl: acl.mergeAndSanitizeEntries(feedDoc.postInstanceAcl)
  }

}

/**
 *
 * @param options
 *  registerModel: false
 *
 *
 * @returns {*}
 */
PostDefinition.prototype.generateMongooseSchema = function(options) {

  const postOptions = PostDefinition.createOptions(this) // get clean options to apply to the schema statics.

  options = options || {}

  options.registerModel = !!options.registerModel
  options.options = utils.extend({
    versionKey: 'sequence',
    collection: 'posts'
  }, options.options)
  options.statics = utils.extend({}, options.statics, postOptions, PostDefinition.statics) // can't overwrite base statics.
  options.methods = utils.extend({}, options.methods, PostDefinition.methods) // can't overwrite base methods.
  options.indexes = options.indexes || [] // for now, indexes will only come in from the base post model.
  options.options.autoIndex = false

  options.statics.sequence = postOptions.sequence || 0
  options.statics.__PostSchema__ = true
  options.statics.commentDefinition = this.commentDefinition

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

// ------------------------------------

PostDefinition.getProperties = function() {
  return [
    {
      label: 'Identifier',
      name: '_id',
      auto: true,
      type: 'ObjectId',
      // description: 'The post identifier.',
      readable: true,
      nativeIndex: true
    },
    {
      label: 'Created',
      name: 'created',
      type: 'Date'
    },
    {
      label: 'Object',
      name: 'object',
      type: 'String',
      readable: true
    },
    {
      label: 'Access Level',
      name: 'access',
      type: 'Number',
      // description: 'The current caller\'s access level to the post.',
      virtual: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      dependencies: ['_id'],
      reader: function(ac) {
        return ac ? ac.resolved : acl.AccessLevels.None
      }
    }, {
      label: 'Org',
      name: 'org',
      type: 'ObjectId',
      // description: 'The post org',
      public: false,
      readable: false
    }, {
      label: 'Context',
      name: 'context',
      // description: 'The context in which the post was created.',
      type: 'Reference',
      nativeIndex: true,
      objectIndexed: true,
      expandable: true,
      readable: true,
      writable: false
    },
    new FacetsIndexDefinition({
      label: 'Facets Index',
      name: 'facets'
    }),
    {
      label: 'Creator',
      name: 'creator',
      type: 'Reference',
      // description: 'The account that created the post.',
      readable: true,
      expandable: true,
      sourceObject: 'account',
      nativeIndex: true,
      grant: acl.AccessLevels.Public,
      pacl: [{
        type: acl.AccessTargets.Account,
        target: acl.PublicIdentifier,
        allow: acl.AccessLevels.Read,
        paths: ['gender', 'age']
      }]
    }, {
      label: 'Updated',
      name: 'updated',
      type: 'Date',
      // description: 'The date the post was last updated.',
      readable: true
    }, {
      label: 'Updater',
      name: 'updater',
      type: 'Reference',
      // description: 'The account that updated the post.',
      readable: true,
      expandable: true,
      sourceObject: 'account',
      nativeIndex: true,
      grant: acl.AccessLevels.Public,
      pacl: [{
        type: acl.AccessTargets.Account,
        target: acl.PublicIdentifier,
        allow: acl.AccessLevels.Read,
        paths: ['gender', 'age']
      }]
    }, {
      label: 'Type',
      name: 'type',
      type: 'String',
      readable: true,
      nativeIndex: true
    }, {
      label: 'Collect for Reaping',
      name: 'reap',
      type: 'Boolean',
      public: false,
      readable: false,
      default: false
    }, {
      label: 'Account',
      name: 'account',
      type: 'Reference',
      // description: 'The Account associated with the post. In Patient Files and Conversation, this is the account of the associated patient.',
      readable: true,
      nativeIndex: true,
      expandable: true,
      sourceObject: 'account',
      grant: acl.AccessLevels.Public,
      pacl: [{
        type: acl.AccessTargets.Account,
        target: acl.PublicIdentifier,
        allow: acl.AccessLevels.Read,
        paths: ['gender', 'age']
      }]
    }, {
      label: 'Patient File',
      name: 'patientFile',
      type: 'Reference',
      // description: 'The Patient File associated with the post.',
      nativeIndex: true,
      readable: true,
      expandable: true,
      public: false,
      sourceObject: 'patientfile',
      grant: acl.AccessLevels.Public
    }, {
      label: 'Views',
      name: 'views',
      type: 'ObjectId',
      // description: 'For post types that support it, this field keeps track of post viewers.',
      array: true,
      maxItems: -1,
      maxShift: false,
      public: false,
      readable: false
    }, {
      label: 'Targeted',
      name: 'targeted',
      type: 'Boolean',
      // description: 'True is the post has been explicitly targeted.',
      virtual: true,
      dependencies: ['targets'],
      reader: function() {
        return this.targets.length > 1
      }
    }, {
      label: 'Targets',
      name: 'targets',
      type: 'Document',
      // description: 'The targets of the post. Adding targets limits visibility to selected accounts and roles. The post creator is always included as a target.',
      array: true,
      maxItems: 20,
      maxShift: false,
      canPush: true,
      canPull: true,
      dependencies: ['targets', 'targeted', 'creator'],
      readAccess: acl.AccessLevels.Share,
      writeAccess: acl.AccessLevels.Share,
      readable: true,
      writable: true,
      puller: function(ac, node, value) {
        const doc = utils.findIdInArray(this.targets, 'target', value)
        if (!doc) {
          throw Fault.create('cortex.notFound.unspecified', { reason: 'target not found' })
        } else if (utils.equalIds(value, this.creator._id)) {
          throw Fault.create('cortex.accessDenied.unspecified', { reason: 'post creator cannot be removed' })
        }
        ac.markSafeToUpdate(node)
        return value
      },
      pusher: function(ac, node, values, options, callback) {
        node.writer.call(this, ac, node, values, options, callback)
      },
      writer: function(ac, node, values, options, callback) {
        let current = this.targets, // ensure elements are unique.
            len = values.length,
            target,
            type
        while (len--) {
          target = utils.getIdOrNull(utils.path(values[len], 'target')); type = utils.path(values[len], 'type')
          if (utils.findIdInArray(current, 'target', target)) {
            values.splice(len, 1)
            continue
          }
          if (!target) {
            callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post target. Expected an ObjectId.' }))
            return
          }
          if (type === acl.AccessTargets.OrgRole) {
            if (!utils.findIdInArray(ac.org.roles, '_id', target)) {
              callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post target. Role does not exist.' }))
              return
            }
          } else if (type !== acl.AccessTargets.Account) {
            callback(Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post target. Only account and role targets are supported as post targets.' }))
            return
          }
        }

        // check for accounts. for right now, only care that we're an account in the org.
        const ids = utils.getIdArray(values.filter(function(v) { return v.type === acl.AccessTargets.Account }).map(function(v) { return v.target }))
        if (ids.length === 0) {
          callback(null, values)
          return
        }
        modules.db.models.Account.find({ _id: { $in: ids }, org: ac.orgId, reap: false, object: 'account' }).lean().select('_id').exec(function(err, docs) {
          if (!err) {
            const diff = utils.diffIdArrays(ids, docs.map(function(v) { return v._id }))
            if (diff.length > 0) {
              err = Fault.create('cortex.invalidArgument.unspecified', { reason: 'Invalid post target. One or more account post targets are invalid: ' + diff.toString() })
            }
          }
          callback(err, values)
        })

      },
      properties: [{
        label: 'Identifier',
        name: '_id',
        type: 'ObjectId',
        // description: 'The target entry identifier',
        auto: true,
        dependencies: ['..targets', '..creator'],
        reader: function(ac) {
          return utils.equalIds(this.target, ac.post.creator._id) ? undefined : this._id
        }
      }, {
        label: 'Target',
        name: 'target',
        type: 'ObjectId',
        // description: 'The post target role or account identifier',
        validators: [{
          name: 'required'
        }],
        dependencies: ['..targets', '..creator'],
        readable: true,
        writable: true,
        auditable: true,
        reader: function(ac) {
          return utils.equalIds(this.target, ac.post.creator._id) ? undefined : this.target
        }
      }, {
        label: 'Type',
        name: 'type',
        type: 'Number',
        // description: 'The target type: Account (1) or Role (3))',
        readable: true,
        writable: true,
        reader: function(ac) {
          return utils.equalIds(this.target, ac.post.creator._id) ? undefined : this.type
        },
        dependencies: ['..targets', '..creator'],
        validators: [{
          name: 'required'
        }, {
          name: 'numberEnum',
          definition: {
            values: [acl.AccessTargets.Account, acl.AccessTargets.OrgRole]
          }
        }]
      }]
    }, {
      label: 'System Metadata',
      name: 'meta',
      type: 'Document',
      readable: false,
      writable: false,
      properties: [{
        label: 'Updates',
        description: 'See consts.metadata.updateBits.documentSize',
        name: 'up',
        array: true,
        type: 'Number'
      }, {
        label: 'BSON Size',
        description: 'Calculated on creation and updated on a schedule',
        name: 'sz',
        type: 'Number',
        default: 0
      }]
    }, {
      label: 'Connection/Context Cache',
      name: 'ctx',
      type: 'Document',
      // description: 'A cache of the latest context acl for optimized post lookups.',
      public: false,
      readable: false,
      properties: [{
        label: 'Creator',
        name: 'creator',
        type: 'ObjectId'
      }, {
        label: 'Owner',
        name: 'owner',
        type: 'ObjectId'
      }, new AclDefinition({
        label: 'Acl',
        name: 'acl',
        type: 'Document',
        public: false,
        array: true,
        maxItems: -1
      }),
      {
        label: 'Aclv',
        name: 'aclv',
        type: 'Number'
      }]
    }, {
      label: 'Votes',
      name: 'votes',
      type: 'Number',
      // description: 'Number of up votes on a post.',
      readable: true,
      default: 0
    }, {
      label: 'Voters',
      name: 'voters',
      type: 'ObjectId',
      // description: 'Accounts that upvoted the post.',
      array: true,
      public: false,
      readable: false,
      maxItems: -1,
      maxShift: false
    }, {
      label: 'Voted',
      name: 'voted',
      type: 'Boolean',
      // description: 'True if the calling principal has voted up the post.',
      dependencies: ['voters'],
      readable: true,
      virtual: true,
      reader: function(ac) {
        return utils.inIdArray(this.voters, ac.principalId)
      },
      writable: true,
      writeAccess: acl.AccessLevels.Read,
      writer: function(ac, node, value) {
        const voted = !!value, is = utils.inIdArray(this.voters, ac.principalId)
        if (is !== voted) {
          if (voted) {
            this.voters.addToSet(ac.principalId)
          } else {
            this.voters.pull(ac.principalId)
          }
        }
        return undefined
      }
    }, {
      label: 'Sequence',
      name: 'sequence',
      type: 'Number',
      // description: 'The internal post sequence number',
      default: 0,
      readable: false,
      public: false
    }, {
      label: 'Comments',
      name: 'comments',
      type: 'Any',
      apiType: 'Reference[]',
      virtual: true,
      optional: true,
      readable: true,
      groupReader: function(node, principal, entries, req, script, selection, callback) {

        const isProjection = !!selection.runtimeProcessor
        if (isProjection) {
          selection = selection.runtimeProcessor(node, principal, entries, req, script, selection)
        }

        let query = isProjection ? selection.projection : utils.dotPath(utils.path(req, 'query'), selection.fullPath),
            postAcs = entries.map(function(v) { return v.ac }),
            readOpts = _.pick(query, 'unviewed', 'startingAfter', 'endingBefore', 'limit', 'where', 'map', 'group', 'sort', 'skip')

        readOpts.unviewed = utils.stringToBoolean(query.unviewed)
        readOpts.req = req
        readOpts.script = script

        readOpts.selectionTree = selection

        // set options at this level.
        selection.setOption('deferGroupReads', false)
        selection.setOption('forgiving', false)

        // list comments as aggregate, then  add each list to the map.
        modules.db.models.Comment.commentList(postAcs, readOpts, function(err, map) {
          if (!err) {
            entries.forEach(function(entry) {
              const result = map.data[entry.output._id] || {
                object: 'list',
                data: [],
                hasMore: false
              }
              utils.path(entry.output, node.docpath, result)
            })
          }
          callback(err)
        })
      }

    },
    modules.db.definitions.getInstanceIndexDefinition()
  ]
}

PostDefinition.statics = {

  _id: consts.NativeObjects.post,
  objectId: consts.NativeObjects.post,
  objectLabel: 'Post',
  objectName: 'post',
  pluralName: 'posts',

  requiredAclPaths: ['_id', 'sequence', 'ctx', 'targets', 'creator', 'updater', 'org', 'context', 'object', 'meta'],

  getCommentModel: function(throwErr) {

    if (!this.commentModel) {
      try {
        this.commentModel = this.commentDefinition.generateMongooseModel('posts')
      } catch (err) {
        logger.error('comment model construction failure', err.toJSON())
        if (throwErr) {
          throw err
        }
      }
      this.commentModel.parentObject = this.parentObject
      this.commentModel.postType = this.postType
      this.commentModel.postTypeId = this.postTypeId
    }
    return this.commentModel
  }

}

PostDefinition.methods = {

  isPostSubject: function(including) {
    const self = this
    including = (_.isString(including) ? [including] : utils.array(including)).map(function(v) { return utils.normalizeObjectPath(v, true, true) }).filter(function(v) { return !!v })
    return _.every(this.constructor.requiredAclPaths.concat(including), function(path) { return self.isSelected(path) })
  },

  isPostCreator: function(principal) {
    return ap.is(principal) && this.isSelected('creator') && utils.equalIds(principal._id, this.creator._id)
  }

}

module.exports = PostDefinition
