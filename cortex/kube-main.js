'use strict'

require('child_process').exec('cp -r /sourceCode/lib /app && cp /sourceCode/config.json /app/config.json', err => {
  if (err) {
    throw err
  }
  require('cortex-service').main(require('./lib/classes/api-service'))
})
