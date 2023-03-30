'use strict'

const client = require('prom-client')
const Fault = require('cortex-service/lib/fault')
const factory = require('./metric-factory')
const defaultCustomMetrics = require('./metric-defaults')

class PrometheusClient {

  constructor() {
    const collectDefaultMetrics = client.collectDefaultMetrics
    this._metrics = {}
    collectDefaultMetrics({})

    // Register default custom metrics
    for (const metric of defaultCustomMetrics) {
      this.registerCustomMetric(metric.type, metric.data)
    }
  }

  getMetricData = () => {
    return client.register.metrics()
  }

  registerCustomMetric = (type, data) => {
    // Make this idempotent so we only register the metric once
    if (this._metrics[data.name]) {
      return this._metrics[data.name]
    }

    const metric = factory.createMetric(type, data)
    this._metrics[data.name] = metric
    client.register.registerMetric(metric)
  }

  getMetric = (name, labels) => {
    const metric = this._metrics[name]
    if (!metric) {
      throw Fault.create('cortex.prometheus.metricNameNotRegistered', { reason: `Metric name: ${name} not found` })
    }

    if (labels) {
      return metric.labels(labels)
    }

    return metric
  }

}

module.exports = new PrometheusClient()
