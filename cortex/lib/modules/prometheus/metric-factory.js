'use strict'

const client = require('prom-client')
const Fault = require('cortex-service/lib/fault'),
      { COUNTER, GAUGE, HISTOGRAM, SUMMARY } = require('../../consts').prometheus.metricType

class MetricFactory {

  constructor(client) {
    this._client = client
  }

    createMetric = (type, data) => {
      let metric = null
      const { name, help, labelNames = [], buckets = null, percentiles = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99, 0.999], maxAgeSeconds = 600, ageBuckets = 5 } = data

      switch (type) {
        case COUNTER:
          metric = new client.Counter({ name, help, labelNames })
          break
        case GAUGE:
          metric = new client.Gauge({ name, help, labelNames })
          break
        case HISTOGRAM:
          if (buckets && Array.isArray(buckets)) {
            metric = new client.Histogram({ name, help, labelNames, buckets })
            break
          }
          metric = new client.Histogram({ name, help, labelNames })
          break
        case SUMMARY:
          metric = new client.Summary({ name, help, percentiles, maxAgeSeconds, ageBuckets, labelNames })
          break
        default:
          throw Fault.create('cortex.prometheus.invalidMetricType', { reason: `Metric type: ${type} not found` })
      }

      return metric
    }

}

module.exports = new MetricFactory()
