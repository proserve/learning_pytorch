'use strict'

const path = require('path'),
      logger = require('cortex-service/lib/logger'),
      _ = require('underscore'),
      FilePointer = require('./file'),
      temp = require('temp'),
      config = require('cortex-service/lib/config'),
      { createId } = require('../../utils'),
      fs = require('fs'),
      mime = require('mime'),
      tempDir = _.once(function(dirname) {
        try {
          require('mkdirp').sync(dirname)
        } catch (err) {
          logger.error('Failed to create TempFilePointer temp local processing dir at "' + dirname + '"')
        }
      })

/**
 * @type {Function}
 */
class TempFilePointer extends FilePointer {

  constructor(node, entry, ac) {

    entry = entry || {}

    const tmp = tempFile(entry.mime)

    entry.filename = path.basename(tmp)
    entry.size = null
    entry.ETag = null

    super(node, entry, ac)

    this.deleteOnDispose = true

    this.setMeta('path', tmp)
  }

  static generateFileName() {
    return tempFile()
  }

}

Object.defineProperty(TempFilePointer.prototype, 'path', {
  get: function() {
    return this.getMeta('path')
  },
  set: function(v) {
    // no-op. path cannot be changed for temp file.
  },
  enumerable: true
})

// delete any files that are left in the temp folder on exit.
process.on('exit', function() {
  try {
    const dir = config('uploads.tmp'), files = fs.readdirSync(dir)
    for (let i = 0; i < files.length; i++) {
      try { fs.unlinkSync(dir + '/' + files[i]) } catch (e) {}
    }
  } catch (e) {}
})

function tempFile(contentType) {

  const affixes = {
          prefix: createId()
        },
        oldDir = temp.dir

  if (contentType) {
    affixes.suffix = '.' + (mime.extension(contentType) || 'dat')
  }

  temp.dir = config('uploads.tmp')
  tempDir(temp.dir)
  let tmpFile = temp.path(affixes)
  temp.dir = oldDir
  return tmpFile
}

module.exports = TempFilePointer
