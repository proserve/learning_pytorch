'use strict'

const Worker = require('../worker'),
      logger = require('cortex-service/lib/logger'),
      modules = require('../../../modules'),
      { serializeObject } = require('../../../utils')

module.exports = class TestWorker extends Worker {

  _process(message, payload, options, callback) {

    const endpoint = modules.services.api.selfName,
          { org } = message

    modules.db.models.Console.create({
      org,
      date: new Date(),
      level: 'debug',
      message: serializeObject({ endpoint, payload })
    }, err => {
      void err
    })

    logger.debug('test worker', { org, endpoint, payload })

    callback()

  }

}
