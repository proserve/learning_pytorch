'use strict'

const path = require('path'),
      fs = require('fs'),
      dir = `${__dirname}/../scripts`

// eg. loadSandboxScript('CTXAPI-000.example')

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1
}

function loadSandboxScript(file, ext = '.js') {

  if (!endsWith(file, ext)) {
    file = `${file}${ext}`
  }
  return fs.readFileSync(
    path.join(dir, file),
    'utf8'
  )
}

module.exports = loadSandboxScript
