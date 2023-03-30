const acl = require('../../../acl'),
      _ = require('underscore'),
      utils = require('../../../utils'),
      config = require('cortex-service/lib/config'),
      consts = require('../../../consts'),
      Fault = require('cortex-service/lib/fault'),
      modules = require('../../../modules')

function BaseDefinition(options) {

  options = options || {}

  this.label = options.label
  this.name = options.name
  this.private = utils.rBool(options.private, false)
  this.source = utils.rVal(options.source, null)
  this.location = utils.rVal(options.location, consts.LocationTypes.AwsS3)
  this.storageId = utils.rVal(options.storageId, consts.storage.availableLocationTypes.medable)
  this.required = utils.rBool(options.required, false)
  this.passMimes = utils.rBool(options.passMimes, true)
  this.mimes = utils.array(options.mimes)
  this.allowUpload = utils.rBool(options.allowUpload, true)
  this.maxFileSize = Math.min(utils.rInt(options.maxFileSize, config('uploads.defaultMaxSize')), config('uploads.upperMaxSize'))
  this.dependencies = []
  this.skipVirusScan = utils.rBool(options.skipVirusScan, false)
}

BaseDefinition.prototype.apiSchema = function(options) {

  var schema = {
    type: this.getTypeName(),
    label: this.label,
    name: this.name,
    private: this.private,
    source: this.source,
    location: this.location,
    storageId: this.storageId,
    required: this.required,
    passMimes: this.passMimes,
    mimes: this.mimes,
    allowUpload: this.allowUpload,
    maxFileSize: this.maxFileSize,
    skipVirusScan: this.skipVirusScan
  }

  if (utils.option(options, 'verbose')) {
    schema.description = this.description || ''
  }

  return schema

}

BaseDefinition.prototype.initDependencies = function(processors) {

  let chain = [],
      next = this
  while (next && next.source !== next.name) {
    if (~chain.indexOf(next.source)) {
      break // circular! this should have been prevented.
    }
    chain.push(next.source)
    next = _.find(processors, function(next, v) {
      return v.name === next.source
    }.bind(null, next))
  }
  this.dependencies = chain
}

BaseDefinition.prototype.isSelectedMime = function(contentType) {

  if (_.isString(contentType)) {
    if (contentType === '*') {
      return true
    } else {
      var yes = false, no = false, negate, mime, len = this.mimes.length
      while (len--) {
        mime = this.mimes[len]
        negate = mime[0] === '!'
        if (negate) mime = mime.substr(1)
        if (mime === '*' || contentType === mime) {
          if (negate) {
            no = true
          } else {
            yes = true
          }
        }
      }
      return yes && !no
    }
  }
  return false
}

/**
 *
 * @param ac
 * @param node
 * @param sources
 * @param rootDocument
 * @param propertyPath
 * @param facetId
 * @param options
 * @param callback err, sourceErrors [{pid: , name:, fault:}], pointer, originalSource
 * @returns {*}
 * @private
 */
BaseDefinition.prototype._getSourcePointer = function(ac, node, sources, rootDocument, propertyPath, facetId, options, callback) {

  [options, callback] = utils.resolveOptionsCallback(options, callback)

  let source = _.find(sources, v => v.name === this.source),
      sourceErrors = []

  if (!source) {
    return callback(Fault.create('cortex.notFound.missingMediaSource', { resource: ac.getResource(), reason: 'source missing: ' + this.name }), sourceErrors, null, null)
  }

  // load the source pointer information.
  source.info((err, info) => {
    // check if this content type can be processed.
    if (!err && !this.isSelectedMime(info.mime)) {
      if (this.passMimes) {
        source = null // null pointer will cause the facet to be removed.
      } else {
        err = Fault.create('cortex.unsupportedMediaType.facetMime', { resource: ac.getResource(), reason: source.name + ' (' + source.filename + ') does not match allowed mime types for facet.' })
        sourceErrors.push({ pid: source.pid, name: source.name, fault: err })
      }
    }
    if (err || !source) {
      return callback(err, sourceErrors, source, source)
    }

    callback(null, sourceErrors, source, source)
    /*
        // more rigorous content type enforcement.
        source.detectMime(function(err, detectedType) {
            if (!err) {
                if (info.mime != detectedType) {
                    err = Fault.create('cortex.invalidArgument.mismatchedContentType', {reason: 'Upload content type does not match upload source content type.'});
                    sourceErrors.push({pid: source.pid, name: source.name, fault: err});
                }
            }
            callback(err, sourceErrors, source, source);
        }.bind(this));
        */

  })

}

/**
 *
 * @param ac
 * @param node
 * @param sources
 * @param rootDocument
 * @param propertyPath
 * @param facetId
 * @param options
 * @param callback -> err, sourceErrors, pointer, originalSource
 */
BaseDefinition.prototype.process = function(ac, node, sources, rootDocument, propertyPath, facetId, options, callback) {

  if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

  const self = this

  // find the source. if there is no source and there is no error, the null pointer will cause the facet to be removed.
  this._getSourcePointer(ac, node, sources, rootDocument, propertyPath, facetId, options, function(err, sourceErrors, source, originalSource) {

    if (err || !source) {
      if (source) source.dispose()
      return callback(err, sourceErrors, null, originalSource)
    }

    source.getMime(function(err, contentType) {

      if (err) {
        source.dispose()
        return callback(err, [], null, originalSource)
      }

      const pointer = modules.storage.create(node, {
        location: self.location,
        storageId: self.storageId,
        state: consts.media.states.pending
      }, ac)

      pointer.generatePropertyFileKey(rootDocument, propertyPath, facetId, contentType, (err, key) => {

        if (err) {
          callback(err, [], pointer, originalSource)
        } else {

          const copyOptions = { key }

          pointer.write(source, copyOptions, function(err, pointer) {

            if (!err) {
              pointer.pid = facetId
              pointer.creator = source.creator
              pointer.private = self.private
              pointer.name = self.name
              pointer.mime = contentType
              // pointer.meta = clone(source.meta);
              pointer.ETag = source.ETag
              pointer.filename = source.filename
            }
            source.dispose()

            callback(err, [], pointer, originalSource)
          })
        }

      })

    })

  })

}

BaseDefinition.getProperties = function() {
  return [
    {
      label: '_id',
      name: '_id',
      type: 'ObjectId',
      // description: 'The processor identifier',
      readable: true,
      auto: true
    },
    {
      label: 'Type',
      name: 'type',
      type: 'String',
      // description: 'The processor type',
      readable: true,
      creatable: true
    },
    {
      label: 'Label',
      name: 'label',
      type: 'String',
      // description: 'The processor label.',
      readable: true,
      writable: true,
      validators: [
        {
          name: 'required'
        },
        {
          name: 'printableString',
          definition: {
            min: 1,
            max: 64
          }
        }
      ]
    },
    {
      label: 'Name',
      name: 'name',
      type: 'String',
      // description: 'The processor name. It must be unique across all processors. The resulting File property value array items will have a matching facet name value.',
      readable: true,
      creatable: true,
      trim: true,
      validators: [
        {
          name: 'required'
        },
        {
          name: 'uniqueInArray'
        },
        {
          name: 'customName',
          definition: {
            skip: function(ac, node, value) {
              return value === 'content'
            }
          }
        }
      ],
      writer: function(ac, node, v) {
        if (v === 'content') {
          return v
        }
        return modules.validation.formatCustomName(ac.org.code, this.schema.path(node.docpath).cast(v))
      }
    },
    {
      label: 'Allow Upload',
      name: 'allowUpload',
      type: 'Boolean',
      // description: 'If true, allows a processor that would normally be generated from another facet instead use an upload source as input.',
      readable: true,
      writable: true,
      default: true
    },
    {
      label: 'Mimes',
      name: 'mimes',
      type: 'String',
      // description: 'A list of mime types this processor will attempt to action. To handle all mimes, use "*".',
      array: true,
      minItems: 1,
      maxItems: 20,
      readable: true,
      writable: true,
      canPush: true,
      canPull: true,
      validators: [
        {
          name: 'pattern',
          definition: {
            pattern: '/(?=^\\*$)|(?=^[\\w.+-]+\\/[\\w.+-]+$)/'
          }
        }
      ]
    },
    {
      label: 'Max File Size',
      name: 'maxFileSize',
      type: 'Number',
      // description: 'The maximum allowed upload file size.',
      readable: true,
      writable: true,
      default: config('uploads.defaultMaxSize'),
      validators: [
        {
          name: 'required'
        },
        {
          name: 'number',
          definition: {
            min: 1,
            max: config('uploads.upperMaxSize'),
            allowDecimal: false
          }
        }
      ]
    },
    {
      label: 'Private',
      name: 'private',
      type: 'Boolean',
      // description: 'The resulting entry will be private, and only ever accessible by the file creator.',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Source',
      name: 'source',
      type: 'String',
      // description: 'The processor uses an uploaded named source or the result of another processor as it\'s input source.',
      readable: true,
      writable: true,
      trim: true,
      dependencies: ['.name', '.allowUpload', '._id'],
      validators: [
        {
          name: 'required'
        },
        {
          name: 'pattern',
          definition: {
            pattern: '/^[a-zA-Z0-9-_]{1,40}$/'
          }
        },
        {
          name: 'adhoc',
          definition: {
            message: 'The name of any facet existing facet. A facet can only use itself as a source if it allows uploads.',
            validator: function(ac, node, value) {
              var arr = this.__parentArray, len = arr.length
              while (len--) {
                if (utils.path(arr[len], 'name') === value) {
                  if (arr[len] === this) {
                    return !!this.allowUpload
                  }
                  return true
                }
              }
              return false
            }
          }
        },
        {
          name: 'adhoc',
          definition: {

            message: 'This facet contains a circular dependency.',
            validator: function() {
              let chain = [],
                  next = this
              while (next && next.source !== next.name) {
                if (~chain.indexOf(next)) {
                  return false
                }
                chain.push(next)
                next = _.find(this.__parentArray, function(next, v) {
                  return v.name === next.source
                }.bind(null, next))
              }
              return true
            }
          }
        }
      ]
    },
    {
      label: 'Location',
      name: 'location',
      type: 'Number',
      // description: 'Specifies the storage location type of the value.',
      readable: true,
      writable: true,
      default: consts.LocationTypes.AwsS3,
      writeAccess: acl.AccessLevels.System,
      validators: [
        {
          name: 'required'
        }
      ]
    },
    {
      label: 'Storage Identifier',
      name: 'storageId',
      type: 'String',
      // description: 'Specifies the storage location identifier of the value.',
      readable: true,
      writable: true,
      default: consts.storage.availableLocationTypes.medable,
      writeAccess: acl.AccessLevels.System, // until property support
      validators: [
        {
          name: 'required'
        }
      ]
    },
    {
      label: 'Required',
      name: 'required',
      type: 'Boolean',
      // description: 'When true, this facet will be a required source/upload.',
      readable: true,
      writable: true,
      default: false
    },
    {
      label: 'Pass Mimes',
      name: 'passMimes',
      type: 'Boolean',
      // description: 'When true, an usupported mime will not cause an error, it will simply be skipped.',
      readable: true,
      writable: true,
      default: true
    },
    {
      label: 'Skip Virus Scan',
      name: 'skipVirusScan',
      type: 'Boolean',
      readable: true,
      writable: false,
      default: false
    }
  ]
}

module.exports = BaseDefinition
