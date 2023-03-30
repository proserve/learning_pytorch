
const util = require('util'),
      _ = require('underscore'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      config = require('cortex-service/lib/config'),
      acl = require('../../../../acl'),
      consts = require('../../../../consts'),
      ModelDefinition = require('../model-definition'),
      ap = require('../../../../access-principal'),
      SetDefinition = require('../types/set-definition'),
      FacetsIndexDefinition = require('../facets-index-definition')

function CommentDefinition(postTypeDoc) {

  const commentBody = CommentDefinition.createBody(postTypeDoc),
        properties = CommentDefinition.getProperties()
  properties.push(new SetDefinition(utils.extend({}, commentBody, { forceId: true })))

  this._id = CommentDefinition.statics._id
  this.objectId = CommentDefinition.statics.objectId
  this.objectLabel = CommentDefinition.statics.objectLabel
  this.objectName = CommentDefinition.statics.objectName
  this.pluralName = CommentDefinition.statics.pluralName
  this.requiredAclPaths = CommentDefinition.statics.requiredAclPaths
  this.slots = postTypeDoc.commentSlots || []

  ModelDefinition.call(this, { name: 'comment', properties: properties })

}
util.inherits(CommentDefinition, ModelDefinition)

CommentDefinition.createBody = function(postTypeDoc) {

  // build the body from the comment type doc.

  const commentDocDefs = utils.array(postTypeDoc.comments).map(function(doc) {

    const segmentIdDef = {
            label: 'Segment Identifier',
            name: '_id',
            type: 'ObjectId',
            auto: true,
            readable: true
          },
          segmentNameDef = {
            label: doc.label,
            name: 'name',
            type: 'String',
            readable: true,
            creatable: true,
            minRequired: doc.minRequired,
            maxAllowed: doc.maxAllowed,
            nativeIndex: true
          },
          commentProperties = [segmentIdDef, segmentNameDef].concat(utils.array(doc.properties))

    return {
      forceId: true,
      name: doc.name,
      label: doc.label || '',
      type: 'Document',
      properties: commentProperties
    }

  })

  return {
    label: 'Comment Body',
    name: 'body',
    type: 'Set',
    // description: 'The array of configured feed definition segments, discriminated by name.',
    minItems: Math.min(config('feeds.maxSegments'), Math.max(1, utils.option(postTypeDoc, 'minCommentItems', 1))),
    maxItems: Math.min(config('feeds.maxSegments'), utils.option(postTypeDoc, 'maxCommentItems', config('feeds.maxSegments'))),
    readable: true,
    writable: true,
    canPush: true,
    canPull: true,
    discriminatorKey: 'name',
    documents: commentDocDefs
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
CommentDefinition.prototype.generateMongooseSchema = function(options) {

  options = options || {}

  options.registerModel = !!options.registerModel
  options.options = utils.extend({
    versionKey: 'sequence',
    collection: 'posts'
  }, options.options)
  options.statics = utils.extend({}, options.statics, CommentDefinition.statics) // can't overwrite base statics.
  options.methods = utils.extend({}, options.methods, CommentDefinition.methods) // can't overwrite base methods.
  options.indexes = options.indexes || [] // for now, indexes will only come in from the base post model.
  options.options.autoIndex = false

  options.statics.sequence = 0 // @todo. this'll need to be updated.
  options.statics.__CommentSchema__ = true

  return ModelDefinition.prototype.generateMongooseSchema.call(this, options)
}

// ------------------------------------

CommentDefinition.getProperties = function() {
  return [
    {
      label: 'Identifier',
      name: '_id',
      auto: true,
      type: 'ObjectId',
      // description: 'The comment identifier.',
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
      // description: 'The current caller\'s access level to the comment.',
      virtual: true,
      readable: true,
      readAccess: acl.AccessLevels.Min,
      dependencies: ['_id', 'creator'],
      reader: function(ac) {
        return ac ? ac.resolved : acl.AccessLevels.None
      }
    },
    {
      label: 'Type',
      name: 'type',
      type: 'String',
      // description: 'The type of post being created. The type determines how the post is handled depending on the object feed configuration',
      readable: true,
      nativeIndex: true
    },
    {
      label: 'Org',
      name: 'org',
      type: 'ObjectId',
      // description: 'The comment org.',
      public: false,
      readable: false
    },
    {
      label: 'Context',
      name: 'context',
      // description: 'The post in which the comment was created.',
      type: 'Reference',
      expandable: false,
      readable: true,
      writable: false,
      sourceObject: 'post'
    },
    {
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
    },
    {
      label: 'Post Context',
      name: 'pcontext',
      // description: 'The comment post's context',
      type: 'Reference',
      expandable: false,
      readable: false,
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
      // description: 'The account that created the comment.',
      readable: true,
      expandable: true,
      sourceObject: 'account',
      grant: acl.AccessLevels.Public,
      pacl: [{
        type: acl.AccessTargets.Account,
        target: acl.PublicIdentifier,
        allow: acl.AccessLevels.Read,
        paths: ['gender', 'age']
      }]
    },
    {
      label: 'Updated',
      name: 'updated',
      type: 'Date',
      // description: 'The date the comment was last updated.',
      readable: true
    },
    {
      label: 'Updater',
      name: 'updater',
      type: 'Reference',
      // description: 'The account that updated the comment.',
      readable: true,
      expandable: true,
      sourceObject: 'account',
      grant: acl.AccessLevels.Public,
      pacl: [{
        type: acl.AccessTargets.Account,
        target: acl.PublicIdentifier,
        allow: acl.AccessLevels.Read,
        paths: ['gender', 'age']
      }]
    },
    {
      label: 'Collect for Reaping',
      name: 'reap',
      type: 'Boolean',
      public: false,
      readable: false,
      default: false
    },
    {
      label: 'Votes',
      name: 'votes',
      type: 'Number',
      // description: 'Number of up votes on a comment.',
      readable: true,
      default: 0
    }, {
      label: 'Views',
      name: 'views',
      type: 'ObjectId',
      // description: 'For post types that support it, this field keeps track of comment viewers.',
      array: true,
      maxItems: -1,
      maxShift: false,
      public: false,
      readable: false
    }, {
      label: 'Voters',
      name: 'voters',
      type: 'ObjectId',
      // description: 'Accounts that upvoted the comment.',
      array: true,
      public: false,
      maxItems: -1,
      maxShift: false,
      readable: false
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
        var voted = !!value, is = utils.inIdArray(this.voters, ac.principalId)
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
      // description: 'The internal comment sequence number',
      default: 0,
      readable: false,
      public: false
    },
    modules.db.definitions.getInstanceIndexDefinition()
  ]
}

CommentDefinition.statics = {

  _id: consts.NativeObjects.comment,
  objectId: consts.NativeObjects.comment,
  objectLabel: 'Comment',
  objectName: 'comment',
  pluralName: 'comments',
  requiredAclPaths: ['_id', 'sequence', 'creator', 'updater', 'org', 'context', 'pcontext', 'object', 'meta']

}

CommentDefinition.methods = {

  isCommentSubject: function(including) {
    var self = this
    including = (_.isString(including) ? [including] : utils.array(including)).map(function(v) { return utils.normalizeObjectPath(v, true, true) }).filter(function(v) { return !!v })
    return _.every(this.constructor.requiredAclPaths.concat(including), function(path) { return self.isSelected(path) })
  },

  isCommentCreator: function(principal) {
    return ap.is(principal) && this.isSelected('creator') && utils.equalIds(principal._id, this.creator._id)
  }

}

module.exports = CommentDefinition
