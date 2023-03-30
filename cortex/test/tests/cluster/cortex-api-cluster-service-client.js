'use strict'

const assert = require('assert'),
      deepExtend = require('deep-extend'),
      { config } = require('cortex-service'),
      ClusterServiceClient = require('cortex-service/lib/kube/cluster-service-client'),
      CortexApiClusterServiceClient = require('../../../lib/modules/services/api'),
      hostname = 'localhost'

function stopServiceClient(done) {
  if (this.apiClusterServiceClient) {
    this.apiClusterServiceClient.stop(done)
  } else {
    done()
  }
}

describe.skip('CortexApiClusterServiceClient', function() {

  it('should extend ClusterServiceClient', function() {
    assert(CortexApiClusterServiceClient.prototype instanceof ClusterServiceClient)
  })

  it('should have command method', function() {
    assert(CortexApiClusterServiceClient.prototype.command)
    assert.strictEqual(typeof CortexApiClusterServiceClient.prototype.command, 'function')
  })

  describe('commands', function() {

    before(function(done) {
      this.apiClusterServiceClient = new CortexApiClusterServiceClient(config('services.api'))
      this.apiClusterServiceClient.start(done)
    })

    after(stopServiceClient)

    it('api.metrics', function(done) {
      this.apiClusterServiceClient.command('api.metrics', (err, metrics) => {

        assert(!err && metrics)

        assert(metrics.localhost)
        assert(metrics.localhost.api)
        assert(metrics.localhost.caches)
        assert(metrics.localhost.db)
        assert(metrics.localhost.reader)
        assert(metrics.localhost.sandbox)
        assert(metrics.localhost.service)
        assert(metrics.localhost.v8)
        assert(metrics.localhost.workers)

        done(err)
      })
    })

  })

  describe('ws', function() {

    before(function(done) {
      const options = deepExtend({ ...config('services.api') }, { ws: { enable: true } })
      this.apiClusterServiceClient = new CortexApiClusterServiceClient(options)
      this.apiClusterServiceClient.start(done)
    })

    after(stopServiceClient)

    it('ws should be enabled for this test suite', function() {
      assert(this.apiClusterServiceClient.isWsSupported)
    })

    it('ws client should have required options', function() {
      const wsClient = this.apiClusterServiceClient._wsClientList.get(hostname)
      assert(wsClient)
      assert(wsClient._options)
      assert(wsClient._options.client)
      assert(wsClient._options.client.transport)
      assert(wsClient._options.client.transport.headers)
      assert.strictEqual(wsClient._options.client.transport.headers['Host'], hostname)
      assert.strictEqual(wsClient._options.client.transport.servername, hostname)
      assert(wsClient._options.client.transport.ca)
      assert(wsClient._options.client.transport)
    })

    describe('http fallback', function() {
      before(function(done) {
        const wsClient = this.apiClusterServiceClient._wsClientList.get(hostname)
        wsClient.stop(done)
      })

      after(function(done) {
        const wsClient = this.apiClusterServiceClient._wsClientList.get(hostname)
        wsClient.start(done)
      })

      it('ws client should not be ready during this test suite', function() {
        const wsClient = this.apiClusterServiceClient._wsClientList.get(hostname)
        assert(wsClient)
        assert(!wsClient.isReady())
      })

      it('should return metrics with disabled ws client', function(done) {

        this.apiClusterServiceClient.command('api.metrics', (err, metrics) => {

          assert(!err && metrics)

          assert(metrics.localhost)
          assert(metrics.localhost.api)
          assert(metrics.localhost.caches)
          assert(metrics.localhost.db)
          assert(metrics.localhost.reader)
          assert(metrics.localhost.sandbox)
          assert(metrics.localhost.service)
          assert(metrics.localhost.v8)
          assert(metrics.localhost.workers)

          done(err)
        })

      })
    })

  })

})
