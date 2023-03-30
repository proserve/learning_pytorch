'use strict'

const sandboxed = require('../../lib/sandboxed'),
      { prometheus } = require('../../../lib/modules'),
      { promised } = require('../../../lib/utils'),
      _ = require('underscore'),
      // eslint-disable-next-line no-unused-vars
      assert = require('assert')

describe('Modules.Prometheus', function() {

  describe('Counter', function() {
    afterEach(async() => {
      await prometheus.getMetric('test_counter').reset()
    })

    it('should successfully create a counter', async() => {

      await promised(null, sandboxed(function() {
        const { Counter } = require('prometheus')

        let c = new Counter({ name: 'test_counter', help: 'test counter help', labelNames: ['label1'] })

        c.inc()
        c.inc(0)
        c.inc(10)
      }))

      const metric = await prometheus.getMetric('test_counter').get()
      assert.strictEqual(metric.values[0].value, 11)
    })

    it('should increment a counter with labels', async() => {

      await promised(null, sandboxed(function() {
        const { Counter } = require('prometheus')

        let c = new Counter({ name: 'test_counter', help: 'test counter help', labelNames: ['label1'] })

        c.inc({ label1: 'v1' })
        c.inc({ label1: 'v1' }, 20)
      }))

      const metric = await prometheus.getMetric('test_counter').get()
      assert.strictEqual(metric.values[0].value, 21)
    })

    it('should not allow incrementing with negative value', async() => {
      assert.rejects(promised(null, sandboxed(function() {
        const { Counter } = require('prometheus')

        let c = new Counter({ name: 'test_counter', help: 'test counter help', labelNames: ['label1'] })

        c.inc(-10)
      })),
      {
        code: 'kScriptError',
        reason: 'It is not possible to decrease a counter'
      })
    })

  })

  describe('Gauge', function() {
    afterEach(async() => {
      await prometheus.getMetric('test_gauge').reset()
    })

    it('should successfully create a Gauge', async() => {

      await promised(null, sandboxed(function() {
        const { Gauge } = require('prometheus')

        let g = new Gauge({ name: 'test_gauge', help: 'test Gauge help', labelNames: ['label1'] })

        g.inc()
        g.inc(10)
        g.dec(5)
      }))

      const metric = await prometheus.getMetric('test_gauge').get()
      assert.strictEqual(metric.values[0].value, 6)
    })

    it('should inc/dec a Gauge with labels', async() => {

      await promised(null, sandboxed(function() {
        const { Gauge } = require('prometheus')

        let g = new Gauge({ name: 'test_gauge', help: 'test Gauge help', labelNames: ['label1'] })

        g.inc({ label1: 'v1' })
        g.inc({ label1: 'v1' }, 20)
        g.dec({ label1: 'v1' }, 5)
      }))

      const metric = await prometheus.getMetric('test_gauge').get()
      assert.strictEqual(metric.values[0].value, 16)
      assert.deepStrictEqual(metric.values[0].labels, { label1: 'v1' })
    })

    it('should allow incrementing with negative value', async() => {
      await promised(null, sandboxed(function() {
        const { Gauge } = require('prometheus')

        let g = new Gauge({ name: 'test_gauge', help: 'test Gauge help', labelNames: ['label1'] })

        g.inc()
        g.inc(-5)
      }))

      const metric = await prometheus.getMetric('test_gauge').get()
      assert.strictEqual(metric.values[0].value, -4)
    })

    it('should successfully set value', async() => {
      await promised(null, sandboxed(function() {
        const { Gauge } = require('prometheus')

        let g = new Gauge({ name: 'test_gauge', help: 'test Gauge help', labelNames: ['label1'] })

        g.set(10)
        g.inc(1)
      }))

      const metric = await prometheus.getMetric('test_gauge').get()
      assert.strictEqual(metric.values[0].value, 11)
    })

    it('should successfully set value to 0', async() => {
      await promised(null, sandboxed(function() {
        const { Gauge } = require('prometheus')

        let g = new Gauge({ name: 'test_gauge', help: 'test Gauge help', labelNames: ['label1'] })

        g.set(0)
      }))

      const metric = await prometheus.getMetric('test_gauge').get()
      assert.strictEqual(metric.values[0].value, 0)
    })

  })

  describe('Histogram', function() {
    afterEach(async() => {
      await prometheus.getMetric('test_histogram').reset()
    })

    it('should successfully create a Histogram', async() => {

      await promised(null, sandboxed(function() {
        const { Histogram } = require('prometheus')

        let h = new Histogram({ name: 'test_histogram', help: 'test Histogram help', labelNames: ['label1'], buckets: [0, 0.2, 0.5, 1] })

        h.observe(0.5)
        h.observe(0)
        h.observe(0.1)
        h.observe(-1)
      }))

      const metric = await prometheus.getMetric('test_histogram').get()
      assert.strictEqual(findBucketValue(metric.values, 0), 2)
      assert.strictEqual(findBucketValue(metric.values, 0.2), 3)
      assert.strictEqual(findBucketValue(metric.values, 0.5), 4)
      assert.strictEqual(findBucketValue(metric.values, '+Inf'), 4)
    })

    it('should add Histogram observations with labels', async() => {

      await promised(null, sandboxed(function() {
        const { Histogram } = require('prometheus')

        let h = new Histogram({ name: 'test_histogram', help: 'test Histogram help', labelNames: ['label1'], buckets: [0, 0.2, 0.5, 1] })

        h.observe({ label1: 'v1' }, 0.1)
        h.observe({ label1: 'v1' }, 0.3)
      }))

      const metric = await prometheus.getMetric('test_histogram').get()
      assert.strictEqual(findBucketValue(metric.values, 0, { label1: 'v1' }), 0)
      assert.strictEqual(findBucketValue(metric.values, 0.2, { label1: 'v1' }), 1)
      assert.strictEqual(findBucketValue(metric.values, 0.5, { label1: 'v1' }), 2)
      assert.strictEqual(findBucketValue(metric.values, '+Inf', { label1: 'v1' }), 2)
    })

    function findBucketValue(values, bucket, labels = {}) {
      if (values.length === 0) {
        return null
      }
      labels = Object.assign(labels, { le: bucket })

      return _.find(values, v => _.isEqual(v.labels, labels))?.value
    }
  })

})
