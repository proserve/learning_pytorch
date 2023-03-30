'use strict'

const server = require('../../lib/server'),
      fs = require('fs'),
      path = require('path')

function prepPatches(dir, fn) {

  const basepath = path.join(__dirname, '..', '..', 'lib/patches', dir),
        files = fs.existsSync(basepath) ? fs.readdirSync(basepath) : []

  files.sort().forEach(file => {
    const fullpath = path.join(basepath, file)
    if (fs.statSync(fullpath).isFile()) {
      fn(path.basename(file, '.js'), require(fullpath))
    }
  })
}

describe('Lib', function() {

  describe('Patches', function() {

    describe('Startup', function() {

      before(function(callback) {
        callback()
      })

      prepPatches('auto', (file, fn) => {
        it(file, function(callback) {
          fn(false, callback)
        })
      })

    })

    describe('Medable Org', function() {

      before(function(callback) {
        callback()
      })

      prepPatches('medable', (file, fn) => {
        it(file, function(callback) {
          fn(callback)
        })
      })

    })

    describe('All Orgs', function() {

      before(function(callback) {
        callback()
      })

      prepPatches('org', (file, fn) => {
        it(file, function(callback) {
          fn(server.org._id, callback)
        })
      })

    })

  })

})
