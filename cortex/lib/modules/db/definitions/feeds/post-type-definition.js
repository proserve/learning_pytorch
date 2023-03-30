'use strict'

const util = require('util'),
      utils = require('../../../../utils'),
      modules = require('../../../../modules'),
      acl = require('../../../../acl'),
      config = require('cortex-service/lib/config'),
      DocumentDefinition = require('../types/document-definition'),
      AclDefinition = require('../acl-definition'),
      PropertySetDefinition = require('../property-set-definition'),
      ObjectSlotsDefinition = require('../object-slots-definition')

function PostTypeDefinition() {

  DocumentDefinition.call(this, {

    label: 'Feed Configuration',
    name: 'feedDefinition',
    type: 'Document',
    // description: 'The object\'s feed configuration.',
    readable: true,
    array: true,
    maxItems: 20,
    canPush: true,
    canPull: true,
    dependencies: ['deletedFeeds', 'deletedProperties'],
    onRemovingValue: function(ac, node, value) {
      const deletedFeeds = this.deletedFeeds || (this.deletedFeeds = [])
      deletedFeeds.push({ _id: value._id, name: value.postType })
      ac.hook('save').after(function() {
        modules.workers.runNow('instance-reaper')
      }, 'reap-object-types', true)
    },
    puller: function(ac, node, value) {
      const feed = utils.findIdInArray(utils.path(this, node.fullpath), '_id', value)
      if (feed) {
        ac.hook('save').before(function(vars, callback) {
          if (~vars.modified.indexOf(node.fullpath)) {
            if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
              ac.object.fireHook('feed.removed.before', null, { ac: ac, feed: feed }, callback)
            }
          }
        })
        ac.hook('save').after(function(vars) {
          if (~vars.modified.indexOf(node.fullpath)) {
            if (!~utils.array(utils.path(ac.subject, node.fullpath)).indexOf(value)) {
              ac.object.fireHook('feed.removed.after', null, { ac: ac, feed: feed }, () => {})
            }
          }
        })
      }
      return value
    },
    properties: [
      {
        label: 'Post Configuration Identifier',
        name: '_id',
        auto: true,
        type: 'ObjectId',
        // description: 'The post configuration identifier.',
        readable: true
      },
      {
        label: 'Label',
        name: 'label',
        type: 'String',
        // description: 'The post type label.',
        readable: true,
        writable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'printableString',
          definition: { min: 1, max: 100, anyFirstLetter: false }
        }]
      },
      {
        label: 'Read Access',
        name: 'contextReadAccess',
        type: 'Number',
        // description: 'The level of access the caller must have to the post\'s context in order to read a post feed.',
        dependencies: ['.contextCreateAccess'],
        readable: true,
        writable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'allowLevel'
        }, {
          name: 'adhoc',
          definition: {
            message: 'Read access must be lesser than or equal to write access.',
            validator: function(ac, node, value) {
              return value <= this.contextCreateAccess
            }
          }
        }],
        default: acl.AccessLevels.Connected
      },
      {
        label: 'Create Access',
        name: 'contextCreateAccess',
        type: 'Number',
        // description: 'The level of access the caller must have to the post\'s context in order to create posts in the feed.',
        dependencies: ['.contextReadAccess'],
        readable: true,
        writable: true,
        validators: [{
          name: 'required'
        }, {
          name: 'allowLevel'
        }, {
          name: 'adhoc',
          definition: {
            message: 'Create access must be greater than or equal to read access.',
            validator: function(ac, node, value) {
              return value >= this.contextReadAccess
            }
          }
        }],
        default: acl.AccessLevels.Connected
      },
      {
        label: 'Active',
        name: 'active',
        type: 'Boolean',
        // description: 'If false, new posts of this type cannot be made, though existing one can be read.',
        readable: true,
        writable: true,
        default: true
      },
      {
        label: 'Deployment Identifiers',
        name: 'did',
        type: 'ObjectId',
        readable: false,
        array: true
      },
      {
        label: 'Post type',
        name: 'postType',
        type: 'String',
        // description: 'The post type.',
        readable: true,
        writable: true,
        lowercase: true,
        trim: true,
        dependencies: ['deletedFeeds'],
        validators: [{
          name: 'required'
        }, {
          name: 'customName'
        }, {
          name: 'uniqueInArray'
        }, {
          name: 'adhoc',
          definition: {
            message: 'This type name is not available for use.',
            validator: function(ac, node, value) {
              return !~utils.array(modules.db.getRootDocument(this).deletedFeeds).map(t => t.name).indexOf(value)
            }
          }
        }],
        writer: function(ac, node, v) {
          return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
        }
      },
      {
        label: 'Minimum Segments',
        name: 'minItems',
        type: 'Number',
        // description: 'The minimum number of post segments required to create a post of this type.',
        readable: true,
        writable: true,
        validators: [{
          name: 'number',
          definition: { min: 0, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
        }],
        default: 1
      },
      {
        label: 'Maximum Segments',
        name: 'maxItems',
        type: 'Number',
        // description: 'The maximum number of post segments allowed in a post of this type',
        dependencies: ['.minItems'],
        readable: true,
        writable: true,
        default: config('feeds.maxSegments'),
        stub: config('feeds.maxSegments'),
        validators: [{
          name: 'number',
          definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
        }, {
          name: 'adhoc',
          definition: {
            message: 'maxItems must be >= minItems',
            validator: function(ac, node, value) {
              return value >= this.minItems
            }
          }
        }]
      },
      {
        label: 'Allow Comments',
        name: 'allowComments',
        type: 'Boolean',
        // description: 'Allow comments on posts.',
        readable: true,
        writable: true,
        default: true
      },
      {
        label: 'Minimum Comment Segments',
        name: 'minCommentItems',
        type: 'Number',
        // description: 'The minimum number of post segments required to create a post comment for this type.',
        readable: true,
        writable: true,
        validators: [{
          name: 'number',
          definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
        }],
        default: 1
      },
      {
        label: 'Maximum Comment Segments',
        name: 'maxCommentItems',
        type: 'Number',
        // description: 'The minimum number of comments segments allowed for a post comment on a post of this type.',
        dependencies: ['.minCommentItems'],
        readable: true,
        writable: true,
        validators: [{
          name: 'number',
          definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
        }, {
          name: 'adhoc',
          definition: {
            message: 'maxCommentItems must be >= minCommentItems',
            validator: function(ac, node, value) {
              return value >= this.minCommentItems
            }
          }
        }]
      },
      {
        label: 'Notifications',
        name: 'notifications',
        type: 'Boolean',
        // description: 'If true, a feed update notification is triggered for all direct post targets.',
        readable: true,
        writable: true,
        default: false
      },
      {
        label: 'Track Views',
        name: 'trackViews',
        type: 'Boolean',
        // description: 'Tracking views enabled counts of posts not yet loaded by a principal. Leave false if not required for better performance, especially for public feeds.',
        // @todo automatically disable trackviews if the post targets include anonymous viewers?
        // @todo ensure the viewers array only includes direct targets and/or doesn't fully load (like favorites in context object)
        readable: true,
        writable: true,
        default: false
      },
      {
        label: 'Editable',
        name: 'editable',
        type: 'Boolean',
        // description: 'If false, posts will not be editable after creation, even by the creator. Comments may still be made, depending on the feed configuration.',
        readable: true,
        writable: true,
        default: true
      },
      {
        label: 'Deletable',
        name: 'deletable',
        type: 'Boolean',
        // description: 'If false, posts will not be deletable via the api.',
        readable: true,
        writable: true,
        default: true
      },
      new AclDefinition({
        label: 'Context Read Acl',
        name: 'contextReadAcl',
        type: 'Document',
        // description: 'Feed read access control. When entries are present, a feed cannot be read unless this acl is satisfied against the associated context.',
        array: true,
        maxItems: 20,
        maxShift: false,
        canPush: true,
        canPull: true,
        readable: true,
        writable: true,
        includeId: true,
        skipAllow: true
      }),
      new AclDefinition({
        label: 'Post Create Acl',
        name: 'postCreateAcl',
        type: 'Document',
        // description: 'Post creation access control. When entries are present, a post cannot be created unless this acl is satisfied against the associated context.',
        array: true,
        maxItems: 20,
        maxShift: false,
        canPush: true,
        canPull: true,
        readable: true,
        writable: true,
        includeId: true,
        skipAllow: true
      }),
      new AclDefinition({
        label: 'Post Instance Acl',
        name: 'postInstanceAcl',
        type: 'Document',
        // description: 'Applies to the post instance. All principals that pass feed config context contextReadAccess are granted Read access, and the post creator is granted Delete access. Once context access to the post has been granted, the access context switches to the post instance. These entries augment post instance access. This can, for example, allow a segment update by other than the post creator.',
        array: true,
        maxItems: 20,
        canPush: true,
        canPull: true,
        readable: true,
        writable: true,
        includeId: true
      }),
      new ObjectSlotsDefinition({
        label: 'Post Index Slots',
        name: 'postSlots',
        dependencies: ['.body.properties']
      }),
      {
        label: 'Post Body Configuration',
        name: 'body',
        type: 'Document',
        // description: 'The segment document sets available to posts of this type, keyed by name.',
        array: true,
        minItems: 0,
        maxItems: 20,
        canPush: true,
        canPull: true,
        readable: true,
        onRemovingValue: function(ac, node, value) {
          modules.db.definitions.registerPropertyForReaping(value, ac, node)
        },
        properties: [
          {
            label: 'Segment Identifier',
            name: '_id',
            auto: true,
            type: 'ObjectId',
            // description: 'The segment configuration identifier.',
            dependencies: ['.name'],
            readable: true
          },
          {
            label: 'Deployment Identifiers',
            name: 'did',
            type: 'ObjectId',
            readable: false,
            array: true
          },
          {
            label: 'Segment Label',
            name: 'label',
            type: 'String',
            // description: 'The segment type label.',
            readable: true,
            writable: true,
            validators: [{
              name: 'required'
            }, {
              name: 'printableString',
              definition: { min: 1, max: 100, anyFirstLetter: false }
            }]
          },
          {
            label: 'Segment Name',
            name: 'name',
            type: 'String',
            // description: 'The segment name.',
            readable: true,
            writable: true,
            dependencies: ['..name', 'deletedProperties'],
            validators: [{
              name: 'required'
            }, {
              name: 'customName'
            }, {
              name: 'uniqueInArray'
            }, {
              name: 'adhoc',
              definition: {
                message: 'This segment name is not available for use.',
                validator: function(ac, node) {
                  const fq = modules.db.definitions.getInstancePath(this, node, true)
                  return utils.array(ac.subject.deletedProperties).filter(deleted => deleted.fq === fq).length === 0
                }
              }
            }],
            writer: function(ac, node, v) {
              return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
            }
          },
          {
            label: 'Minimum Segments',
            name: 'minRequired',
            type: 'Number',
            // description: 'The minimum number of this type of segment required in the post.',
            readable: true,
            writable: true,
            validators: [{
              name: 'number',
              definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
            }],
            default: 1
          },
          {
            label: 'Maximum Segments',
            name: 'maxAllowed',
            type: 'Number',
            // description: 'The maximum number of this type of segment allowed in a post of this type.',
            dependencies: ['.minRequired'],
            readable: true,
            writable: true,
            validators: [{
              name: 'number',
              definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
            }, {
              name: 'adhoc',
              definition: {
                message: 'maxAllowed must be >= minRequired',
                validator: function(ac, node, value) {
                  return value >= this.minRequired
                }
              }
            }]
          },
          new PropertySetDefinition({
            allowSets: false,
            label: 'Segment Configuration',
            slots: '..postSlots',
            name: 'properties',
            maxItems: 20
          })
        ]
      },
      new ObjectSlotsDefinition({
        label: 'Comment Index Slots',
        name: 'commentSlots',
        dependencies: ['.comments.properties']
      }),
      {
        label: 'Comment Body Configuration',
        name: 'comments',
        type: 'Document',
        // description: 'The comment document sets available to posts of this type, keyed by name.',
        array: true,
        minItems: 0, // @todo validate items must equal at least 1 if allowComments == true
        maxItems: 20,
        canPush: true,
        canPull: true,
        readable: true,
        dependencies: ['deletedProperties'],
        onRemovingValue: function(ac, node, value) {
          modules.db.definitions.registerPropertyForReaping(value, ac, node)
        },
        properties: [
          {
            label: 'Comment Identifier',
            name: '_id',
            auto: true,
            type: 'ObjectId',
            // description: 'The comment configuration identifier.',
            readable: true
          },
          {
            label: 'Deployment Identifiers',
            name: 'did',
            type: 'ObjectId',
            readable: false,
            array: true
          },
          {
            label: 'Segment Label',
            name: 'label',
            type: 'String',
            // description: 'The segment type label.',
            readable: true,
            writable: true,
            validators: [{
              name: 'required'
            }, {
              name: 'printableString',
              definition: { min: 1, max: 100, anyFirstLetter: false }
            }]
          },
          {
            label: 'Segment Name',
            name: 'name',
            type: 'String',
            // description: 'The segment name.',
            readable: true,
            writable: true,
            dependencies: ['..name', 'deletedProperties'],
            validators: [{
              name: 'required'
            }, {
              name: 'customName'
            }, {
              name: 'uniqueInArray'
            }, {
              name: 'adhoc',
              definition: {
                message: 'This segment name is not available for use.',
                validator: function(ac, node) {
                  const fq = modules.db.definitions.getInstancePath(this, node, true)
                  return utils.array(ac.subject.deletedProperties).filter(deleted => deleted.fq === fq).length === 0
                }
              }
            }],
            writer: function(ac, node, v) {
              return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
            }
          },
          {
            label: 'Minimum Segments',
            name: 'minRequired',
            type: 'Number',
            // description: 'The minimum number of this type of segment required in the comment.',
            readable: true,
            writable: true,
            validators: [{
              name: 'number',
              definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
            }],
            default: 1
          },
          {
            label: 'Maximum Segments',
            name: 'maxAllowed',
            type: 'Number',
            // description: 'The maximum number of this type of segment allowed in a comment of this type.',
            dependencies: ['.minRequired'],
            readable: true,
            writable: true,
            validators: [{
              name: 'number',
              definition: { min: 1, max: config('feeds.maxSegments'), allowNull: false, allowDecimal: false }
            }, {
              name: 'adhoc',
              definition: {
                message: 'maxAllowed must be >= minRequired',
                validator: function(ac, node, value) {
                  return value >= this.minRequired
                }
              }
            }]
          },
          new PropertySetDefinition({
            allowSets: false,
            label: 'Comment Configuration',
            name: 'properties',
            slots: '..commentSlots',
            maxItems: 20
          })
        ]
      }]
  })

}
util.inherits(PostTypeDefinition, DocumentDefinition)

PostTypeDefinition.prototype.generateMongooseSchema = function(options) {
  options = options || {}
  options.indexes = [
    // post types must be unique within an object.
    [{ _id: 1, 'feedDefinition.postType': 1 }, { unique: true, name: 'idxUniquePostTypes', partialFilterExpression: { 'feedDefinition.postType': { $exists: true } } }]
  ]
  return DocumentDefinition.prototype.generateMongooseSchema.call(this, options)
}

module.exports = PostTypeDefinition
