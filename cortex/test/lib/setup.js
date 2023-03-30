// load test configuration.
;(() => {
  const config = require('cortex-service/lib/config')
  config.read(`${__dirname}/../config.test.json`, true)
})()

const uuid = require('uuid'),
      logger = require('cortex-service/lib/logger'),
      server = require('./server')

exports.mochaHooks = {
  beforeEach() {
    server.mochaCurrentTestUuid = uuid.v1()
  },
  afterEach() {
    delete server.mochaCurrentTestUuid
  }
}

exports.mochaGlobalSetup = async function() {
  try {
    console.time('Setup')
    let message = await server.setup()
    console.timeEnd('Setup')
    logger.info(message)
  } catch (e) {
    logger.error('Error setting up cortex-api test server', e)
    throw e
  }
}

exports.mochaGlobalTeardown = async function() {
  try {
    let message = await server.teardown()
    logger.info(message)
  } catch (e) {
    logger.error('Error tearing down cortex-api test server', e)
    throw e
  }
}
