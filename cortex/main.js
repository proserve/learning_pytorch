'use strict'

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message)
})

require('cortex-service').main(require('./lib/classes/api-service'))
