'use strict'

const modules = require('../../modules')

module.exports = function(express, router, service) {

  router.get('/metrics', async(req, res, next) => {
    res.send(await modules.prometheus.getMetricData())
  })

}
