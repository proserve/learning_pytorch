const util = require('util'),
      utils = require('../../../../utils'),
      BaseFileProcessorDefinition = require('../base-file-processor-definition'),
      modules = require('../../../../modules'),
      TempFilePointer = modules.storage.TempFilePointer,
      async = require('async'),
      Fault = require('cortex-service/lib/fault'),
      imageSize = require('image-size'),
      _ = require('underscore'),
      gm = require('gm').subClass({ imageMagick: true })

// @todo impose limits using gm.limit

function ImageDefinition(options) {

  options = options || {}

  BaseFileProcessorDefinition.call(this, options)

  this.overlay = utils.rVal(options.overlay, null)
  this.maintainAspectRatio = utils.rBool(options.maintainAspectRatio, true)
  this.cropImage = utils.rBool(options.cropImage, true)
  this.minWidth = utils.rInt(options.minWidth, 0)
  this.minHeight = utils.rInt(options.minHeight, 0)
  this.maxWidth = utils.rInt(options.maxWidth, 0)
  this.maxHeight = utils.rInt(options.maxHeight, 0)
  this.imageWidth = utils.rInt(options.imageWidth, 0)
  this.imageHeight = utils.rInt(options.imageHeight, 0)
  this.grayscale = utils.rBool(options.grayscale, false)
  this.opacity = Math.min(1.0, Math.max(0.0, utils.isNumeric(options.opacity) ? parseFloat(options.opacity) : 1.0))

}

util.inherits(ImageDefinition, BaseFileProcessorDefinition)
ImageDefinition.typeName = 'image'

// mimes the process can write out. if not listed, the fallback is used.
ImageDefinition.processableMimeTypes = ['image/jpeg', 'image/png', 'image/gif'] //

// the fallback out if the incoming image is not listed in processableMimeTypes
ImageDefinition.fallbackMimeType = 'image/png'

function findSource(name, sources) {
  return _.find(sources, function(source) {
    return source.name === name
  })
}

ImageDefinition.prototype.getTypeName = function() {
  return ImageDefinition.typeName
}

ImageDefinition.prototype.apiSchema = function(options) {

  var schema = BaseFileProcessorDefinition.prototype.apiSchema.call(this, options)

  schema.maintainAspectRatio = this.maintainAspectRatio
  schema.cropImage = this.cropImage

  if (this.overlay) schema.overlay = this.overlay
  if (this.minWidth) schema.minWidth = this.minWidth
  if (this.minHeight) schema.minHeight = this.minHeight
  if (this.maxWidth) schema.maxWidth = this.maxWidth
  if (this.maxHeight) schema.maxHeight = this.maxHeight
  if (this.imageWidth) schema.imageWidth = this.imageWidth
  if (this.imageHeight) schema.imageHeight = this.imageHeight
  if (this.grayscale) schema.grayscale = true
  if (this.opacity < 1.0) schema.opacity = this.opacity

  return schema

}

ImageDefinition.prototype._getPointerDimensions = function(ac, source, fileSize, callback) {

  var bytes = Math.min(utils.rInt(fileSize, 0), 1024 * 128) || 1024 * 128
  source.range(0, bytes, function(err, buffer) {
    if (err) callback(err)
    else {
      try {
        var size = imageSize(buffer)
      } catch (err) {
        return callback(err)
      }
      if (size) {
        return callback(null, size['width'], size['height'])
      }
      gm(buffer, source.filename).size(function(err, size) {
        var fault, width, height
        if (!err) {
          width = utils.path(size, 'width')
          height = utils.path(size, 'height')
        }
        if (width == null || height == null) {
          fault = Fault.create('cortex.error.unspecified', { resource: ac.getResource(), reason: 'failed to determine image size from source: ' + source.name })
        }
        if (fault) {
          if (err) {
            fault.add(err)
          }
        }
        callback(fault, width, height)
      })
    }
  })
}

ImageDefinition.prototype._getSourcePointer = function(ac, node, sources, rootDocument, propertyPath, facetId, options, callback) {

  if (_.isFunction(options)) { callback = options; options = {} } else { options = options || {} }

  var self = this

  BaseFileProcessorDefinition.prototype._getSourcePointer.call(this, ac, node, sources, rootDocument, propertyPath, facetId, options, function(err, sourceErrors, source, originalSource) {

    if (err || !source) {
      return callback(err, sourceErrors, source, originalSource)
    }

    async.waterfall([

      // find the source image size
      function(callback) {

        if (source.getMeta('width') != null && source.getMeta('height') != null) {
          return callback(null, source)
        }

        // ensure the source has meta set in case we want to copy form the unmodified source.
        self._getPointerDimensions(ac, source, source.size, function(err, width, height) {
          if (!err) {
            source.setMeta('width', width, true).setMeta('height', height, true)
          }
          callback(err, source)
        })

      },

      // create an image from the source.
      function(source, callback) {

        const sourceWidth = source.getMeta('width'),
              sourceHeight = source.getMeta('height'),
              // determine if we can use the input as the source, unmodified (if the sizes match and there is no overlay).
              frameSize = self._getFrameSize(sourceWidth, sourceHeight)

        if (sourceWidth === frameSize.width && sourceHeight === frameSize.height && !findSource(self.overlay, sources) && !self.grayscale && self.opacity === 1.0) {
          return callback(null, source)
        }

        // process the source image into a disposable pointer.
        source.stream(function(err, stream) {
          if (err) {
            return callback(err)
          }
          let image = self.createImageObject(stream, source.filename, sourceWidth, sourceHeight, frameSize.width, frameSize.height),
              output = new TempFilePointer(node, { creator: source.creator, mime: source.mime }, ac)

          output.setMeta('width', frameSize.width, true).setMeta('height', frameSize.height, true)

          if (self.grayscale) {
            image = image.type('Grayscale')
          }
          if (self.opacity < 1.0) {
            image = image.out('-alpha', 'on').out('-channel', 'a').out('-evaluate', 'multiply', self.opacity)
          }

          image.write(output.path, function(err) {
            if (err) {
              return callback(err, output)
            } else if (output.getMeta('width') && output.getMeta('height')) {
              return callback(null, output)
            }
            self._getPointerDimensions(ac, output, output.size, function(err, width, height) {
              if (!err) {
                output.setMeta('width', width, true).setMeta('height', height, true)
              }
              callback(err, output)
            })
          })
        })
      },

      // see if an overlay is required.
      function(source, callback) {

        var overlay
        if (!(overlay = findSource(self.overlay, sources))) {
          return callback(null, source)
        }

        // process overlay
        async.waterfall([

          // load overlay.
          function(callback) {
            overlay.info(function(err) {
              if (err) {
                return callback(err)
              }
              if (overlay.getMeta('width') && overlay.getMeta('height')) {
                return callback(null, overlay)
              }
              self._getPointerDimensions(ac, overlay, overlay.size, function(err, width, height) {
                if (!err) {
                  overlay.setMeta('width', width, true).setMeta('height', height, true)
                }
                callback(err, overlay)
              })
            })
          },

          // process the source overlay into a disposable pointer.
          function(overlay, callback) {

            const overlayWidth = overlay.getMeta('width'),
                  overlayHeight = overlay.getMeta('height'),
                  // @todo force overlay stretch?
                  frameSize = self._getFrameSize(overlayWidth, overlayHeight)

            overlay.stream(function(err, stream) {
              if (err) {
                return callback(err)
              }
              const image = self.createImageObject(stream, overlay.filename, overlayWidth, overlayHeight, frameSize.width, frameSize.height, true),
                    output = new TempFilePointer(node, { creator: overlay.creator, mime: overlay.mime }, ac)

              output.setMeta('width', frameSize.width, true).setMeta('height', frameSize.height, true)
              image.write(output.path, function(err) {
                if (err) {
                  output.dispose()
                }
                callback(err, output)
              })
            })
          },

          // merge the background and overlay
          function(overlay, callback) {

            var background = source
            source = new TempFilePointer(node, { creator: ac.principalId, mime: background.mime })

            gm(background.path).composite(overlay.path).write(source.path, function(err) {
              background.dispose()
              overlay.dispose()
              if (err) {
                callback(err)
              } else {
                // load dimensions.
                gm(source.path).size(function(err, size) {
                  var fault, width, height
                  if (!err) {
                    width = utils.path(size, 'width'); height = utils.path(size, 'height')
                  }
                  if (width == null || height == null) {
                    fault = Fault.create('cortex.error.unspecified', { resource: ac.getResource(), reason: 'failed to determine image size for composite' })
                  }
                  if (fault && err) {
                    fault.add(err)
                  }
                  if (!fault) {
                    source.setMeta('width', width, true).setMeta('height', height, true)

                  }
                  callback(fault, source)
                })
              }
            })
          }

        ], callback)

      },

      // make sure the caller gets fully loaded pointer. calculate ETag, get filesize, etc.
      function(source, callback) {
        source.info(function(err) {
          callback(err, source)
        })
      }

    ], function(err, source) {
      if (err) {
        if (err === 'kDone') err = null
        else if (source) {
          source.dispose()
        }
      }
      callback(err, [], source, originalSource)

    })

  })

}

ImageDefinition.prototype._getFrameSize = function(sourceWidth, sourceHeight) {

  var frameWidth, frameHeight

  if (this.imageWidth > 0 && this.imageHeight > 0) { // specific width and height.
    frameWidth = this.imageWidth
    frameHeight = this.imageHeight
  } else if (this.imageWidth > 0) {
    frameWidth = this.imageWidth
    frameHeight = Math.max(1, Math.round(sourceHeight * frameWidth / sourceWidth))
    if (frameHeight < this.minHeight) {
      frameHeight = this.minHeight
    } else if (frameHeight > this.maxHeight) {
      frameHeight = this.maxHeight
    }
  } else if (this.imageHeight > 0) {
    frameHeight = this.imageHeight
    frameWidth = Math.max(1, Math.round(sourceWidth * frameHeight / sourceHeight))
    if (frameWidth < this.minWidth) {
      frameWidth = this.minWidth
    } else if (frameWidth > this.maxWidth) {
      frameWidth = this.maxWidth
    }
  } else {
    frameWidth = sourceWidth
    if (this.minWidth > 0 && frameWidth < this.minWidth) {
      frameWidth = this.minWidth
    } else if (this.maxWidth > 0 && frameWidth > this.maxWidth) {
      frameWidth = this.maxWidth
    }
    // @todo @broken for tall images, doesn't work. check width and height.
    frameHeight = Math.max(1, Math.round(sourceHeight * frameWidth / sourceWidth))
    if (this.minHeight > 0 && frameHeight < this.minHeight) {
      frameHeight = this.minHeight
    } else if (this.maxHeight > 0 && frameHeight > this.maxHeight) {
      frameHeight = this.maxHeight
    }
  }

  return { width: frameWidth, height: frameHeight }
}

ImageDefinition.prototype.createImageObject = function(stream, filename, sourceWidth, sourceHeight, frameWidth, frameHeight, skipExtent) { // @todo this is hack fix. find another way arounf extent.

  var image = gm(stream, filename).noProfile().strip(),
      sourceAspect = sourceWidth / sourceHeight,
      targetAspect = frameWidth / frameHeight,
      imageWidth = frameWidth,
      imageHeight = frameHeight

  if (this.cropImage) {
    image.geometry(frameWidth + 'x' + frameHeight + '^').gravity('Center').crop(frameWidth, frameHeight)
  } else if (this.maintainAspectRatio) {
    if (sourceAspect < targetAspect) {
      imageWidth = Math.max(1, Math.round(sourceWidth * frameHeight / sourceHeight))
      imageHeight = frameHeight
    } else {
      imageHeight = Math.max(1, Math.round(sourceHeight * frameWidth / sourceWidth))
      imageWidth = frameWidth
    }
    image.resize(imageWidth + 'x' + imageHeight).gravity('Center')
    if (!skipExtent) {
      image.extent(frameWidth + 'x' + frameHeight).background('none')
    }
  } else {
    image.geometry(frameWidth + 'x' + frameHeight + '!')
  }
  return image

}

ImageDefinition.getProperties = function() {

  return [{
    label: 'Overlay',
    name: 'overlay',
    type: 'String',
    // description: 'The name of a source overlay facet to be used for this image.',
    readable: true,
    writable: true,
    trim: true,
    dependencies: ['.name', '.source', '.type'],
    validators: [{
      name: 'pattern',
      definition: {
        pattern: '/^[a-zA-Z0-9-_]{0,40}$/'
      }
    }, {
      name: 'adhoc',
      definition: {
        message: 'The name of any existing overlay facet.',
        validator: function(ac, node, value) {
          if (!value) return true
          var arr = this.__parentArray, len = arr.length
          while (len--) {
            if (utils.path(arr[len], 'name') === value) {
              return arr[len].type === 'overlay'
            }
          }
          return false
        }
      }
    }]
  }, {
    // this is an override.
    name: 'mimes',
    validators: [
      {
        name: 'stringEnum',
        definition: {
          values: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
        }
      }
    ]
  }, {
    label: 'Image Width',
    name: 'imageWidth',
    // description: 'A specific width to which the image will be resized. Overrides minWidth and maxWidth. Set to 0 to keep the size of the original. If a width and no height is set, the maintainAspectRatio setting will be used to determin the final size of the image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }]

  }, {
    label: 'Image Height',
    name: 'imageHeight',
    // description: 'A specific height to which the image will be resized. Overrides minHeight and maxHeight. Set to 0 to keep the size of the original. If a height and no width is set, the maintainAspectRatio setting will be used to determin the final size of the image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }]
  }, {
    label: 'Maintain Aspect Ratio',
    name: 'maintainAspectRatio',
    // description: 'Maintains the original image\'s aspect ration. If true - with both imageWidth and imageHeight set - images may appear with black bands on either the top amd bottom, or left and right side of the resulting image.',
    type: 'Boolean',
    default: true,
    readable: true,
    writable: true
  }, {
    label: 'Crop Image',
    name: 'cropImage',
    // description: 'When true, images will be resized and cropped to best fit the target image size.',
    type: 'Boolean',
    default: true,
    readable: true,
    writable: true
  }, {
    label: 'Min Width',
    name: 'minWidth',
    // description: 'The minimum width of the resulting image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }]
  }, {
    label: 'Max Width',
    name: 'maxWidth',
    // description: 'The maximum width of the resulting image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    dependencies: ['.minWidth'],
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }, {
      name: 'adhoc',
      definition: {
        name: 'adhoc',
        message: 'maxWidth must be >= minWidth',
        validator: function(ac, node, value) {
          return value === 0 || (this.minWidth === 0 || value >= this.minWidth)
        }
      }
    }]
  }, {
    label: 'Min Height',
    name: 'minHeight',
    // description: 'The minimum height of the resulting image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }]
  }, {
    label: 'Max Height',
    name: 'maxHeight',
    // description: 'The maximum height of the resulting image.',
    type: 'Number',
    default: 0,
    readable: true,
    writable: true,
    dependencies: ['.minHeight'],
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 10000,
        allowDecimal: false
      }
    }, {
      name: 'adhoc',
      definition: {
        name: 'adhoc',
        message: 'maxHeight must be >= minHeight',
        validator: function(ac, node, value) {
          return value === 0 || (this.minHeight === 0 || value >= this.minHeight)
        }
      }
    }]
  }, {
    label: 'Gray Scale',
    name: 'grayscale',
    type: 'Boolean',
    default: false,
    readable: true,
    writable: true
  }, {
    label: 'Opacity',
    name: 'opacity',
    type: 'Number',
    default: 1.0,
    readable: true,
    writable: true,
    validators: [{
      name: 'number',
      definition: {
        allowNull: false,
        min: 0,
        max: 1,
        allowDecimal: true
      }
    }]
  }]

}

module.exports = ImageDefinition
