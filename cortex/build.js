/* eslint-disable no-console */
'use strict'

let Undefined

process.chdir(__dirname)

const scriptBuilder = require('./lib/modules/sandbox/scripts/build')

scriptBuilder.build(err => {

  if (err) {
    console.log('sandbox script transpiler failed', err)
    process.exit(1)
  } else {
    console.log('sandbox scripts transpiled.')
  }

  const sandboxBuilder = require('./sandbox/build'),
        buildOptions = sandboxBuilder.getOptions(process.argv)

  if (buildOptions.debug === Undefined && buildOptions.release === Undefined && buildOptions.xcode === Undefined) {
    buildOptions.debug = true
    buildOptions.xcode = true
  }

  sandboxBuilder.build(buildOptions, err => {
    if (err) {
      console.log('sandbox executable build failed', err)
    }
  })

})
